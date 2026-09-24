package mentorship

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MentorshipService interface {
	CreateMentorship(ctx context.Context, expertID string, req CreateMentorshipRequest) (*Mentorship, error)
	ListMentorships(ctx context.Context, category string) ([]MentorshipDetail, error)
	GetMentorship(ctx context.Context, id string) (*MentorshipDetail, error)
	GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error)
	UpdateMentorship(ctx context.Context, expertID string, id string, req CreateMentorshipRequest) (*Mentorship, error)
	DeleteMentorship(ctx context.Context, expertID string, id string) error

	BookSession(ctx context.Context, userID string, req BookMentorshipRequest) (*Booking, error)
	GetUserBookings(ctx context.Context, userID string) ([]Booking, error)
	GetExpertBookings(ctx context.Context, expertID string) ([]Booking, error)
	UpdateBookingStatus(ctx context.Context, expertID string, bookingID string, status string) error
	UpdateMeetingLink(ctx context.Context, expertID string, bookingID string, meetingLink string) error

	// Payment & Checkout methods for F76
	BookWithWallet(ctx context.Context, userID string, req BookWithWalletRequest) (*Booking, *wallet.WalletSummaryResponse, error)
	CreateBookingOrder(ctx context.Context, userID string, req CreateMentorshipOrderRequest) (*CreateMentorshipOrderResponse, error)
	VerifyBookingPayment(ctx context.Context, userID string, req VerifyMentorshipPaymentRequest) (*Booking, error)

	UpdateAvailability(ctx context.Context, expertID string, req []AvailabilityRequest) error
	GetAvailability(ctx context.Context, expertID string) ([]Availability, error)
}

type MentorshipServiceImpl struct {
	repo          MentorshipRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	cfg           *config.Config
	httpClient    *http.Client
}

func NewMentorshipService(
	repo MentorshipRepository, 
	userRepo user.UserRepository, 
	walletService wallet.WalletService, 
	cfg *config.Config,
) MentorshipService {
	return &MentorshipServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		cfg:           cfg,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *MentorshipServiceImpl) CreateMentorship(ctx context.Context, expertID string, req CreateMentorshipRequest) (*Mentorship, error) {
	eid, _ := primitive.ObjectIDFromHex(expertID)
	m := &Mentorship{
		ExpertID:    eid,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Duration:    req.Duration,
		Price:       req.Price,
		Status:      "active",
	}
	return s.repo.CreateMentorship(ctx, m)
}

func (s *MentorshipServiceImpl) ListMentorships(ctx context.Context, category string) ([]MentorshipDetail, error) {
	ms, err := s.repo.ListMentorships(ctx, category)
	if err != nil {
		return nil, err
	}

	var details []MentorshipDetail
	for _, m := range ms {
		u, _ := s.userRepo.FindUserByID(ctx, m.ExpertID.Hex())
		if u != nil {
			details = append(details, MentorshipDetail{
				Mentorship: m,
				Expert: ExpertInfo{
					ID:           u.ID.Hex(),
					Name:         u.Name,
					Headline:     u.Headline,
					ProfileImage: u.ProfileImage,
					Bio:          u.ExpertBio,
				},
			})
		}
	}
	return details, nil
}

func (s *MentorshipServiceImpl) GetMentorship(ctx context.Context, id string) (*MentorshipDetail, error) {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return nil, err
	}

	u, _ := s.userRepo.FindUserByID(ctx, m.ExpertID.Hex())
	if u == nil {
		return nil, errors.New("expert not found")
	}

	return &MentorshipDetail{
		Mentorship: *m,
		Expert: ExpertInfo{
			ID:           u.ID.Hex(),
			Name:         u.Name,
			Headline:     u.Headline,
			ProfileImage: u.ProfileImage,
			Bio:          u.ExpertBio,
		},
	}, nil
}

func (s *MentorshipServiceImpl) GetMentorshipsByExpert(ctx context.Context, expertID string) ([]Mentorship, error) {
	return s.repo.GetMentorshipsByExpert(ctx, expertID)
}

func (s *MentorshipServiceImpl) UpdateMentorship(ctx context.Context, expertID string, id string, req CreateMentorshipRequest) (*Mentorship, error) {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return nil, err
	}
	if m.ExpertID.Hex() != expertID {
		return nil, errors.New("unauthorized")
	}

	m.Title = req.Title
	m.Description = req.Description
	m.Category = req.Category
	m.Duration = req.Duration
	m.Price = req.Price

	return s.repo.UpdateMentorship(ctx, id, m)
}

func (s *MentorshipServiceImpl) DeleteMentorship(ctx context.Context, expertID string, id string) error {
	m, err := s.repo.GetMentorshipByID(ctx, id)
	if err != nil || m == nil {
		return err
	}
	if m.ExpertID.Hex() != expertID {
		return errors.New("unauthorized")
	}
	return s.repo.DeleteMentorship(ctx, id)
}

func (s *MentorshipServiceImpl) BookSession(ctx context.Context, userID string, req BookMentorshipRequest) (*Booking, error) {
	m, err := s.repo.GetMentorshipByID(ctx, req.MentorshipID)
	if err != nil || m == nil {
		return nil, errors.New("mentorship not found")
	}

	uid, _ := primitive.ObjectIDFromHex(userID)
	booking := &Booking{
		MentorshipID:  m.ID,
		ExpertID:      m.ExpertID,
		UserID:        uid,
		ScheduledAt:   req.ScheduledAt,
		Status:        "pending",
		Amount:        m.Price,
		PaymentStatus: "pending",
		Notes:         req.Notes,
	}

	return s.repo.CreateBooking(ctx, booking)
}

// BookWithWallet handles instant 1-click booking via wallet main balance with escrow hold
func (s *MentorshipServiceImpl) BookWithWallet(ctx context.Context, userID string, req BookWithWalletRequest) (*Booking, *wallet.WalletSummaryResponse, error) {
	if userID == "" {
		return nil, nil, errors.New("unauthorized: missing user id")
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, nil, errors.New("invalid user id format")
	}

	m, err := s.repo.GetMentorshipByID(ctx, req.MentorshipID)
	if err != nil || m == nil {
		return nil, nil, errors.New("mentorship not found")
	}

	price := m.Price
	if price <= 0 {
		price = 100 // fallback
	}

	// 1. Verify user's wallet main balance
	walletSummary, err := s.walletService.GetWalletSummary(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to retrieve wallet: %w", err)
	}

	if walletSummary.MainBalance < price {
		return nil, nil, fmt.Errorf("insufficient wallet balance: required ₹%.2f, available ₹%.2f", price, walletSummary.MainBalance)
	}

	// 2. Create the confirmed booking
	booking := &Booking{
		MentorshipID:  m.ID,
		ExpertID:      m.ExpertID,
		UserID:        uid,
		ScheduledAt:   req.ScheduledAt,
		Status:        "confirmed",
		Amount:        price,
		PaymentStatus: "paid",
		PaymentMethod: "wallet",
		Notes:         req.Notes,
	}

	createdBooking, err := s.repo.CreateBooking(ctx, booking)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create booking record: %w", err)
	}

	// 3. Atomically debit user's main balance via ledger
	debitInput := wallet.RecordTransactionInput{
		UserID:        uid,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategorySessionBooking,
		Amount:        price,
		ReferenceID:   createdBooking.ID.Hex() + "_pay",
		Description:   fmt.Sprintf("1-on-1 Mentorship Booking: %s", m.Title),
		Metadata: map[string]interface{}{
			"mentorship_id":  m.ID.Hex(),
			"expert_id":      m.ExpertID.Hex(),
			"booking_id":     createdBooking.ID.Hex(),
			"payment_method": "wallet",
		},
	}
	_, _, err = s.walletService.RecordTransaction(ctx, debitInput)
	if err != nil {
		return nil, nil, fmt.Errorf("insufficient wallet balance: %w", err)
	}

	// 4. Atomically credit locked escrow balance via ledger
	escrowInput := wallet.RecordTransactionInput{
		UserID:        uid,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceLocked,
		Category:      wallet.CategorySessionBooking,
		Amount:        price,
		ReferenceID:   createdBooking.ID.Hex() + "_escrow",
		Description:   fmt.Sprintf("Mentorship Session Escrow Hold: %s", m.Title),
		Metadata: map[string]interface{}{
			"mentorship_id":  m.ID.Hex(),
			"expert_id":      m.ExpertID.Hex(),
			"booking_id":     createdBooking.ID.Hex(),
			"payment_method": "wallet",
		},
	}
	_, updatedWallet, _ := s.walletService.RecordTransaction(ctx, escrowInput)

	return createdBooking, updatedWallet, nil
}

// CreateBookingOrder initiates a Razorpay checkout order for booking a mentorship session
func (s *MentorshipServiceImpl) CreateBookingOrder(ctx context.Context, userID string, req CreateMentorshipOrderRequest) (*CreateMentorshipOrderResponse, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, errors.New("invalid user id format")
	}

	m, err := s.repo.GetMentorshipByID(ctx, req.MentorshipID)
	if err != nil || m == nil {
		return nil, errors.New("mentorship not found")
	}

	price := m.Price
	if price <= 0 {
		price = 100
	}
	amountPaise := int64(price * 100)

	keyID := s.cfg.RazorpayKeyID
	keySecret := s.cfg.RazorpayKeySecret
	if keyID == "" || keySecret == "" {
		return nil, errors.New("razorpay gateway credentials not configured")
	}

	receiptID := fmt.Sprintf("ms_%s_%d", userID[:min(6, len(userID))], time.Now().Unix())

	// Request order from Razorpay API
	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  receiptID,
		"notes": map[string]interface{}{
			"user_id":       userID,
			"mentorship_id": req.MentorshipID,
			"purpose":       "mentorship_booking",
		},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal order request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach razorpay api: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read razorpay response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(respBytes, &rzpOrder); err != nil {
		return nil, fmt.Errorf("failed to decode razorpay response: %w", err)
	}

	// Create pending booking
	booking := &Booking{
		MentorshipID:    m.ID,
		ExpertID:        m.ExpertID,
		UserID:          uid,
		ScheduledAt:     req.ScheduledAt,
		Status:          "pending",
		Amount:          price,
		PaymentStatus:   "pending",
		PaymentMethod:   "razorpay",
		RazorpayOrderID: rzpOrder.ID,
		Notes:           req.Notes,
	}

	createdBooking, err := s.repo.CreateBooking(ctx, booking)
	if err != nil {
		return nil, fmt.Errorf("failed to create booking record: %w", err)
	}

	return &CreateMentorshipOrderResponse{
		BookingID:   createdBooking.ID.Hex(),
		OrderID:     rzpOrder.ID,
		Amount:      price,
		AmountPaise: amountPaise,
		Currency:    "INR",
		KeyID:       keyID,
	}, nil
}

// VerifyBookingPayment validates HMAC signature and confirms session booking into escrow
func (s *MentorshipServiceImpl) VerifyBookingPayment(ctx context.Context, userID string, req VerifyMentorshipPaymentRequest) (*Booking, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user id")
	}
	if req.BookingID == "" || req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" || req.RazorpaySignature == "" {
		return nil, errors.New("missing razorpay payment verification parameters")
	}

	keySecret := s.cfg.RazorpayKeySecret
	if keySecret == "" {
		return nil, errors.New("razorpay gateway credentials not configured")
	}

	// Verify HMAC-SHA256 signature
	data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	h := hmac.New(sha256.New, []byte(keySecret))
	h.Write([]byte(data))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(req.RazorpaySignature)) {
		return nil, errors.New("invalid razorpay payment signature: verification failed")
	}

	// Retrieve booking
	booking, err := s.repo.GetBookingByID(ctx, req.BookingID)
	if err != nil || booking == nil {
		return nil, errors.New("booking record not found")
	}

	// Idempotency guard: prevent duplicate escrow crediting on duplicate callbacks/refreshes
	if booking.PaymentStatus == "paid" {
		return booking, nil
	}

	// Update booking status
	err = s.repo.UpdateBookingPayment(ctx, req.BookingID, "paid", "razorpay", req.RazorpayPaymentID, "confirmed")
	if err != nil {
		return nil, fmt.Errorf("failed to update booking: %w", err)
	}

	booking.Status = "confirmed"
	booking.PaymentStatus = "paid"
	booking.PaymentMethod = "razorpay"
	booking.RazorpayPaymentID = req.RazorpayPaymentID

	// Credit locked escrow and record in ledger
	uid, _ := primitive.ObjectIDFromHex(userID)
	input := wallet.RecordTransactionInput{
		UserID:        uid,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceLocked,
		Category:      wallet.CategorySessionBooking,
		Amount:        booking.Amount,
		ReferenceID:   req.RazorpayPaymentID,
		Description:   "Mentorship Booking Escrow (Razorpay)",
		Metadata: map[string]interface{}{
			"booking_id":          req.BookingID,
			"razorpay_order_id":   req.RazorpayOrderID,
			"razorpay_payment_id": req.RazorpayPaymentID,
			"payment_channel":     "razorpay",
		},
	}
	_, _, _ = s.walletService.RecordTransaction(ctx, input)

	return booking, nil
}

func (s *MentorshipServiceImpl) GetUserBookings(ctx context.Context, userID string) ([]Booking, error) {
	bookings, err := s.repo.ListBookingsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	for i := range bookings {
		if bookings[i].MentorshipTitle == "" && !bookings[i].MentorshipID.IsZero() {
			m, _ := s.repo.GetMentorshipByID(ctx, bookings[i].MentorshipID.Hex())
			if m != nil {
				bookings[i].MentorshipTitle = m.Title
			}
		}
	}
	return bookings, nil
}

func (s *MentorshipServiceImpl) GetExpertBookings(ctx context.Context, expertID string) ([]Booking, error) {
	bookings, err := s.repo.ListBookingsByExpert(ctx, expertID)
	if err != nil {
		return nil, err
	}
	for i := range bookings {
		if bookings[i].MentorshipTitle == "" && !bookings[i].MentorshipID.IsZero() {
			m, _ := s.repo.GetMentorshipByID(ctx, bookings[i].MentorshipID.Hex())
			if m != nil {
				bookings[i].MentorshipTitle = m.Title
			}
		}
		if bookings[i].MenteeName == "" && !bookings[i].UserID.IsZero() {
			u, _ := s.userRepo.FindUserByID(ctx, bookings[i].UserID.Hex())
			if u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				bookings[i].MenteeName = name
				bookings[i].MenteeEmail = u.Email
			}
		}
	}
	return bookings, nil
}

// UpdateBookingStatus updates booking status and manages escrow release or refunds
func (s *MentorshipServiceImpl) UpdateBookingStatus(ctx context.Context, expertID string, bookingID string, status string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return errors.New("booking not found")
	}
	if b.ExpertID.Hex() != expertID {
		return errors.New("unauthorized: caller is not the session expert")
	}

	// Idempotency check: if already in target status, do nothing
	if b.Status == status {
		return nil
	}

	// Terminal state guards
	if b.Status == "completed" {
		return errors.New("cannot change status of an already completed session")
	}
	if b.Status == "cancelled" {
		return errors.New("cannot change status of a cancelled session")
	}

	switch status {
	case "completed":
		// Session completed: release escrow from mentee's locked_balance to expert's earnings_balance
		if b.PaymentStatus == "paid" && b.Amount > 0 {
			// 1. Debit mentee's locked escrow balance
			releaseInput := wallet.RecordTransactionInput{
				UserID:        b.UserID,
				Type:          wallet.TypeDebit,
				TargetBalance: wallet.BalanceLocked,
				Category:      wallet.CategorySessionBooking,
				Amount:        b.Amount,
				ReferenceID:   fmt.Sprintf("REL_%s_%d", b.ID.Hex()[:min(6, len(b.ID.Hex()))], time.Now().UnixNano()),
				Description:   fmt.Sprintf("Escrow Release for Session: %s", b.ID.Hex()),
				Metadata: map[string]interface{}{
					"booking_id":    b.ID.Hex(),
					"expert_id":     b.ExpertID.Hex(),
					"mentee_id":     b.UserID.Hex(),
					"mentorship_id": b.MentorshipID.Hex(),
					"action":        "escrow_release",
				},
			}
			if _, _, err := s.walletService.RecordTransaction(ctx, releaseInput); err != nil {
				return fmt.Errorf("failed to debit locked escrow: %w", err)
			}

			// 2. Atomically credit expert's earnings balance
			earnInput := wallet.RecordTransactionInput{
				UserID:        b.ExpertID,
				Type:          wallet.TypeCredit,
				TargetBalance: wallet.BalanceEarnings,
				Category:      wallet.CategorySessionBooking,
				Amount:        b.Amount,
				ReferenceID:   fmt.Sprintf("EARN_%s_%d", b.ID.Hex()[:min(6, len(b.ID.Hex()))], time.Now().UnixNano()),
				Description:   fmt.Sprintf("Mentorship Session Earnings Credited: %s", b.ID.Hex()),
				Metadata: map[string]interface{}{
					"booking_id":    b.ID.Hex(),
					"mentee_id":     b.UserID.Hex(),
					"mentorship_id": b.MentorshipID.Hex(),
					"action":        "expert_earnings",
				},
			}
			if _, _, err := s.walletService.RecordTransaction(ctx, earnInput); err != nil {
				return fmt.Errorf("failed to credit expert earnings: %w", err)
			}
		}

	case "cancelled":
		// Session cancelled: refund locked escrow back to mentee's main balance
		if b.PaymentStatus == "paid" && b.Amount > 0 {
			// 1. Debit mentee's locked balance
			relLocked := wallet.RecordTransactionInput{
				UserID:        b.UserID,
				Type:          wallet.TypeDebit,
				TargetBalance: wallet.BalanceLocked,
				Category:      wallet.CategoryRefund,
				Amount:        b.Amount,
				ReferenceID:   fmt.Sprintf("REF_LCK_%s_%d", b.ID.Hex()[:min(6, len(b.ID.Hex()))], time.Now().UnixNano()),
				Description:   fmt.Sprintf("Escrow Refund Release: %s", b.ID.Hex()),
				Metadata: map[string]interface{}{
					"booking_id": b.ID.Hex(),
					"action":     "escrow_refund_release",
				},
			}
			_, _, _ = s.walletService.RecordTransaction(ctx, relLocked)

			// 2. Credit mentee's main balance
			refundMain := wallet.RecordTransactionInput{
				UserID:        b.UserID,
				Type:          wallet.TypeCredit,
				TargetBalance: wallet.BalanceMain,
				Category:      wallet.CategoryRefund,
				Amount:        b.Amount,
				ReferenceID:   fmt.Sprintf("REF_%s_%d", b.ID.Hex()[:min(6, len(b.ID.Hex()))], time.Now().UnixNano()),
				Description:   fmt.Sprintf("Mentorship Booking Refund: %s", b.ID.Hex()),
				Metadata: map[string]interface{}{
					"booking_id": b.ID.Hex(),
					"action":     "mentee_refund",
				},
			}
			_, _, _ = s.walletService.RecordTransaction(ctx, refundMain)

			// Update payment status to refunded
			_ = s.repo.UpdateBookingPayment(ctx, bookingID, "refunded", "", "", "cancelled")
		}

	case "confirmed":
		// Confirmed by expert, funds remain securely held in locked escrow

	default:
		return fmt.Errorf("invalid status transition: %s", status)
	}

	return s.repo.UpdateBookingStatus(ctx, bookingID, status)
}

func (s *MentorshipServiceImpl) UpdateMeetingLink(ctx context.Context, expertID string, bookingID string, meetingLink string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return errors.New("booking not found")
	}
	if b.ExpertID.Hex() != expertID {
		return errors.New("unauthorized: caller is not the session expert")
	}
	return s.repo.UpdateMeetingLink(ctx, bookingID, meetingLink)
}

func (s *MentorshipServiceImpl) UpdateAvailability(ctx context.Context, expertID string, req []AvailabilityRequest) error {
	var avails []Availability
	for _, a := range req {
		avails = append(avails, Availability{
			DayOfWeek: a.DayOfWeek,
			StartTime: a.StartTime,
			EndTime:   a.EndTime,
			IsActive:  true,
		})
	}
	return s.repo.UpdateAvailability(ctx, expertID, avails)
}

func (s *MentorshipServiceImpl) GetAvailability(ctx context.Context, expertID string) ([]Availability, error) {
	return s.repo.GetAvailabilityByExpert(ctx, expertID)
}
