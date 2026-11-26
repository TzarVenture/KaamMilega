package wallet

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/common/money"
	"km-backend/internal/database"
	"km-backend/internal/features/payment"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// Refunds of unspent top-up money (client answer Q11). A member asks for all of their unspent
// top-up money at once. It is held out of the main balance until an admin decides; on approval it
// goes back to the original payments through Razorpay, newest top-up first. The company pays
// Razorpay's fee, so the member gets the full amount. Razorpay only refunds payments up to 6
// months old: older top-ups stay spendable but can't be refunded.

const (
	// Top-ups paid within this window can be asked back. It is shorter than Razorpay's limit, so a
	// request still fits when the admin approves it a few days later.
	TopupRefundRequestWindow = 170 * 24 * time.Hour
	// When the admin approves, top-ups older than this can't go back through Razorpay any more
	TopupRefundApproveWindow = 179 * 24 * time.Hour
	TopupRefundWindowDays    = 180
)

type TopupRefundStatus string

const (
	TopupRefundRequested TopupRefundStatus = "requested"
	TopupRefundRefunded  TopupRefundStatus = "refunded"
	TopupRefundRejected  TopupRefundStatus = "rejected"
)

var (
	ErrNothingToRefund     = apperr.New("TOPUP_REFUND_NOTHING", "there's no unspent top-up money that can be refunded")
	ErrTopupRefundOpen     = apperr.New("TOPUP_REFUND_ALREADY_OPEN", "you already have a refund request waiting")
	ErrTopupRefundNotFound = apperr.New("TOPUP_REFUND_NOT_FOUND", "refund request not found")
	ErrTopupRefundState    = apperr.New("TOPUP_REFUND_INVALID_STATE", "this refund request has already been decided, please refresh")
	ErrTopupRefundReason   = apperr.New("TOPUP_REFUND_REASON_REQUIRED", "enter why this refund is rejected")
)

// TopupRefundPart is how much of one top-up payment was refunded
type TopupRefundPart struct {
	OrderID         string  `json:"order_id"`
	RazorpayOrderID string  `json:"razorpay_order_id"`
	Paise           int64   `json:"paise"`
	Amount          float64 `json:"amount"`
}

// TopupRefund is a member's request to get their unspent top-up money back
type TopupRefund struct {
	ID            primitive.ObjectID `json:"id"`
	UserID        primitive.ObjectID `json:"user_id"`
	AmountPaise   int64              `json:"-"`
	Amount        float64            `json:"amount"`
	Status        TopupRefundStatus  `json:"status"`
	ReferenceID   string             `json:"reference_id"`
	RefundedPaise int64              `json:"-"`
	Refunded      float64            `json:"refunded"`
	Parts         []TopupRefundPart  `json:"parts"`
	Reason        string             `json:"reason,omitempty"`
	RejectReason  string             `json:"reject_reason,omitempty"`
	HandledBy     string             `json:"handled_by,omitempty"`
	CreatedAt     time.Time          `json:"created_at"`
	DecidedAt     *time.Time         `json:"decided_at,omitempty"`

	// Filled in for the admin list
	UserName  string `json:"user_name,omitempty"`
	UserEmail string `json:"user_email,omitempty"`
}

// TopupRefundInfo is what the member sees before asking for a refund
type TopupRefundInfo struct {
	MainBalance   float64 `json:"main_balance"`
	Refundable    float64 `json:"refundable"`
	NotRefundable float64 `json:"not_refundable"` // In the main balance, but from top-ups too old to refund
	WindowDays    int     `json:"window_days"`
	// The waiting request, or the latest decided one so the member sees what happened
	Latest *TopupRefund `json:"latest,omitempty"`
}

type TopupRefundRequest struct {
	Reason string `json:"reason"`
}

type RejectTopupRefundRequest struct {
	Reason string `json:"reason"`
}

type TopupRefundQuery struct {
	Status TopupRefundStatus
	Page   int
	Limit  int
}

type TopupRefundListResponse struct {
	Refunds    []TopupRefund `json:"refunds"`
	Total      int64         `json:"total"`
	Page       int           `json:"page"`
	Limit      int           `json:"limit"`
	TotalPages int           `json:"total_pages"`
}

// TopupRefundRepository is the storage part of top-up refunds
type TopupRefundRepository interface {
	CreateTopupRefund(ctx context.Context, r *TopupRefund) error
	GetTopupRefund(ctx context.Context, id primitive.ObjectID) (*TopupRefund, error)
	LatestTopupRefund(ctx context.Context, userID primitive.ObjectID) (*TopupRefund, error)
	// DecideTopupRefund moves a waiting request to refunded or rejected; false if it was already decided
	DecideTopupRefund(ctx context.Context, id primitive.ObjectID, status TopupRefundStatus, adminID, rejectReason string, at time.Time) (bool, error)
	// DecideTopupRefundAgain changes a decision made earlier in the same transaction
	DecideTopupRefundAgain(ctx context.Context, id primitive.ObjectID, status TopupRefundStatus, adminID, rejectReason string, at time.Time) error
	SetTopupRefundResult(ctx context.Context, id primitive.ObjectID, refundedPaise int64, parts []TopupRefundPart) error
	ListTopupRefunds(ctx context.Context, query TopupRefundQuery) ([]TopupRefund, int64, error)
}

func topupRefundReference(id primitive.ObjectID) string { return "topup_refund:" + id.Hex() }

// ---------------------------------------------------------------------------------------------
// Service

// refundablePaise is how much of the main balance can still go back through Razorpay
func (s *WalletServiceImpl) refundablePaise(ctx context.Context, userID primitive.ObjectID, mainPaise int64, window time.Duration) (int64, []payment.Order, error) {
	orders, err := s.payments.ListPaidSince(ctx, userID, payment.PurposeWalletTopup, time.Now().Add(-window))
	if err != nil {
		return 0, nil, err
	}
	var paid int64
	for _, o := range orders {
		paid += o.AmountPaise
	}
	return min(paid, mainPaise), orders, nil
}

// GetTopupRefundInfo tells the member how much they can get back, and their latest request
func (s *WalletServiceImpl) GetTopupRefundInfo(ctx context.Context, userID string) (*TopupRefundInfo, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	w, err := s.repo.GetOrCreateWallet(ctx, oid)
	if err != nil {
		return nil, err
	}
	refundable, _, err := s.refundablePaise(ctx, oid, w.MainPaise, TopupRefundRequestWindow)
	if err != nil {
		return nil, err
	}
	latest, err := s.repo.LatestTopupRefund(ctx, oid)
	if err != nil {
		return nil, err
	}
	return &TopupRefundInfo{
		MainBalance:   money.ToRupees(w.MainPaise),
		Refundable:    money.ToRupees(refundable),
		NotRefundable: money.ToRupees(w.MainPaise - refundable),
		WindowDays:    TopupRefundWindowDays,
		Latest:        latest,
	}, nil
}

// RequestTopupRefund holds all of the member's refundable top-up money until an admin decides
func (s *WalletServiceImpl) RequestTopupRefund(ctx context.Context, userID string, req TopupRefundRequest) (*TopupRefund, error) {
	oid, err := parseUserID(userID)
	if err != nil {
		return nil, err
	}
	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) > 300 {
		return nil, apperr.New("TOPUP_REFUND_REASON_TOO_LONG", "keep the reason under 300 characters")
	}

	now := time.Now()
	refund := &TopupRefund{
		ID:        primitive.NewObjectID(),
		UserID:    oid,
		Status:    TopupRefundRequested,
		Reason:    reason,
		CreatedAt: now,
	}
	refund.ReferenceID = topupRefundReference(refund.ID)

	err = s.tx.Run(ctx, func(ctx context.Context) error {
		w, err := s.repo.LockWallet(ctx, oid)
		if err != nil {
			return err
		}
		if w.Status == WalletFrozen || w.Status == WalletSuspended {
			return ErrFrozen
		}
		if w.Status == WalletClosed {
			return ErrClosed
		}
		latest, err := s.repo.LatestTopupRefund(ctx, oid)
		if err != nil {
			return err
		}
		if latest != nil && latest.Status == TopupRefundRequested {
			return ErrTopupRefundOpen
		}
		paise, _, err := s.refundablePaise(ctx, oid, w.MainPaise, TopupRefundRequestWindow)
		if err != nil {
			return err
		}
		if paise <= 0 {
			return ErrNothingToRefund
		}
		refund.AmountPaise = paise
		refund.Amount = money.ToRupees(paise)

		_, _, err = s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
			UserID:        oid,
			Type:          TypeDebit,
			TargetBalance: BalanceMain,
			Category:      CategoryRefund,
			Amount:        refund.Amount,
			ReferenceID:   refund.ReferenceID,
			Description:   "Refund of unspent money requested",
			Status:        StatusPending,
			Metadata:      map[string]interface{}{"topup_refund_id": refund.ID.Hex()},
		})
		if err != nil {
			return err
		}
		return s.repo.CreateTopupRefund(ctx, refund)
	})
	if err != nil {
		return nil, err
	}

	go s.notify(oid, "wallet_refund", "Refund requested",
		fmt.Sprintf("We've received your request to refund %s. It goes back to your original payment method once approved.", money.INR(refund.AmountPaise)),
		map[string]interface{}{"reference_id": refund.ReferenceID, "amount": refund.Amount})
	go s.alertAdminOfTopupRefund(refund)
	return refund, nil
}

// alertAdminOfTopupRefund emails the admin, so a request is decided while Razorpay can still refund it
func (s *WalletServiceImpl) alertAdminOfTopupRefund(r *TopupRefund) {
	if s.mailer == nil || s.cfg == nil || s.cfg.SMTPFromEmail == "" {
		return
	}
	email, name, _ := s.repo.GetUserContact(context.Background(), r.UserID)
	who := html.EscapeString(strings.TrimSpace(name + " " + email))
	if who == "" {
		who = r.UserID.Hex()
	}
	body := fmt.Sprintf(`<p>%s asked for a refund of their unspent wallet money: <strong>%s</strong>.</p>
<p>Please approve or decline it in the admin panel under Money &gt; Top-up refunds within a week. Razorpay can only refund payments up to 6 months old.</p>`,
		who, money.INR(r.AmountPaise))
	if err := s.mailer.SendRaw(s.cfg.SMTPFromEmail, "Wallet refund request: "+money.INR(r.AmountPaise), body); err != nil {
		log.Printf("[wallet] top-up refund %s: admin email failed: %v", r.ID.Hex(), err)
	}
}

func (s *WalletServiceImpl) topupRefundByID(ctx context.Context, id string) (*TopupRefund, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, ErrTopupRefundNotFound
	}
	r, err := s.repo.GetTopupRefund(ctx, oid)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, ErrTopupRefundNotFound
	}
	return r, nil
}

// ApproveTopupRefund sends the held money back through Razorpay, newest top-up first. Any part
// whose top-up has passed Razorpay's limit while the request waited goes back to the wallet.
func (s *WalletServiceImpl) ApproveTopupRefund(ctx context.Context, id, adminID string) (*TopupRefund, error) {
	r, err := s.topupRefundByID(ctx, id)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var parts []TopupRefundPart
	var refunded int64
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		parts, refunded = nil, 0
		moved, err := s.repo.DecideTopupRefund(ctx, r.ID, TopupRefundRefunded, adminID, "", now)
		if err != nil {
			return err
		}
		if !moved {
			return ErrTopupRefundState
		}
		orders, err := s.payments.ListPaidSince(ctx, r.UserID, payment.PurposeWalletTopup, now.Add(-TopupRefundApproveWindow))
		if err != nil {
			return err
		}
		remaining := r.AmountPaise
		for _, o := range orders {
			if remaining == 0 {
				break
			}
			take := min(remaining, o.AmountPaise)
			if _, err := s.payments.MarkRefundDue(ctx, o.RazorpayOrderID, take, "Refund of unspent wallet money"); err != nil {
				return err
			}
			parts = append(parts, TopupRefundPart{OrderID: o.ID.Hex(), RazorpayOrderID: o.RazorpayOrderID, Paise: take, Amount: money.ToRupees(take)})
			remaining -= take
		}
		refunded = r.AmountPaise - remaining

		if refunded == 0 {
			// Nothing can go back through Razorpay any more: the request becomes a rejection
			if err := s.repo.DecideTopupRefundAgain(ctx, r.ID, TopupRefundRejected, adminID,
				"These top-ups are older than 6 months, so they can't be refunded. The money is back in your wallet.", now); err != nil {
				return err
			}
			return s.returnHeldRefund(ctx, r, r.AmountPaise, "Refund not possible, money returned to your wallet")
		}
		if err := s.repo.SetTopupRefundResult(ctx, r.ID, refunded, parts); err != nil {
			return err
		}
		if err := s.repo.SetTransactionStatus(ctx, r.ReferenceID, StatusCompleted); err != nil {
			return err
		}
		if remaining > 0 {
			_, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
				UserID:        r.UserID,
				Type:          TypeCredit,
				TargetBalance: BalanceMain,
				Category:      CategoryRefund,
				Amount:        money.ToRupees(remaining),
				ReferenceID:   r.ReferenceID + ":returned",
				Description:   "Part of your refund was from top-ups older than 6 months, returned to your wallet",
				Metadata:      map[string]interface{}{"topup_refund_id": r.ID.Hex()},
			})
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Sent after the commit; the payment recovery job retries any that fail
	for _, p := range parts {
		if err := s.payments.ProcessRefundByRazorpayOrder(ctx, p.RazorpayOrderID); err != nil {
			log.Printf("[wallet] top-up refund %s: order %s will be retried: %v", r.ID.Hex(), p.RazorpayOrderID, err)
		}
	}
	if refunded > 0 {
		go s.notify(r.UserID, "wallet_refund", "Refund approved",
			fmt.Sprintf("%s is on its way back to your original payment method. Banks usually take 5 to 7 working days.", money.INR(refunded)),
			map[string]interface{}{"reference_id": r.ReferenceID, "amount": money.ToRupees(refunded)})
	} else {
		go s.notify(r.UserID, "wallet_refund", "Refund not possible",
			"Your top-ups are older than 6 months, so they can't be refunded. The money is back in your wallet.",
			map[string]interface{}{"reference_id": r.ReferenceID})
	}
	return s.repo.GetTopupRefund(ctx, r.ID)
}

// RejectTopupRefund puts the held money back in the member's wallet
func (s *WalletServiceImpl) RejectTopupRefund(ctx context.Context, id, adminID string, req RejectTopupRefundRequest) (*TopupRefund, error) {
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, ErrTopupRefundReason
	}
	if len([]rune(reason)) > 300 {
		return nil, apperr.New("TOPUP_REFUND_REASON_TOO_LONG", "keep the reason under 300 characters")
	}
	r, err := s.topupRefundByID(ctx, id)
	if err != nil {
		return nil, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		moved, err := s.repo.DecideTopupRefund(ctx, r.ID, TopupRefundRejected, adminID, reason, time.Now())
		if err != nil {
			return err
		}
		if !moved {
			return ErrTopupRefundState
		}
		return s.returnHeldRefund(ctx, r, r.AmountPaise, "Refund request declined, money returned to your wallet")
	})
	if err != nil {
		return nil, err
	}
	go s.notify(r.UserID, "wallet_refund", "Refund request declined",
		fmt.Sprintf("Your refund request was declined: %s. %s is back in your wallet.", reason, money.INR(r.AmountPaise)),
		map[string]interface{}{"reference_id": r.ReferenceID})
	return s.repo.GetTopupRefund(ctx, r.ID)
}

// returnHeldRefund marks the hold as reversed and gives the money back to the main balance
func (s *WalletServiceImpl) returnHeldRefund(ctx context.Context, r *TopupRefund, paise int64, description string) error {
	if err := s.repo.SetTransactionStatus(ctx, r.ReferenceID, StatusReversed); err != nil {
		return err
	}
	_, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
		UserID:        r.UserID,
		Type:          TypeCredit,
		TargetBalance: BalanceMain,
		Category:      CategoryRefund,
		Amount:        money.ToRupees(paise),
		ReferenceID:   r.ReferenceID + ":reversal",
		Description:   description,
		Metadata:      map[string]interface{}{"topup_refund_id": r.ID.Hex()},
	})
	return err
}

// GetAdminTopupRefunds lists refund requests for the admin, with each member's name and email
func (s *WalletServiceImpl) GetAdminTopupRefunds(ctx context.Context, query TopupRefundQuery) (*TopupRefundListResponse, error) {
	query.Page, query.Limit = pageOf(query.Page, query.Limit)
	list, total, err := s.repo.ListTopupRefunds(ctx, query)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].UserEmail, list[i].UserName, _ = s.repo.GetUserContact(ctx, list[i].UserID)
	}
	return &TopupRefundListResponse{
		Refunds:    list,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: totalPages(total, query.Limit),
	}, nil
}

// ---------------------------------------------------------------------------------------------
// Storage (Postgres table wallet_topup_refunds)

type topupRefundRow struct {
	ID            string
	UserID        string
	AmountPaise   int64
	Status        string
	ReferenceID   string
	RefundedPaise int64
	Parts         []byte
	Reason        string
	RejectReason  *string
	HandledBy     *string
	CreatedAt     time.Time
	DecidedAt     *time.Time
}

const topupRefundColumns = `id, user_id, amount_paise, status, reference_id, refunded_paise, parts, reason,
	reject_reason, handled_by, created_at, decided_at`

func (row topupRefundRow) toDomain() TopupRefund {
	r := TopupRefund{
		ID:            database.OID(row.ID),
		UserID:        database.OID(row.UserID),
		AmountPaise:   row.AmountPaise,
		Amount:        money.ToRupees(row.AmountPaise),
		Status:        TopupRefundStatus(row.Status),
		ReferenceID:   row.ReferenceID,
		RefundedPaise: row.RefundedPaise,
		Refunded:      money.ToRupees(row.RefundedPaise),
		Parts:         []TopupRefundPart{},
		Reason:        row.Reason,
		CreatedAt:     row.CreatedAt,
		DecidedAt:     row.DecidedAt,
	}
	if row.RejectReason != nil {
		r.RejectReason = *row.RejectReason
	}
	if row.HandledBy != nil {
		r.HandledBy = *row.HandledBy
	}
	if len(row.Parts) > 0 {
		_ = json.Unmarshal(row.Parts, &r.Parts)
	}
	return r
}

func (r *WalletRepositoryImpl) CreateTopupRefund(ctx context.Context, t *TopupRefund) error {
	err := r.conn(ctx).Exec(`INSERT INTO wallet_topup_refunds (id, user_id, wallet_id, amount_paise, status, reference_id, reason, created_at, updated_at)
		SELECT ?, ?, id, ?, ?, ?, ?, ?, ? FROM wallets WHERE user_id = ?`,
		t.ID.Hex(), t.UserID.Hex(), t.AmountPaise, string(t.Status), t.ReferenceID, t.Reason, t.CreatedAt, t.CreatedAt,
		t.UserID.Hex()).Error
	if database.PgConstraint(err) == "wallet_topup_refunds_one_open_idx" {
		return ErrTopupRefundOpen
	}
	return err
}

func (r *WalletRepositoryImpl) topupRefunds(ctx context.Context, where string, args ...interface{}) ([]TopupRefund, error) {
	var rows []topupRefundRow
	if err := r.conn(ctx).Raw(`SELECT `+topupRefundColumns+` FROM wallet_topup_refunds `+where, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	list := make([]TopupRefund, 0, len(rows))
	for _, row := range rows {
		list = append(list, row.toDomain())
	}
	return list, nil
}

func (r *WalletRepositoryImpl) GetTopupRefund(ctx context.Context, id primitive.ObjectID) (*TopupRefund, error) {
	list, err := r.topupRefunds(ctx, `WHERE id = ?`, id.Hex())
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *WalletRepositoryImpl) LatestTopupRefund(ctx context.Context, userID primitive.ObjectID) (*TopupRefund, error) {
	list, err := r.topupRefunds(ctx, `WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`, userID.Hex())
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *WalletRepositoryImpl) DecideTopupRefund(ctx context.Context, id primitive.ObjectID, status TopupRefundStatus, adminID, rejectReason string, at time.Time) (bool, error) {
	res := r.conn(ctx).Exec(`UPDATE wallet_topup_refunds
		SET status = ?, handled_by = ?, reject_reason = ?, decided_at = ?, updated_at = ?
		WHERE id = ? AND status = 'requested'`,
		string(status), nullable(adminID), nullable(rejectReason), at, at, id.Hex())
	return res.RowsAffected == 1, res.Error
}

// DecideTopupRefundAgain changes a decision made earlier in the same transaction
func (r *WalletRepositoryImpl) DecideTopupRefundAgain(ctx context.Context, id primitive.ObjectID, status TopupRefundStatus, adminID, rejectReason string, at time.Time) error {
	return r.conn(ctx).Exec(`UPDATE wallet_topup_refunds
		SET status = ?, handled_by = ?, reject_reason = ?, decided_at = ?, updated_at = ? WHERE id = ?`,
		string(status), nullable(adminID), nullable(rejectReason), at, at, id.Hex()).Error
}

func (r *WalletRepositoryImpl) SetTopupRefundResult(ctx context.Context, id primitive.ObjectID, refundedPaise int64, parts []TopupRefundPart) error {
	raw, err := json.Marshal(parts)
	if err != nil {
		return err
	}
	return r.conn(ctx).Exec(`UPDATE wallet_topup_refunds SET refunded_paise = ?, parts = ?::jsonb, updated_at = now() WHERE id = ?`,
		refundedPaise, string(raw), id.Hex()).Error
}

func (r *WalletRepositoryImpl) ListTopupRefunds(ctx context.Context, query TopupRefundQuery) ([]TopupRefund, int64, error) {
	q := r.conn(ctx).Table("wallet_topup_refunds")
	if query.Status != "" {
		q = q.Where("status = ?", string(query.Status))
	}
	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	limit, offset := pageOffset(query.Page, query.Limit)
	var rows []topupRefundRow
	if err := q.Select(topupRefundColumns).Order("created_at DESC, id DESC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	list := make([]TopupRefund, 0, len(rows))
	for _, row := range rows {
		list = append(list, row.toDomain())
	}
	return list, total, nil
}

// ---------------------------------------------------------------------------------------------
// Controllers

// GetTopupRefundInfo shows how much unspent top-up money the member can get back
func (ctrl *WalletController) GetTopupRefundInfo(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	info, err := ctrl.service.GetTopupRefundInfo(c.Context(), userID)
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(info)
}

// RequestTopupRefund asks for all unspent top-up money back
func (ctrl *WalletController) RequestTopupRefund(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return unauthorized(c)
	}
	var req TopupRefundRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return badBody(c)
		}
	}
	refund, err := ctrl.service.RequestTopupRefund(c.Context(), userID, req)
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(refund)
}

func (ctrl *WalletController) GetAdminTopupRefunds(c *fiber.Ctx) error {
	res, err := ctrl.service.GetAdminTopupRefunds(c.Context(), TopupRefundQuery{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Status: TopupRefundStatus(c.Query("status")),
	})
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(res)
}

func (ctrl *WalletController) ApproveTopupRefund(c *fiber.Ctx) error {
	adminID, _ := currentUser(c)
	refund, err := ctrl.service.ApproveTopupRefund(c.Context(), c.Params("id"), adminID)
	if errors.Is(err, ErrTopupRefundNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	}
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(refund)
}

func (ctrl *WalletController) RejectTopupRefund(c *fiber.Ctx) error {
	adminID, _ := currentUser(c)
	var req RejectTopupRefundRequest
	if err := c.BodyParser(&req); err != nil {
		return badBody(c)
	}
	refund, err := ctrl.service.RejectTopupRefund(c.Context(), c.Params("id"), adminID, req)
	if errors.Is(err, ErrTopupRefundNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(err))
	}
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(refund)
}
