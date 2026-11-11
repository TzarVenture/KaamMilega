package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"km-backend/internal/config"
)

// Razorpay payment states this package acts on.
const (
	gatewayCaptured   = "captured"
	gatewayAuthorized = "authorized"
)

const razorpayBaseURL = "https://api.razorpay.com/v1"

// GatewayPayment is Razorpay's own record of a payment.
type GatewayPayment struct {
	ID             string `json:"id"`
	OrderID        string `json:"order_id"`
	Status         string `json:"status"`
	Currency       string `json:"currency"`
	Amount         int64  `json:"amount"`
	AmountRefunded int64  `json:"amount_refunded"`
}

// Gateway is the part of Razorpay this package uses, so tests can replace it.
type Gateway interface {
	KeyID() string
	Configured() bool
	CreateOrder(ctx context.Context, amountPaise int64, receipt string, notes map[string]string) (string, error)
	FetchPayment(ctx context.Context, paymentID string) (*GatewayPayment, error)
	CapturePayment(ctx context.Context, paymentID string, amountPaise int64) (*GatewayPayment, error)
	OrderPayments(ctx context.Context, orderID string) ([]GatewayPayment, error)
	Refund(ctx context.Context, paymentID string, amountPaise int64, idempotencyKey string) (string, error)
	CheckoutSignatureValid(orderID, paymentID, signature string) bool
	WebhookSignatureValid(body []byte, signature string) bool
}

type razorpayGateway struct {
	keyID         string
	keySecret     string
	webhookSecret string
	baseURL       string
	http          *http.Client
}

// NewGateway creates the Razorpay client from the server configuration.
func NewGateway(cfg *config.Config) Gateway {
	return &razorpayGateway{
		keyID:         cfg.RazorpayKeyID,
		keySecret:     cfg.RazorpayKeySecret,
		webhookSecret: cfg.RazorpayWebhookSecret,
		baseURL:       razorpayBaseURL,
		http:          &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *razorpayGateway) KeyID() string { return g.keyID }

func (g *razorpayGateway) Configured() bool { return g.keyID != "" && g.keySecret != "" }

// call sends one request. Razorpay's response body never reaches the caller: it is logged here
// and the user gets a plain message.
func (g *razorpayGateway) call(ctx context.Context, method, path string, payload interface{}, headers map[string]string, out interface{}) error {
	if !g.Configured() {
		return ErrNotConfigured
	}

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encoding razorpay request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, g.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("building razorpay request: %w", err)
	}
	req.SetBasicAuth(g.keyID, g.keySecret)
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := g.http.Do(req)
	if err != nil {
		log.Printf("[payment] razorpay %s %s: %v", method, path, err)
		return ErrGateway
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[payment] razorpay %s %s: reading response: %v", method, path, err)
		return ErrGateway
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[payment] razorpay %s %s: status %d: %s", method, path, resp.StatusCode, raw)
		return ErrGateway
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			log.Printf("[payment] razorpay %s %s: decoding response: %v", method, path, err)
			return ErrGateway
		}
	}
	return nil
}

func (g *razorpayGateway) CreateOrder(ctx context.Context, amountPaise int64, receipt string, notes map[string]string) (string, error) {
	var order struct {
		ID string `json:"id"`
	}
	err := g.call(ctx, http.MethodPost, "/orders", map[string]interface{}{
		"amount":   amountPaise,
		"currency": CurrencyINR,
		"receipt":  receipt,
		"notes":    notes,
	}, nil, &order)
	if err != nil {
		return "", err
	}
	return order.ID, nil
}

func (g *razorpayGateway) FetchPayment(ctx context.Context, paymentID string) (*GatewayPayment, error) {
	var p GatewayPayment
	if err := g.call(ctx, http.MethodGet, "/payments/"+paymentID, nil, nil, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (g *razorpayGateway) CapturePayment(ctx context.Context, paymentID string, amountPaise int64) (*GatewayPayment, error) {
	var p GatewayPayment
	err := g.call(ctx, http.MethodPost, "/payments/"+paymentID+"/capture", map[string]interface{}{
		"amount":   amountPaise,
		"currency": CurrencyINR,
	}, nil, &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (g *razorpayGateway) OrderPayments(ctx context.Context, orderID string) ([]GatewayPayment, error) {
	var list struct {
		Items []GatewayPayment `json:"items"`
	}
	if err := g.call(ctx, http.MethodGet, "/orders/"+orderID+"/payments", nil, nil, &list); err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (g *razorpayGateway) Refund(ctx context.Context, paymentID string, amountPaise int64, idempotencyKey string) (string, error) {
	var refund struct {
		ID string `json:"id"`
	}
	err := g.call(ctx, http.MethodPost, "/payments/"+paymentID+"/refund", map[string]interface{}{
		"amount": amountPaise,
		"speed":  "normal",
	}, map[string]string{"X-Refund-Idempotency": idempotencyKey}, &refund)
	if err != nil {
		return "", err
	}
	return refund.ID, nil
}

func (g *razorpayGateway) CheckoutSignatureValid(orderID, paymentID, signature string) bool {
	if g.keySecret == "" {
		return false
	}
	return hmacEqual(g.keySecret, []byte(orderID+"|"+paymentID), signature)
}

func (g *razorpayGateway) WebhookSignatureValid(body []byte, signature string) bool {
	if g.webhookSecret == "" {
		return false
	}
	return hmacEqual(g.webhookSecret, body, signature)
}

func hmacEqual(secret string, message []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(message)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
