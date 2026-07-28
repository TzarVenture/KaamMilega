package sms

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"km-backend/internal/features/setting"
)

type SMSService interface {
	SendSMS(ctx context.Context, to string, templateName string, params []string) (interface{}, error)
}

type SMSServiceImpl struct {
	client         *http.Client
	settingService setting.SettingService
}

func NewSMSService(settingService setting.SettingService) SMSService {
	return &SMSServiceImpl{
		client:         &http.Client{},
		settingService: settingService,
	}
}

func (s *SMSServiceImpl) SendSMS(ctx context.Context, to string, templateName string, params []string) (interface{}, error) {
	// 1. Get Config Values using SettingService
	apiKey, err := s.settingService.GetValue(ctx, "CELL247_SMS_API_KEY")
	if err != nil {
		return nil, fmt.Errorf("failed to get SMS API KEY: %w", err)
	}

	apiUrl, err := s.settingService.GetValue(ctx, "CELL247_SMS_API_URL")
	if err != nil {
		return nil, fmt.Errorf("failed to get SMS API URL: %w", err)
	}

	senderName, err := s.settingService.GetValue(ctx, "CELL247_SMS_API_SENDER_NAME")
	if err != nil {
		return nil, fmt.Errorf("failed to get SMS SENDER NAME: %w", err)
	}

	templateKey := fmt.Sprintf("TEMPLATE.%s", templateName)
	template, err := s.settingService.GetValue(ctx, templateKey)
	// Template might be empty or missing, handle gracefully if needed?
	// The original code handled null template as empty string.
	if err != nil {
		// If template not found, use empty string? or error?
		// "let finalTemplate = template ?? """
		// Let's assume error means missing.
		template = ""
	}

	if apiKey == "" || apiUrl == "" || senderName == "" {
		return nil, fmt.Errorf("missing SMS configuration: API_KEY, API_URL or SENDER_NAME not set")
	}

	// 2. Template Replacement
	// Replaces {dynamic} placeholders sequentially with params
	finalTemplate := template
	for _, param := range params {
		finalTemplate = strings.Replace(finalTemplate, "{dynamic}", param, 1)
	}

	// 3. Prepare Request Payload
	payload := map[string]interface{}{
		"apiK":        apiKey,
		"mobile":      to,
		"text":        finalTemplate,
		"senderName":  senderName,
		"messageType": 0,
		"surl":        "0",
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// 4. Send Request
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var result interface{}
	// Try to unmarshal into generic map/interface
	if err := json.Unmarshal(body, &result); err != nil {
		// If not JSON, return raw string as result or error
		// The TS code returns `error` in catch block, but `response.data` in success.
		// If unmarshal fails but status is 200, maybe it's just a string response?
		if resp.StatusCode == 200 {
			return string(body), nil
		}
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("failed to send SMS: status %d, response: %s", resp.StatusCode, string(body))
	}

	return result, nil
}
