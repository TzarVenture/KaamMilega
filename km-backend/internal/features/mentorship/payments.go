package mentorship

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// How long a mentee has to confirm or report a session before the mentor is paid automatically
const confirmationWindow = 24 * time.Hour

const (
	methodWallet   = "wallet"
	methodRazorpay = "razorpay"
)

var (
	ErrBookingNotFound  = apperr.New("MENTORSHIP_BOOKING_NOT_FOUND", "booking not found")
	ErrMentorshipGone   = apperr.New("MENTORSHIP_NOT_FOUND", "mentorship not found")
	ErrNotBookable      = apperr.New("MENTORSHIP_PRICE_INVALID", "this session can't be booked because it has no price")
	ErrSelfBooking      = apperr.New("MENTORSHIP_SELF_BOOKING", "you can't book your own session")
	ErrScheduleInPast   = apperr.New("MENTORSHIP_SCHEDULE_PAST", "choose a time in the future")
	ErrNotYourBooking   = apperr.New("MENTORSHIP_BOOKING_FORBIDDEN", "this booking isn't yours")
	ErrBookingMoved     = apperr.New("MENTORSHIP_BOOKING_STATE", "this session has already moved on, please refresh")
	ErrSessionNotDue    = apperr.New("MENTORSHIP_SESSION_NOT_DUE", "a session can only be marked done after its start time")
	ErrReasonRequired   = apperr.New("MENTORSHIP_REPORT_REASON_REQUIRED", "tell us what went wrong")
	ErrInvalidBookState = apperr.New("MENTORSHIP_STATUS_INVALID", "that status can't be set on a session")
)

// bookable loads a mentorship and checks this user can buy it for this time.
func (s *MentorshipServiceImpl) bookable(ctx context.Context, uid primitive.ObjectID, mentorshipID string, scheduledAt time.Time) (*Mentorship, error) {
	m, err := s.repo.GetMentorshipByID(ctx, mentorshipID)
	if err != nil || m == nil {
		return nil, ErrMentorshipGone
	}
	if money.ToPaise(m.Price) <= 0 {
		return nil, ErrNotBookable
	}
	if m.ExpertID == uid {
		return nil, ErrSelfBooking
	}
	if scheduledAt.Before(time.Now().Add(-5 * time.Minute)) {
		return nil, ErrScheduleInPast
	}
	return m, nil
}

func bookingUser(userID string) (primitive.ObjectID, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return primitive.NilObjectID, apperr.New("UNAUTHORIZED", "unauthorized: missing user id")
	}
	return uid, nil
}

func ledgerRef(bookingID primitive.ObjectID, step string) string {
	return "booking:" + bookingID.Hex() + ":" + step
}

func bookingMeta(b *Booking, action string) map[string]interface{} {
	return map[string]interface{}{
		"booking_id":    b.ID.Hex(),
		"expert_id":     b.ExpertID.Hex(),
		"mentee_id":     b.UserID.Hex(),
		"mentorship_id": b.MentorshipID.Hex(),
		"action":        action,
	}
}

// holdEscrow puts the session price in the mentee's locked balance until the session is done.
func (s *MentorshipServiceImpl) holdEscrow(ctx context.Context, b *Booking, title string) (*wallet.WalletSummaryResponse, error) {
	_, summary, err := s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        b.UserID,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceLocked,
		Category:      wallet.CategorySessionBooking,
		Amount:        b.Amount,
		ReferenceID:   ledgerRef(b.ID, "escrow"),
		Description:   "Held for session: " + title,
		Metadata:      bookingMeta(b, "escrow_hold"),
	})
	return summary, err
}

// BookWithWallet charges the wallet, holds the money and creates the booking as one step.
func (s *MentorshipServiceImpl) BookWithWallet(ctx context.Context, userID string, req BookWithWalletRequest) (*Booking, *wallet.WalletSummaryResponse, error) {
	uid, err := bookingUser(userID)
	if err != nil {
		return nil, nil, err
	}
	m, err := s.bookable(ctx, uid, req.MentorshipID, req.ScheduledAt)
	if err != nil {
		return nil, nil, err
	}

	var created *Booking
	var summary *wallet.WalletSummaryResponse
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		created, err = s.repo.CreateBooking(ctx, &Booking{
			MentorshipID:  m.ID,
			ExpertID:      m.ExpertID,
			UserID:        uid,
			ScheduledAt:   req.ScheduledAt,
			Status:        BookingConfirmed,
			Amount:        m.Price,
			PaymentStatus: "paid",
			PaymentMethod: methodWallet,
			Notes:         req.Notes,
		})
		if err != nil {
			return err
		}
		if _, _, err = s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
			UserID:        uid,
			Type:          wallet.TypeDebit,
			TargetBalance: wallet.BalanceMain,
			Category:      wallet.CategorySessionBooking,
			Amount:        m.Price,
			ReferenceID:   ledgerRef(created.ID, "pay"),
			Description:   "Session booked: " + m.Title,
			Metadata:      bookingMeta(created, "wallet_payment"),
		}); err != nil {
			return err
		}
		summary, err = s.holdEscrow(ctx, created, m.Title)
		return err
	})
	if err != nil {
		return nil, nil, err
	}

	go s.notifyExpertBooked(created, m.Title)
	return created, summary, nil
}

// CreateBookingOrder opens a checkout. The booking only exists once the payment has arrived.
func (s *MentorshipServiceImpl) CreateBookingOrder(ctx context.Context, userID string, req CreateMentorshipOrderRequest) (*CreateMentorshipOrderResponse, error) {
	uid, err := bookingUser(userID)
	if err != nil {
		return nil, err
	}
	m, err := s.bookable(ctx, uid, req.MentorshipID, req.ScheduledAt)
	if err != nil {
		return nil, err
	}

	bookingID := primitive.NewObjectID().Hex()
	checkout, _, err := s.payments.CreateOrder(ctx, payment.CreateOrderInput{
		UserID:      uid,
		Purpose:     payment.PurposeMentorshipBooking,
		AmountPaise: money.ToPaise(m.Price),
		TargetID:    bookingID,
		Description: "Session: " + m.Title,
		Details: map[string]string{
			"mentorship_id": m.ID.Hex(),
			"scheduled_at":  req.ScheduledAt.UTC().Format(time.RFC3339),
			"notes":         req.Notes,
		},
	})
	if err != nil {
		return nil, err
	}

	return &CreateMentorshipOrderResponse{
		BookingID:   bookingID,
		OrderID:     checkout.OrderID,
		Amount:      checkout.Amount,
		AmountPaise: checkout.AmountPaise,
		Currency:    checkout.Currency,
		KeyID:       checkout.KeyID,
	}, nil
}

func (s *MentorshipServiceImpl) fulfillBooking(ctx context.Context, order *payment.Order) error {
	m, err := s.repo.GetMentorshipByID(ctx, order.Details["mentorship_id"])
	if err != nil || m == nil {
		return payment.Unfulfillable("This session is no longer available")
	}
	scheduledAt, err := time.Parse(time.RFC3339, order.Details["scheduled_at"])
	if err != nil {
		return payment.Unfulfillable("The session time could not be read")
	}
	bookingID, err := primitive.ObjectIDFromHex(order.TargetID)
	if err != nil {
		return payment.Unfulfillable("The booking could not be created")
	}

	created, err := s.repo.CreateBooking(ctx, &Booking{
		ID:                bookingID,
		MentorshipID:      m.ID,
		ExpertID:          m.ExpertID,
		UserID:            order.UserID,
		ScheduledAt:       scheduledAt,
		Status:            BookingConfirmed,
		Amount:            order.Amount(),
		PaymentStatus:     "paid",
		PaymentMethod:     methodRazorpay,
		RazorpayOrderID:   order.RazorpayOrderID,
		RazorpayPaymentID: order.RazorpayPaymentID,
		Notes:             order.Details["notes"],
	})
	if err != nil {
		return err
	}
	_, err = s.holdEscrow(ctx, created, m.Title)
	return err
}

func (s *MentorshipServiceImpl) afterBookingPaid(order *payment.Order) {
	ctx := context.Background()
	b, err := s.repo.GetBookingByID(ctx, order.TargetID)
	if err != nil || b == nil {
		return
	}
	title := "a session"
	if m, _ := s.repo.GetMentorshipByID(ctx, b.MentorshipID.Hex()); m != nil {
		title = m.Title
	}
	s.notifyExpertBooked(b, title)
}

func (s *MentorshipServiceImpl) notifyExpertBooked(b *Booking, title string) {
	s.notify(b.ExpertID, &b.UserID, "mentorship_booked", "New session booked",
		fmt.Sprintf("A candidate booked %s", title), "/expert/mentorship", b.ID.Hex(), b.Status)
}

func (s *MentorshipServiceImpl) notify(to primitive.ObjectID, actor *primitive.ObjectID, kind, title, message, link, bookingID, status string) {
	if s.notifService == nil {
		return
	}
	_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
		UserID:   to,
		ActorID:  actor,
		Type:     kind,
		Category: notification.CategorySystem,
		Title:    title,
		Message:  message,
		Link:     link,
		Metadata: map[string]interface{}{"booking_id": bookingID, "status": status},
	})
}

// VerifyBookingPayment confirms a checkout and returns the booking it created
func (s *MentorshipServiceImpl) VerifyBookingPayment(ctx context.Context, userID string, req VerifyMentorshipPaymentRequest) (*Booking, error) {
	uid, err := bookingUser(userID)
	if err != nil {
		return nil, err
	}
	order, err := s.payments.Confirm(ctx, uid, payment.PurposeMentorshipBooking, payment.ConfirmInput{
		RazorpayOrderID:   req.RazorpayOrderID,
		RazorpayPaymentID: req.RazorpayPaymentID,
		RazorpaySignature: req.RazorpaySignature,
	})
	if err != nil {
		return nil, err
	}
	return s.repo.GetBookingByID(ctx, order.TargetID)
}

// releaseEscrow moves held money to the mentor's earnings. Call inside a transaction, after
// winning the booking's status change.
func (s *MentorshipServiceImpl) releaseEscrow(ctx context.Context, b *Booking) error {
	if b.PaymentStatus != "paid" || money.ToPaise(b.Amount) <= 0 {
		return nil
	}
	if _, _, err := s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        b.UserID,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceLocked,
		Category:      wallet.CategorySessionBooking,
		Amount:        b.Amount,
		ReferenceID:   ledgerRef(b.ID, "release"),
		Description:   "Session completed, payment released",
		Metadata:      bookingMeta(b, "escrow_release"),
	}); err != nil {
		return fmt.Errorf("releasing escrow: %w", err)
	}
	if _, _, err := s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        b.ExpertID,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceEarnings,
		Category:      wallet.CategorySessionPayout,
		Amount:        b.Amount,
		ReferenceID:   ledgerRef(b.ID, "earnings"),
		Description:   "Earnings from a completed session",
		Metadata:      bookingMeta(b, "expert_earnings"),
	}); err != nil {
		return fmt.Errorf("crediting earnings: %w", err)
	}
	return nil
}

// refundEscrow returns held money to where it came from: the wallet, or the original payment
// method through Razorpay. Call inside a transaction, after winning the status change.
func (s *MentorshipServiceImpl) refundEscrow(ctx context.Context, b *Booking, reason string) error {
	if b.PaymentStatus != "paid" || money.ToPaise(b.Amount) <= 0 {
		return nil
	}
	if _, _, err := s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        b.UserID,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceLocked,
		Category:      wallet.CategoryRefund,
		Amount:        b.Amount,
		ReferenceID:   ledgerRef(b.ID, "unhold"),
		Description:   "Hold released for a refunded session",
		Metadata:      bookingMeta(b, "escrow_refund_release"),
	}); err != nil {
		return fmt.Errorf("releasing escrow for refund: %w", err)
	}

	if b.PaymentMethod == methodRazorpay {
		_, err := s.payments.MarkRefundDue(ctx, b.RazorpayOrderID, money.ToPaise(b.Amount), reason)
		return err
	}
	_, _, err := s.walletService.RecordTransaction(ctx, wallet.RecordTransactionInput{
		UserID:        b.UserID,
		Type:          wallet.TypeCredit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategoryRefund,
		Amount:        b.Amount,
		ReferenceID:   ledgerRef(b.ID, "refund"),
		Description:   "Refund for a cancelled session",
		Metadata:      bookingMeta(b, "mentee_refund"),
	})
	return err
}

func (s *MentorshipServiceImpl) completeAndRelease(ctx context.Context, b *Booking, from []string, note string) error {
	return s.tx.Run(ctx, func(ctx context.Context) error {
		moved, err := s.repo.TransitionBooking(ctx, b.ID.Hex(), from, BookingTransition{Status: BookingCompleted, ResolutionNote: note})
		if err != nil {
			return err
		}
		if !moved {
			return ErrBookingMoved
		}
		return s.releaseEscrow(ctx, b)
	})
}

func (s *MentorshipServiceImpl) cancelAndRefund(ctx context.Context, b *Booking, from []string, reason, note string) error {
	paymentStatus := ""
	if b.PaymentStatus == "paid" {
		paymentStatus = "refunded"
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		moved, err := s.repo.TransitionBooking(ctx, b.ID.Hex(), from, BookingTransition{
			Status:         BookingCancelled,
			PaymentStatus:  paymentStatus,
			ResolutionNote: note,
		})
		if err != nil {
			return err
		}
		if !moved {
			return ErrBookingMoved
		}
		return s.refundEscrow(ctx, b, reason)
	})
	if err != nil {
		return err
	}
	// Send a card or UPI refund now; if this fails the recovery job retries it
	if b.PaymentMethod == methodRazorpay && b.PaymentStatus == "paid" {
		if err := s.payments.ProcessRefundByRazorpayOrder(ctx, b.RazorpayOrderID); err != nil {
			log.Printf("[mentorship] booking %s: refund will be retried: %v", b.ID.Hex(), err)
		}
	}
	return nil
}

// UpdateBookingStatus is the mentor's control. Marking a session done doesn't pay out: it starts
// the mentee's 24 hours to confirm or report a problem.
func (s *MentorshipServiceImpl) UpdateBookingStatus(ctx context.Context, expertID string, bookingID string, status string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return ErrBookingNotFound
	}
	if b.ExpertID.Hex() != expertID {
		return ErrNotYourBooking
	}
	if b.Status == status || (status == BookingCompleted && b.Status == BookingAwaitingConfirmation) {
		return nil
	}

	finalStatus := status
	switch status {
	case BookingConfirmed:
		moved, err := s.repo.TransitionBooking(ctx, bookingID, []string{BookingPending}, BookingTransition{Status: BookingConfirmed})
		if err != nil {
			return err
		}
		if !moved {
			return ErrBookingMoved
		}

	case BookingCompleted:
		if time.Now().Before(b.ScheduledAt) {
			return ErrSessionNotDue
		}
		releaseAfter := time.Now().Add(confirmationWindow)
		finalStatus = BookingAwaitingConfirmation
		moved, err := s.repo.TransitionBooking(ctx, bookingID, []string{BookingConfirmed}, BookingTransition{
			Status:       BookingAwaitingConfirmation,
			ReleaseAfter: &releaseAfter,
		})
		if err != nil {
			return err
		}
		if !moved {
			return ErrBookingMoved
		}

	case BookingCancelled:
		if err := s.cancelAndRefund(ctx, b, []string{BookingPending, BookingConfirmed}, "Cancelled by the mentor", ""); err != nil {
			return err
		}

	default:
		return ErrInvalidBookState
	}

	go s.notify(b.UserID, &b.ExpertID, "mentorship_status", sessionNotificationTitle(finalStatus),
		sessionNotificationMessage(finalStatus), "/mentorship/my-sessions", bookingID, finalStatus)
	return nil
}

func sessionNotificationTitle(status string) string {
	switch status {
	case BookingAwaitingConfirmation:
		return "Please confirm your session"
	case BookingCancelled:
		return "Session cancelled"
	case BookingCompleted:
		return "Session completed"
	}
	return "Session confirmed"
}

func sessionNotificationMessage(status string) string {
	switch status {
	case BookingAwaitingConfirmation:
		return "Your mentor marked the session as done. Confirm it, or report a problem within 24 hours."
	case BookingCancelled:
		return "Your session was cancelled and your money is being refunded."
	case BookingCompleted:
		return "Your session is complete."
	}
	return "Your session has been confirmed."
}

// ConfirmSession is the mentee agreeing the session happened, which pays the mentor straight away
func (s *MentorshipServiceImpl) ConfirmSession(ctx context.Context, userID string, bookingID string) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return ErrBookingNotFound
	}
	if b.UserID.Hex() != userID {
		return ErrNotYourBooking
	}
	if err := s.completeAndRelease(ctx, b, []string{BookingAwaitingConfirmation}, ""); err != nil {
		return err
	}
	go s.notify(b.ExpertID, &b.UserID, "mentorship_status", "Session confirmed",
		"The mentee confirmed your session and your earnings have been added.", "/wallet", bookingID, BookingCompleted)
	return nil
}

// ReportSession stops the automatic payment until an admin has looked at the problem
func (s *MentorshipServiceImpl) ReportSession(ctx context.Context, userID string, bookingID string, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return ErrReasonRequired
	}
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return ErrBookingNotFound
	}
	if b.UserID.Hex() != userID {
		return ErrNotYourBooking
	}
	if b.Status == BookingConfirmed && time.Now().Before(b.ScheduledAt) {
		return ErrSessionNotDue
	}
	moved, err := s.repo.TransitionBooking(ctx, bookingID, []string{BookingConfirmed, BookingAwaitingConfirmation}, BookingTransition{
		Status:       BookingReported,
		ReportReason: reason,
	})
	if err != nil {
		return err
	}
	if !moved {
		return ErrBookingMoved
	}
	go s.notify(b.ExpertID, &b.UserID, "mentorship_status", "A session was reported",
		"The mentee reported a problem with this session. Payment is on hold while we review it.", "/expert/mentorship", bookingID, BookingReported)
	return nil
}

// GetReportedBookings returns sessions waiting for an admin decision, with names filled in
func (s *MentorshipServiceImpl) GetReportedBookings(ctx context.Context) ([]Booking, error) {
	bookings, err := s.repo.ListReportedBookings(ctx)
	if err != nil {
		return nil, err
	}
	for i := range bookings {
		b := &bookings[i]
		if m, _ := s.repo.GetMentorshipByID(ctx, b.MentorshipID.Hex()); m != nil {
			b.MentorshipTitle = m.Title
		}
		if u, _ := s.userRepo.FindUserByID(ctx, b.UserID.Hex()); u != nil {
			b.MenteeName, b.MenteeEmail = strings.TrimSpace(u.Name), u.Email
		}
		if u, _ := s.userRepo.FindUserByID(ctx, b.ExpertID.Hex()); u != nil {
			b.ExpertName = strings.TrimSpace(u.Name)
		}
	}
	return bookings, nil
}

// ResolveReport settles a reported session: pay the mentor, or return the money to the mentee
func (s *MentorshipServiceImpl) ResolveReport(ctx context.Context, adminID string, bookingID string, req ResolveReportRequest) error {
	b, err := s.repo.GetBookingByID(ctx, bookingID)
	if err != nil || b == nil {
		return ErrBookingNotFound
	}
	note := strings.TrimSpace(req.Note)
	log.Printf("[mentorship] admin %s resolving booking %s: %s", adminID, bookingID, req.Action)

	from := []string{BookingReported}
	switch req.Action {
	case "release":
		if err := s.completeAndRelease(ctx, b, from, note); err != nil {
			return err
		}
		go s.notify(b.UserID, nil, "mentorship_status", "Your report was reviewed", "We reviewed your report and paid the mentor for this session.", "/mentorship/my-sessions", bookingID, BookingCompleted)
		go s.notify(b.ExpertID, nil, "mentorship_status", "Report resolved", "The report was resolved in your favour and your earnings have been added.", "/wallet", bookingID, BookingCompleted)
	case "refund":
		if err := s.cancelAndRefund(ctx, b, from, "Session problem upheld by support", note); err != nil {
			return err
		}
		go s.notify(b.UserID, nil, "mentorship_status", "Your report was reviewed", "We upheld your report and your money is being refunded.", "/mentorship/my-sessions", bookingID, BookingCancelled)
		go s.notify(b.ExpertID, nil, "mentorship_status", "Report resolved", "The report was upheld and the session payment was refunded.", "/expert/mentorship", bookingID, BookingCancelled)
	default:
		return ErrInvalidBookState
	}
	return nil
}

// ReleaseDueSessions pays mentors whose mentee neither confirmed nor reported within 24 hours
func (s *MentorshipServiceImpl) ReleaseDueSessions(ctx context.Context) (int, error) {
	due, err := s.repo.ListBookingsDueRelease(ctx, time.Now(), 200)
	if err != nil {
		return 0, err
	}
	released := 0
	for i := range due {
		b := &due[i]
		if err := s.completeAndRelease(ctx, b, []string{BookingAwaitingConfirmation}, ""); err != nil {
			if !errors.Is(err, ErrBookingMoved) {
				log.Printf("[mentorship] booking %s: auto release failed: %v", b.ID.Hex(), err)
			}
			continue
		}
		released++
		s.notify(b.ExpertID, nil, "mentorship_status", "Session earnings added", "Your earnings for this session have been added to your wallet.", "/wallet", b.ID.Hex(), BookingCompleted)
	}
	return released, nil
}
