package helper

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
)

const (
	InitialScannerBufferSize    = 64 << 10  // 64KB (64*1024)
	DefaultMaxScannerBufferSize = 128 << 20 // 64MB (64*1024*1024) default SSE buffer size
	DefaultPingInterval         = 10 * time.Second
	// streamWriteTimeout bounds a write blocked on a client that stopped
	// reading so the unconditional wg.Wait() in cleanup can always finish.
	// Without it, a connected client with a full TCP buffer (no server
	// WriteTimeout) could hang the handler forever. StreamWriteBudget adds the
	// time a client reading at streamMinClientRate needs for the data.
	streamWriteTimeout  = 30 * time.Second
	streamMinClientRate = 8 << 10 // bytes per second
)

type streamDrainContextKey struct{}

type streamDrainState struct {
	clientContext context.Context
	droppedOutput atomic.Bool
}

func streamIdleTimeout() time.Duration {
	timeout := time.Duration(constant.StreamingTimeout) * time.Second
	if timeout <= 0 {
		return 30 * time.Second
	}
	return timeout
}

// NewStreamDrainContext keeps an issued HTTP stream alive after its client
// leaves. The existing streaming timeout also bounds the entire post-cancel
// drain, starting even before response headers arrive. Heartbeats cannot extend
// this budget. The response body owner must release the context on every exit.
func NewStreamDrainContext(clientContext context.Context) (context.Context, context.CancelFunc) {
	upstreamContext, cancel := context.WithCancelCause(context.WithoutCancel(clientContext))
	state := &streamDrainState{clientContext: clientContext}
	upstreamContext = context.WithValue(upstreamContext, streamDrainContextKey{}, state)
	drainTimeout := streamIdleTimeout()
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		select {
		case <-upstreamContext.Done():
			return
		case <-clientContext.Done():
		}
		timer := time.NewTimer(drainTimeout)
		defer timer.Stop()
		select {
		case <-upstreamContext.Done():
		case <-timer.C:
			cancel(context.DeadlineExceeded)
		}
	}()
	return upstreamContext, func() {
		cancel(context.Canceled)
		<-watcherDone
	}
}

func (state *streamDrainState) discardOutput() bool {
	if state == nil || state.clientContext.Err() == nil {
		return false
	}
	state.droppedOutput.Store(true)
	return true
}

func getScannerBufferSize() int {
	if constant.StreamScannerMaxBufferMB > 0 {
		return constant.StreamScannerMaxBufferMB << 20
	}
	return DefaultMaxScannerBufferSize
}

// NewStreamScanner shares relay scanner configuration. Callers buffering bounded
// task state may additionally cap a line without increasing the configured limit.
func NewStreamScanner(reader io.Reader, maxBytes ...int) *bufio.Scanner {
	limit := getScannerBufferSize()
	if len(maxBytes) > 0 && maxBytes[0] > 0 {
		limit = min(limit, maxBytes[0])
	}
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, min(InitialScannerBufferSize, limit)), limit)
	return scanner
}

func copyCodexSSEHeaders(c *gin.Context, resp *http.Response) {
	if c == nil || c.Writer == nil || resp == nil {
		return
	}
	// codex
	for _, name := range []string{"X-Reasoning-Included", "X-Codex-Turn-State"} {
		values := resp.Header.Values(name)
		if !service.ShouldCopyUpstreamHeader(c, name, values) {
			continue
		}
		for _, value := range values {
			if value != "" {
				c.Writer.Header().Add(name, value)
			}
		}
	}
}

// StreamWriteBudget gives the writes of one stream a deadline of
// streamWriteTimeout past the time a client reading at streamMinClientRate
// needs for everything written so far. A fixed deadline per write cut slow
// clients off in the middle of a multi-megabyte image event, and the timeout
// looked like a client disconnect. The budget carries over between writes
// because the kernel can still hold megabytes of earlier writes and wakes a
// blocked writer only after a large part of them drains. A client that stops
// reading is still cut off once the budget runs out. Callers serialize writes.
type StreamWriteBudget struct {
	drainBy time.Time
}

// Deadline returns the write deadline for n more bytes written at now.
func (b *StreamWriteBudget) Deadline(now time.Time, n int) time.Time {
	if b.drainBy.Before(now) {
		b.drainBy = now
	}
	b.drainBy = b.drainBy.Add(time.Duration(n) * time.Second / streamMinClientRate)
	return b.drainBy.Add(streamWriteTimeout)
}

// streamResponseWriter sets the connection write deadline from its budget
// before every write. Writers that don't support deadlines (e.g. httptest
// recorders) are silently ignored.
type streamResponseWriter struct {
	gin.ResponseWriter
	budget StreamWriteBudget
	drain  *streamDrainState
}

func (w *streamResponseWriter) Write(p []byte) (int, error) {
	if w.drain.discardOutput() {
		return len(p), nil
	}
	_ = http.NewResponseController(w.ResponseWriter).SetWriteDeadline(w.budget.Deadline(time.Now(), len(p)))
	written, err := w.ResponseWriter.Write(p)
	if err != nil && w.drain.discardOutput() {
		return len(p), nil
	}
	return written, err
}

func (w *streamResponseWriter) WriteString(s string) (int, error) {
	if w.drain.discardOutput() {
		return len(s), nil
	}
	_ = http.NewResponseController(w.ResponseWriter).SetWriteDeadline(w.budget.Deadline(time.Now(), len(s)))
	written, err := w.ResponseWriter.WriteString(s)
	if err != nil && w.drain.discardOutput() {
		return len(s), nil
	}
	return written, err
}

func (w *streamResponseWriter) WriteHeader(status int) {
	if !w.drain.discardOutput() {
		w.ResponseWriter.WriteHeader(status)
	}
}

func (w *streamResponseWriter) WriteHeaderNow() {
	if !w.drain.discardOutput() {
		w.ResponseWriter.WriteHeaderNow()
	}
}

func (w *streamResponseWriter) Flush() {
	if !w.drain.discardOutput() {
		w.ResponseWriter.Flush()
	}
}

// Unwrap lets http.ResponseController reach the connection.
func (w *streamResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func StreamScannerHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, dataHandler func(data string, sr *StreamResult)) {

	if resp == nil || dataHandler == nil {
		return
	}

	// Finish the request keepalive before changing headers. The scanner owns
	// subsequent ping and data writes through its shared write mutex.
	if writer, ok := c.Writer.(*streamKeepAliveWriter); ok {
		writer.stop()
	}

	// 无条件新建 StreamStatus
	info.StreamStatus = relaycommon.NewStreamStatus()

	upstreamContext := context.Background()
	if resp.Request != nil {
		upstreamContext = resp.Request.Context()
	}
	drain, hasDrain := upstreamContext.Value(streamDrainContextKey{}).(*streamDrainState)
	if !hasDrain {
		// Direct scanner callers still get a bounded drain. The shared HTTP
		// transport installs this earlier, before it waits for response headers.
		var release context.CancelFunc
		upstreamContext, release = NewStreamDrainContext(c.Request.Context())
		defer release()
		drain = upstreamContext.Value(streamDrainContextKey{}).(*streamDrainState)
	}
	ctx, cancel := context.WithCancel(upstreamContext)
	streamingTimeout := streamIdleTimeout()

	var (
		stopChan    = make(chan bool, 3) // 增加缓冲区避免阻塞
		scanner     = NewStreamScanner(resp.Body)
		ticker      = time.NewTicker(streamingTimeout)
		pingTicker  *time.Ticker
		writeMutex  sync.Mutex     // Mutex to protect concurrent writes
		wg          sync.WaitGroup // 用于等待所有 goroutine 退出
		cleanupOnce sync.Once
		stopOnce    sync.Once
	)

	stop := func() {
		stopOnce.Do(func() {
			close(stopChan)
		})
	}

	generalSettings := operation_setting.GetGeneralSetting()
	pingEnabled := generalSettings.PingIntervalEnabled && !info.DisablePing
	pingInterval := time.Duration(generalSettings.PingIntervalSeconds) * time.Second
	if pingInterval <= 0 {
		pingInterval = DefaultPingInterval
	}

	if pingEnabled {
		pingTicker = time.NewTicker(pingInterval)
	}

	// upstreamDataNotify 由 scanner goroutine 每收到一行上游数据时触发，
	// ping goroutine 监听后重置计时器，实现"上游空闲才 ping"语义。
	upstreamDataNotify := make(chan struct{}, 1)

	logger.LogDebug(c, "relay timeout seconds: %d", common.RelayTimeout)
	logger.LogDebug(c, "relay max idle conns: %d", common.RelayMaxIdleConns)
	logger.LogDebug(c, "relay max idle conns per host: %d", common.RelayMaxIdleConnsPerHost)
	logger.LogDebug(c, "streaming timeout seconds: %d", int64(streamingTimeout.Seconds()))
	logger.LogDebug(c, "ping interval seconds: %d", int64(pingInterval.Seconds()))

	cleanup := func() {
		cleanupOnce.Do(func() {
			cancel()
			stop()
			if resp.Body != nil {
				_ = resp.Body.Close()
			}

			ticker.Stop()
			if pingTicker != nil {
				pingTicker.Stop()
			}

			wg.Wait()
		})
	}
	// Ensure gin.Context is not returned to Gin's pool while any stream goroutine can still use it.
	defer cleanup()

	scanner.Split(bufio.ScanLines)
	copyCodexSSEHeaders(c, resp)
	SetEventStreamHeaders(c)
	// Only this scanner opts into discard-on-cancel. Non-stream responses,
	// task presentation, and WebSockets retain their existing error handling.
	c.Set("stream_drain_state", drain)
	c.Writer = &streamResponseWriter{ResponseWriter: c.Writer, drain: drain}

	ctx = context.WithValue(ctx, "stop_chan", stopChan)

	// Handle ping data sending with improved error handling.
	// 每次上游有数据时通过 upstreamDataNotify 重置计时器，实现"上游空闲才向下游 ping"语义，
	// 避免上游持续推送时还向下游发出冗余的 ping 帧。
	if pingEnabled && pingTicker != nil {
		wg.Add(1)
		gopool.Go(func() {
			defer func() {
				if r := recover(); r != nil {
					logger.LogError(c, common.LogText("ping goroutine panic: %v", r))
					info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPanic, fmt.Errorf("ping panic: %v", r))
					stop()
				}
				logger.LogDebug(c, "ping goroutine exited")
				wg.Done()
			}()

			// 添加超时保护，防止 goroutine 无限运行
			maxPingDuration := 30 * time.Minute
			pingTimeout := time.NewTimer(maxPingDuration)
			defer pingTimeout.Stop()

			for {
				select {
				case <-upstreamDataNotify:
					// 上游有新数据到达，重置 ping 计时器，推迟下一次 ping。
					pingTicker.Reset(pingInterval)
				case <-pingTicker.C:
					var err error
					func() {
						writeMutex.Lock()
						defer writeMutex.Unlock()
						err = PingData(c)
					}()
					if err != nil {
						if c.Request.Context().Err() != nil {
							return
						}
						logger.LogError(c, common.LogText("ping data error: %s", err.Error()))
						info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPingFail, err)
						return
					}
					logger.LogDebug(c, "ping data sent")
				case <-ctx.Done():
					return
				case <-stopChan:
					return
				case <-c.Request.Context().Done():
					return
				case <-pingTimeout.C:
					logger.LogError(c, common.LogText("ping goroutine max duration reached"))
					return
				}
			}
		})
	}

	dataChan := make(chan string, 10)
	sr := newStreamResult(info.StreamStatus)

	wg.Add(1)
	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				logger.LogError(c, common.LogText("data handler goroutine panic: %v", r))
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPanic, fmt.Errorf("handler panic: %v", r))
			}
			stop()
			wg.Done()
		}()
		for data := range dataChan {
			sr.reset()
			func() {
				writeMutex.Lock()
				defer writeMutex.Unlock()
				dataHandler(data, sr)
			}()
			if sr.IsStopped() {
				return
			}
		}
	})

	// Scanner goroutine with improved error handling
	wg.Add(1)
	common.RelayCtxGo(ctx, func() {
		defer func() {
			close(dataChan)
			if r := recover(); r != nil {
				logger.LogError(c, common.LogText("scanner goroutine panic: %v", r))
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonPanic, fmt.Errorf("scanner panic: %v", r))
			}
			stop()
			logger.LogDebug(c, "scanner goroutine exited")
			wg.Done()
		}()

		zhiqiImageStream := info.ChannelMeta != nil && info.ChannelSetting.IsZhiqiEngine() &&
			(info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits)
		var imageEventName string
		for scanner.Scan() {
			// 检查是否需要停止
			select {
			case <-stopChan:
				return
			case <-ctx.Done():
				return
			default:
			}

			ticker.Reset(streamingTimeout)
			// 通知 ping goroutine 有上游数据，推迟下一次 ping。
			select {
			case upstreamDataNotify <- struct{}{}:
			default:
			}
			data := scanner.Text()
			logger.LogDebug(c, "stream scanner data: %s", data)
			if zhiqiImageStream {
				if data == "" {
					imageEventName = ""
					continue
				}
				if eventName, found := strings.CutPrefix(data, "event:"); found {
					imageEventName = strings.TrimSpace(eventName)
					continue
				}
				if strings.HasPrefix(data, ":") {
					writeMutex.Lock()
					_, writeErr := c.Writer.WriteString(data + "\n\n")
					c.Writer.Flush()
					writeMutex.Unlock()
					if writeErr != nil {
						info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonHandlerStop, writeErr)
						return
					}
					continue
				}
			}

			data, hasDataPrefix := strings.CutPrefix(data, "data:")
			data = strings.TrimSpace(data)
			if !hasDataPrefix && data != "[DONE]" {
				continue
			}
			if data == "" {
				continue
			}
			if data != "[DONE]" {
				if zhiqiImageStream && imageEventName != "" {
					var event map[string]json.RawMessage
					if common.UnmarshalJsonStr(data, &event) == nil && event != nil && len(event["type"]) == 0 {
						event["type"], _ = common.Marshal(imageEventName)
						if encoded, err := common.Marshal(event); err == nil {
							data = string(encoded)
						}
					}
				}
				info.SetFirstResponseTime()
				info.ReceivedResponseCount++

				select {
				case dataChan <- data:
				case <-ctx.Done():
					return
				case <-stopChan:
					return
				}
			} else {
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
				logger.LogDebug(c, "received [DONE], stopping scanner")
				return
			}
		}

		// Closing the upstream body is part of stopping the scanner. Its EOF or
		// read error must not replace the actual stop reason or add a false error.
		if ctx.Err() != nil {
			return
		}
		if err := scanner.Err(); err != nil {
			if err != io.EOF {
				logger.LogError(c, common.LogText("scanner error: %s", err.Error()))
				info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, err)
			}
		}
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	})

	// 主循环等待完成或超时
	select {
	case <-ticker.C:
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonTimeout, nil)
	case <-stopChan:
		// EndReason already set by the goroutine that triggered stopChan
	case <-upstreamContext.Done():
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonTimeout, context.Cause(upstreamContext))
	case <-c.Request.Context().Done():
		// Keep the original client context cancelled so retry policy continues
		// to reject replay. Output is discarded while usage parsing continues.
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, c.Request.Context().Err())
		_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Now())
		logger.LogInfo(c, common.LogText("client disconnected, draining upstream for billing (timeout=%ds)", int64(streamingTimeout.Seconds())))
		select {
		case <-stopChan:
		case <-ticker.C:
		case <-upstreamContext.Done():
		}
	}

	cleanup()
	// The scanner may have reached EOF before the main select observed client
	// cancellation. Drained completion is billable, not successful delivery.
	if drain.droppedOutput.Load() && (info.StreamStatus.EndReason == relaycommon.StreamEndReasonDone || info.StreamStatus.EndReason == relaycommon.StreamEndReasonEOF) {
		info.StreamStatus.EndReason = relaycommon.StreamEndReasonClientGone
		info.StreamStatus.EndError = c.Request.Context().Err()
	}
	// All stream goroutines have joined. Done from a successfully delivered
	// protocol completion can now correct a cancellation that won while its
	// callback was still running. Bare EOF and failed writes never qualify.
	if sr.done && !drain.droppedOutput.Load() && info.StreamStatus.ResponseOutcome() == string(relaycommon.ResponseOutcomeCompleted) &&
		info.StreamStatus.EndReason == relaycommon.StreamEndReasonClientGone &&
		errors.Is(info.StreamStatus.EndError, context.Canceled) && !info.StreamStatus.HasErrors() {
		info.StreamStatus.EndReason = relaycommon.StreamEndReasonDone
		info.StreamStatus.EndError = nil
	}
	if info.StreamStatus.IsNormalEnd() && !info.StreamStatus.HasErrors() {
		logger.LogInfo(c, common.LogText("stream ended: %s", info.StreamStatus.Summary()))
	} else {
		logger.LogError(c, common.LogText("stream ended: %s, received=%d", info.StreamStatus.Summary(), info.ReceivedResponseCount))
	}
}
