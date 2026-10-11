package controller

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTicketCreateRequestMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("parses a valid attachment and detects its content type", func(t *testing.T) {
		context := newTicketMultipartContext(t, []ticketTestFile{{
			name: "screenshot.png",
			data: []byte("\x89PNG\r\n\x1a\n"),
		}})

		req, attachments, err := parseTicketCreateRequest(context)

		require.NoError(t, err)
		assert.Equal(t, "A question", req.Title)
		assert.Equal(t, "More details", req.Content)
		require.Len(t, attachments, 1)
		assert.Equal(t, "screenshot.png", attachments[0].Filename)
		assert.Equal(t, "image/png", attachments[0].ContentType)
	})

	t.Run("recognizes image types from known extensions", func(t *testing.T) {
		context := newTicketMultipartContext(t, []ticketTestFile{{
			name: "diagram.svg",
			data: []byte("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
		}})

		_, attachments, err := parseTicketCreateRequest(context)

		require.NoError(t, err)
		require.Len(t, attachments, 1)
		assert.Equal(t, "image/svg+xml", attachments[0].ContentType)
	})

	t.Run("rejects an attachment larger than 2 MiB", func(t *testing.T) {
		context := newTicketMultipartContext(t, []ticketTestFile{{
			name: "large.bin",
			data: bytes.Repeat([]byte("a"), int(model.TicketAttachmentMaxSize+1)),
		}})

		_, _, err := parseTicketCreateRequest(context)

		require.ErrorIs(t, err, errTicketAttachmentTooLarge)
	})

	t.Run("rejects more than five attachments", func(t *testing.T) {
		files := make([]ticketTestFile, 6)
		for i := range files {
			files[i] = ticketTestFile{name: "small.txt", data: []byte("x")}
		}
		context := newTicketMultipartContext(t, files)

		_, _, err := parseTicketCreateRequest(context)

		require.ErrorIs(t, err, errTicketAttachmentCount)
	})
}

type ticketTestFile struct {
	name string
	data []byte
}

func newTicketMultipartContext(t *testing.T, files []ticketTestFile) *gin.Context {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("title", "A question"))
	require.NoError(t, writer.WriteField("content", "More details"))
	for _, item := range files {
		file, err := writer.CreateFormFile("attachments", item.name)
		require.NoError(t, err)
		_, err = file.Write(item.data)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("POST", "/api/ticket/self", bytes.NewReader(body.Bytes()))
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return context
}
