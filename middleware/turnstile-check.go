package middleware

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

type turnstileCheckResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

var turnstileHTTPClient = &http.Client{Timeout: 10 * time.Second}

func TurnstileCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.TurnstileCheckEnabled {
			response := c.Query("turnstile")
			if response == "" {
				common.ApiErrorT(c, "Turnstile token is empty")
				c.Abort()
				return
			}
			form := url.Values{
				"secret":   {common.TurnstileSecretKey},
				"response": {response},
				"remoteip": {c.ClientIP()},
			}
			request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
				"https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
			if err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			rawRes, err := turnstileHTTPClient.Do(request)
			if err != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Turnstile siteverify request failed: %v", err))
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "Turnstile siteverify request failed: " + err.Error(),
				})
				c.Abort()
				return
			}
			defer rawRes.Body.Close()
			if rawRes.StatusCode != http.StatusOK {
				logger.LogWarn(c.Request.Context(), "Turnstile siteverify returned HTTP %d", rawRes.StatusCode)
				c.AbortWithStatusJSON(http.StatusOK, gin.H{
					"success": false,
					"message": fmt.Sprintf("Turnstile siteverify returned HTTP %d", rawRes.StatusCode),
				})
				return
			}
			var res turnstileCheckResponse
			err = common.DecodeJson(rawRes.Body, &res)
			if err != nil {
				logger.LogError(c.Request.Context(), fmt.Sprintf("Turnstile siteverify response invalid: %v", err))
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				c.Abort()
				return
			}
			if !res.Success {
				logger.LogWarn(c.Request.Context(), "Turnstile siteverify rejected: error_codes=%q", res.ErrorCodes)
				common.ApiErrorT(c, "Turnstile verification failed, please refresh and try again!")
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
