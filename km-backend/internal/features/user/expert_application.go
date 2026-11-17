package user

import (
	"context"
	"errors"
	"log"
	"regexp"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/notification"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Becoming an Expert (client Q&A Q8–Q12): at least 2 years of experience, PAN and payout
// details, an active ₹99 pass, then our team reviews the application the same day.
// Aadhaar is not collected (client answer Q51, Nov 2026: "PAN and bank check only"), which also
// keeps us clear of UIDAI's Aadhaar storage rules. The PAN is never stored in full: only a masked
// copy, next to the uploaded card, which lives in the private bucket.

const (
	ExpertStatusNone     = ""
	ExpertStatusPending  = "pending"
	ExpertStatusApproved = "approved"
	ExpertStatusRejected = "rejected"

	MinExpertSessionPrice = 99
	MaxExpertSessionPrice = 50000
)

// ExpertCategories are the areas an Expert can mentor in (the Mentorship page filters)
var ExpertCategories = []string{"Interview Prep", "Career Guidance", "Technical Skills", "Soft Skills", "Resume Review", "Entrepreneurship"}

var (
	ErrExpertPassRequired     = apperr.New("EXPERT_PASS_REQUIRED", "an active ₹99 pass is required to apply as an Expert")
	ErrExpertAlreadyApproved  = apperr.New("EXPERT_ALREADY_APPROVED", "you are already a verified Expert")
	ErrExpertAlreadyPending   = apperr.New("EXPERT_APPLICATION_PENDING", "your Expert application is already under review")
	ErrExpertCategoryInvalid  = apperr.New("EXPERT_CATEGORY_INVALID", "choose an expertise area from the list")
	ErrExpertBioLength        = apperr.New("EXPERT_BIO_LENGTH", "describe your expertise in 50 to 1000 characters")
	ErrExpertPriceInvalid     = apperr.New("EXPERT_PRICE_INVALID", "set a session price between ₹99 and ₹50,000")
	ErrPANInvalid             = apperr.New("PAN_INVALID", "enter a valid PAN, like ABCDE1234F")
	ErrKYCDocumentRequired    = apperr.New("KYC_DOCUMENT_REQUIRED", "upload a photo of your PAN card")
	ErrPayoutMethodInvalid    = apperr.New("PAYOUT_METHOD_INVALID", "choose bank account or UPI for payouts")
	ErrAccountHolderRequired  = apperr.New("ACCOUNT_HOLDER_REQUIRED", "enter the account holder's name as on the bank account")
	ErrBankAccountInvalid     = apperr.New("BANK_ACCOUNT_INVALID", "enter a valid bank account number (9 to 18 digits)")
	ErrBankAccountMismatch    = apperr.New("BANK_ACCOUNT_MISMATCH", "the two account numbers don't match")
	ErrIFSCInvalid            = apperr.New("IFSC_INVALID", "enter a valid IFSC code, like SBIN0001234")
	ErrUPIInvalid             = apperr.New("UPI_INVALID", "enter a valid UPI ID, like name@bank")
	ErrExpertReviewStatus     = apperr.New("EXPERT_REVIEW_STATUS_INVALID", "status must be approved or rejected")
	ErrExpertRejectReason     = apperr.New("EXPERT_REJECT_REASON_REQUIRED", "give the applicant a reason for the rejection")
	ErrExpertNoPendingRequest = apperr.New("EXPERT_NOT_PENDING", "this user has no Expert application waiting for review")
)

// ExpertKYC is the identity and payout part of an Expert application. Only masked values leave
// the server; the full account number is kept for payouts and never sent to clients.
type ExpertKYC struct {
	PANMasked string `bson:"pan_masked" json:"pan_masked"` // XXXXX1234X
	PANDocURL string `bson:"pan_doc_url" json:"pan_doc_url"`
	// Only on applications sent before Aadhaar stopped being collected (Nov 2026)
	AadhaarLast4  string `bson:"aadhaar_last4,omitempty" json:"aadhaar_last4,omitempty"`
	AadhaarDocURL string `bson:"aadhaar_doc_url,omitempty" json:"aadhaar_doc_url,omitempty"`

	PayoutMethod  string `bson:"payout_method" json:"payout_method"` // "bank" or "upi"
	AccountHolder string `bson:"account_holder" json:"account_holder"`
	AccountNumber string `bson:"account_number,omitempty" json:"-"`
	AccountLast4  string `bson:"account_last4,omitempty" json:"account_last4,omitempty"`
	IFSC          string `bson:"ifsc,omitempty" json:"ifsc,omitempty"`
	UPIID         string `bson:"upi_id,omitempty" json:"upi_id,omitempty"`

	SubmittedAt     time.Time  `bson:"submitted_at" json:"submitted_at"`
	ReviewedAt      *time.Time `bson:"reviewed_at,omitempty" json:"reviewed_at,omitempty"`
	ReviewedBy      string     `bson:"reviewed_by,omitempty" json:"-"`
	RejectionReason string     `bson:"rejection_reason,omitempty" json:"rejection_reason,omitempty"`
}

type ApplyExpertRequest struct {
	ExpertCategory string  `json:"expert_category"`
	ExpertBio      string  `json:"expert_bio"`
	ExpertPricing  float64 `json:"expert_pricing"`

	PANNumber string `json:"pan_number"`
	PANDocURL string `json:"pan_doc_url"`

	PayoutMethod         string `json:"payout_method"`
	AccountHolder        string `json:"account_holder"`
	AccountNumber        string `json:"account_number"`
	ConfirmAccountNumber string `json:"confirm_account_number"`
	IFSC                 string `json:"ifsc"`
	UPIID                string `json:"upi_id"`
}

type ApproveExpertRequest struct {
	Status string `json:"status"` // "approved" or "rejected"
	Reason string `json:"reason"` // required when rejecting; shown to the applicant
}

// ExpertApplicationStatus is what the apply page needs to show the right step
type ExpertApplicationStatus struct {
	Status          string     `json:"status"` // "", pending, approved, rejected
	ExperienceYears float64    `json:"experience_years"`
	MinYears        float64    `json:"min_years"`
	HasPass         bool       `json:"has_pass"`
	Categories      []string   `json:"categories"`
	ExpertCategory  string     `json:"expert_category,omitempty"`
	ExpertBio       string     `json:"expert_bio,omitempty"`
	ExpertPricing   float64    `json:"expert_pricing,omitempty"`
	KYC             *ExpertKYC `json:"kyc,omitempty"`
}

var (
	panPattern     = regexp.MustCompile(`^[A-Z]{5}[0-9]{4}[A-Z]$`)
	ifscPattern    = regexp.MustCompile(`^[A-Z]{4}0[A-Z0-9]{6}$`)
	upiPattern     = regexp.MustCompile(`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`)
	accountPattern = regexp.MustCompile(`^[0-9]{9,18}$`)
	spaces         = strings.NewReplacer(" ", "", "-", "")
)

func containsString(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

// normalise trims and validates the request, returning the KYC to store
func (req *ApplyExpertRequest) normalise() (*ExpertKYC, error) {
	req.ExpertCategory = strings.TrimSpace(req.ExpertCategory)
	req.ExpertBio = strings.TrimSpace(req.ExpertBio)
	if !containsString(ExpertCategories, req.ExpertCategory) {
		return nil, ErrExpertCategoryInvalid
	}
	if n := len([]rune(req.ExpertBio)); n < 50 || n > 1000 {
		return nil, ErrExpertBioLength
	}
	if req.ExpertPricing < MinExpertSessionPrice || req.ExpertPricing > MaxExpertSessionPrice {
		return nil, ErrExpertPriceInvalid
	}

	pan := strings.ToUpper(spaces.Replace(strings.TrimSpace(req.PANNumber)))
	if !panPattern.MatchString(pan) {
		return nil, ErrPANInvalid
	}
	if req.PANDocURL == "" {
		return nil, ErrKYCDocumentRequired
	}

	kyc := &ExpertKYC{
		PANMasked:     "XXXXX" + pan[5:9] + "X",
		PANDocURL:     req.PANDocURL,
		PayoutMethod:  req.PayoutMethod,
		AccountHolder: strings.TrimSpace(req.AccountHolder),
		SubmittedAt:   time.Now(),
	}
	if kyc.AccountHolder == "" {
		return nil, ErrAccountHolderRequired
	}
	switch req.PayoutMethod {
	case "bank":
		account := spaces.Replace(strings.TrimSpace(req.AccountNumber))
		if !accountPattern.MatchString(account) {
			return nil, ErrBankAccountInvalid
		}
		if account != spaces.Replace(strings.TrimSpace(req.ConfirmAccountNumber)) {
			return nil, ErrBankAccountMismatch
		}
		ifsc := strings.ToUpper(strings.TrimSpace(req.IFSC))
		if !ifscPattern.MatchString(ifsc) {
			return nil, ErrIFSCInvalid
		}
		kyc.AccountNumber = account
		kyc.AccountLast4 = account[len(account)-4:]
		kyc.IFSC = ifsc
	case "upi":
		upi := strings.TrimSpace(req.UPIID)
		if !upiPattern.MatchString(upi) {
			return nil, ErrUPIInvalid
		}
		kyc.UPIID = strings.ToLower(upi)
	default:
		return nil, ErrPayoutMethodInvalid
	}
	return kyc, nil
}

func (s *UserServiceImpl) GetExpertApplication(ctx context.Context, userID string) (*ExpertApplicationStatus, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	hasPass, err := s.repo.HasActivePass(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &ExpertApplicationStatus{
		Status:          user.ExpertApprovalStatus,
		ExperienceYears: ExperienceYears(user),
		MinYears:        MinExpertExperienceYears,
		HasPass:         hasPass,
		Categories:      ExpertCategories,
		ExpertCategory:  user.ExpertCategory,
		ExpertBio:       user.ExpertBio,
		ExpertPricing:   user.ExpertPricing,
		KYC:             user.ExpertKYC,
	}, nil
}

func (s *UserServiceImpl) ApplyForExpert(ctx context.Context, userID string, req ApplyExpertRequest) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	switch user.ExpertApprovalStatus {
	case ExpertStatusApproved:
		return nil, ErrExpertAlreadyApproved
	case ExpertStatusPending:
		return nil, ErrExpertAlreadyPending
	}

	// 1. Minimum 2 years of experience (from the profile, never from the request body)
	if ExperienceYears(user) < MinExpertExperienceYears {
		return nil, ErrExpertExperienceRequired
	}

	// 2. Active ₹99 pass
	hasPass, err := s.repo.HasActivePass(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !hasPass {
		return nil, ErrExpertPassRequired
	}

	// 3. Details, identity and payout
	kyc, err := req.normalise()
	if err != nil {
		return nil, err
	}
	// The PAN card must be this user's own private upload
	ok, err := s.repo.OwnsPrivateFile(ctx, userID, kyc.PANDocURL, "expert_document")
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrKYCDocumentRequired
	}

	user.ExpertCategory = req.ExpertCategory
	user.ExpertBio = req.ExpertBio
	user.ExpertPricing = req.ExpertPricing
	user.ExpertKYC = kyc
	user.ExpertDocuments = []Document{{Name: "PAN card", URL: kyc.PANDocURL}}
	user.ExpertApprovalStatus = ExpertStatusPending

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) ApproveExpert(ctx context.Context, adminID string, targetUserID string, req ApproveExpertRequest) (*User, error) {
	if req.Status != ExpertStatusApproved && req.Status != ExpertStatusRejected {
		return nil, ErrExpertReviewStatus
	}
	reason := strings.TrimSpace(req.Reason)
	if req.Status == ExpertStatusRejected && reason == "" {
		return nil, ErrExpertRejectReason
	}

	user, err := s.repo.FindUserByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	if user.ExpertApprovalStatus != ExpertStatusPending {
		return nil, ErrExpertNoPendingRequest
	}

	now := time.Now()
	user.ExpertApprovalStatus = req.Status
	if user.ExpertKYC != nil {
		user.ExpertKYC.ReviewedAt = &now
		user.ExpertKYC.ReviewedBy = adminID
		user.ExpertKYC.RejectionReason = ""
	}
	if req.Status == ExpertStatusApproved {
		if !containsString(user.Roles, RoleExpert) {
			user.Roles = append(user.Roles, RoleExpert)
		}
	} else if user.ExpertKYC != nil {
		user.ExpertKYC.RejectionReason = reason
	}

	updated, err := s.repo.UpdateUser(ctx, user)
	if err != nil {
		return nil, err
	}
	s.notifyExpertDecision(user.ID, req.Status, reason)
	return updated, nil
}

// notifyExpertDecision tells the applicant the outcome in the app (bell, live update and push)
func (s *UserServiceImpl) notifyExpertDecision(userID primitive.ObjectID, status, reason string) {
	if s.notifier == nil {
		return
	}
	req := notification.CreateNotificationRequest{
		UserID:   userID,
		Type:     notification.TypeExpertApplication,
		Category: notification.CategorySystem,
		Link:     "/expert/apply",
		Metadata: map[string]interface{}{"status": status},
	}
	if status == ExpertStatusApproved {
		req.Title = "You're now a verified Expert"
		req.Message = "Your Expert application is approved. Create your sessions and set your availability to start taking bookings."
	} else {
		req.Title = "Your Expert application needs changes"
		req.Message = "Reason: " + reason + " Update your details and resubmit."
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := s.notifier.CreateNotification(ctx, req); err != nil {
			log.Printf("expert decision notification for %s: %v", userID.Hex(), err)
		}
	}()
}

// validationStatus answers 400 for a coded (user-facing) error and 500 for anything else
func validationStatus(err error) int {
	if apperr.CodeOf(err) != "" {
		return 400
	}
	return 500
}
