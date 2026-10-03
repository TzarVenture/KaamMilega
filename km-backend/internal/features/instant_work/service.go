package instant_work

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"net/http"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrPassRequired      = errors.New("an active InstantPass (₹99) is required to go Free Now and receive dispatches")
	ErrPassQuotaExhausted = errors.New("your InstantPass quota has been exhausted. Please recharge your pass")
	ErrJobNotFound        = errors.New("instant job not found")
	ErrUnauthorizedJob    = errors.New("unauthorized access to this instant job")
)

type InstantWorkService interface {
	GetCandidateStatus(ctx context.Context, userID primitive.ObjectID) (*CandidateStatusResponse, error)
	ToggleAvailability(ctx context.Context, userID primitive.ObjectID, req ToggleAvailabilityRequest) (*InstantWorker, error)
	UpdateLocation(ctx context.Context, userID primitive.ObjectID, req LocationPingRequest) error
	GetNearbyCandidatesForRecruiter(ctx context.Context, lng, lat float64, radiusKm float64, skill string) ([]NearbyCandidateResult, error)

	PurchasePassWithWallet(ctx context.Context, userID primitive.ObjectID) (*InstantPass, *wallet.WalletSummaryResponse, error)
	CreatePassOrder(ctx context.Context, userID primitive.ObjectID) (*CreatePassOrderResponse, error)
	VerifyPassPayment(ctx context.Context, userID primitive.ObjectID, req VerifyPassPaymentRequest) (*InstantPass, error)

	CreateSpotJob(ctx context.Context, recruiterID primitive.ObjectID, req CreateInstantJobRequest) (*InstantJob, error)
	GetNearbyJobsForCandidate(ctx context.Context, candidateID primitive.ObjectID, lng, lat float64, radiusKm float64, skill string) ([]InstantJob, error)
	ClaimSpotGig(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error)
	GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error)
	GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error)
	CompleteSpotJob(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error)
	CloseSpotJob(ctx context.Context, recruiterID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error)
}

type InstantWorkServiceImpl struct {
	repo          InstantWorkRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	notifService  notification.NotificationService
	cfg           *config.Config
}

func NewInstantWorkService(
	repo InstantWorkRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
	notifService notification.NotificationService,
) InstantWorkService {
	return &InstantWorkServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		notifService:  notifService,
		cfg:           cfg,
	}
}

// GetCandidateStatus returns live availability, skill, and pass quota info
func (s *InstantWorkServiceImpl) GetCandidateStatus(ctx context.Context, userID primitive.ObjectID) (*CandidateStatusResponse, error) {
	worker, err := s.repo.GetWorkerByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	pass, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := &CandidateStatusResponse{
		IsFreeNow:      false,
		QuotaRemaining: 0,
		HasActivePass:  false,
		CurrentLocation: GeoJSONPoint{
			Type:        "Point",
			Coordinates: []float64{72.8777, 19.0760}, // Default Mumbai center
		},
	}

	if pass != nil {
		resp.HasActivePass = true
		resp.QuotaRemaining = pass.QuotaRemaining
		resp.PassExpiresAt = &pass.ExpiresAt
	}

	if worker != nil {
		resp.IsFreeNow = worker.IsFreeNow
		resp.ActiveSkill = worker.ActiveSkill
		resp.HourlyRate = worker.HourlyRate
		if len(worker.Location.Coordinates) == 2 {
			resp.CurrentLocation = worker.Location
		}
		if !worker.LastPingAt.IsZero() {
			resp.LastPingAt = &worker.LastPingAt
		}
	}

	return resp, nil
}

// ToggleAvailability toggles Free Now status (enforces active pass quota)
func (s *InstantWorkServiceImpl) ToggleAvailability(ctx context.Context, userID primitive.ObjectID, req ToggleAvailabilityRequest) (*InstantWorker, error) {
	// If turning availability ON, check active pass quota
	if req.IsFreeNow {
		pass, err := s.repo.GetActivePassByUserID(ctx, userID)
		if err != nil {
			return nil, err
		}
		if pass == nil || !pass.HasActivePass {
			return nil, ErrPassRequired
		}
		if pass.QuotaRemaining <= 0 {
			return nil, ErrPassQuotaExhausted
		}
	}

	// Fetch user details to ensure name and avatar are synced
	u, err := s.userRepo.FindUserByID(ctx, userID.Hex())
	if err != nil {
		return nil, err
	}

	name := "Professional"
	avatar := ""
	mobile := ""
	if u != nil {
		if u.Name != "" {
			name = u.Name
		} else if u.FirstName != "" {
			name = u.FirstName + " " + u.LastName
		}
		avatar = u.ProfileImage
		mobile = u.Mobile
	}

	loc := GeoJSONPoint{
		Type:        "Point",
		Coordinates: []float64{req.Lng, req.Lat},
	}

	existing, _ := s.repo.GetWorkerByUserID(ctx, userID)
	var quotaRemaining int
	pass, _ := s.repo.GetActivePassByUserID(ctx, userID)
	if pass != nil {
		quotaRemaining = pass.QuotaRemaining
	}

	rating := 4.9
	totalGigs := 12
	if existing != nil {
		rating = existing.Rating
		totalGigs = existing.TotalGigs
	}

	worker := &InstantWorker{
		UserID:         userID,
		Name:           name,
		Avatar:         avatar,
		Mobile:         mobile,
		ActiveSkill:    req.Skill,
		HourlyRate:     req.HourlyRate,
		Rating:         rating,
		TotalGigs:      totalGigs,
		Location:       loc,
		IsFreeNow:      req.IsFreeNow,
		LastPingAt:     time.Now(),
		QuotaRemaining: quotaRemaining,
	}

	if err := s.repo.UpsertWorker(ctx, worker); err != nil {
		return nil, err
	}

	return worker, nil
}

// UpdateLocation handles periodic 30s candidate background GPS heartbeats
func (s *InstantWorkServiceImpl) UpdateLocation(ctx context.Context, userID primitive.ObjectID, req LocationPingRequest) error {
	if req.Lat < -90 || req.Lat > 90 || req.Lng < -180 || req.Lng > 180 {
		return errors.New("invalid GPS coordinates")
	}

	loc := GeoJSONPoint{
		Type:        "Point",
		Coordinates: []float64{req.Lng, req.Lat},
	}
	return s.repo.UpdateWorkerPing(ctx, userID, loc)
}

// GetNearbyCandidatesForRecruiter queries active candidates and applies 100-180m privacy jitter
func (s *InstantWorkServiceImpl) GetNearbyCandidatesForRecruiter(ctx context.Context, lng, lat float64, radiusKm float64, skill string) ([]NearbyCandidateResult, error) {
	radiusMeters := radiusKm * 1000.0
	if radiusMeters <= 0 {
		radiusMeters = 5000.0
	}

	candidates, err := s.repo.FindNearbyWorkers(ctx, lng, lat, radiusMeters, skill, 30)
	if err != nil {
		return nil, err
	}

	// Apply 100-180m coordinate jitter for recruiter radar view
	for i := range candidates {
		if len(candidates[i].Location.Coordinates) == 2 {
			cLng := candidates[i].Location.Coordinates[0]
			cLat := candidates[i].Location.Coordinates[1]
			jLng, jLat := jitterCoordinates(cLng, cLat)
			candidates[i].Location.Coordinates = []float64{jLng, jLat}
			candidates[i].IsMasked = true
		}
	}

	return candidates, nil
}

// jitterCoordinates applies a 100-180m random privacy displacement
func jitterCoordinates(lng, lat float64) (float64, float64) {
	nBig, _ := rand.Int(rand.Reader, big.NewInt(80))
	distMeters := 100.0 + float64(nBig.Int64())

	angleBig, _ := rand.Int(rand.Reader, big.NewInt(360))
	angle := float64(angleBig.Int64()) * (math.Pi / 180.0)

	latRad := lat * (math.Pi / 180.0)
	cosLat := math.Cos(latRad)
	if cosLat < 0.0001 {
		cosLat = 1.0
	}

	dLat := (distMeters * math.Cos(angle)) / 111320.0
	dLng := (distMeters * math.Sin(angle)) / (111320.0 * cosLat)

	return lng + dLng, lat + dLat
}

// PurchasePassWithWallet debits ₹99 directly from the user's KaamMilega Wallet ledger
func (s *InstantWorkServiceImpl) PurchasePassWithWallet(ctx context.Context, userID primitive.ObjectID) (*InstantPass, *wallet.WalletSummaryResponse, error) {
	// 1. Verify user wallet balance
	walletSummary, err := s.walletService.GetWalletSummary(ctx, userID.Hex())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to retrieve wallet: %w", err)
	}

	const passPrice = 99.00
	if walletSummary.MainBalance < passPrice {
		return nil, nil, fmt.Errorf("insufficient wallet balance: required ₹%.2f, available ₹%.2f. Please top up your wallet", passPrice, walletSummary.MainBalance)
	}

	// 2. Create and activate the InstantPass
	now := time.Now()
	pass := &InstantPass{
		UserID:            userID,
		HasActivePass:     true,
		QuotaTotal:        10,
		QuotaRemaining:    10,
		PriceINR:          passPrice,
		RazorpayOrderID:   fmt.Sprintf("wallet_pass_%d", now.UnixNano()),
		RazorpayPaymentID: fmt.Sprintf("wallet_pay_%d", now.UnixNano()),
		ActivatedAt:       now,
		ExpiresAt:         now.Add(30 * 24 * time.Hour),
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.CreatePass(ctx, pass); err != nil {
		return nil, nil, err
	}

	// Sync worker quota
	_ = s.repo.UpsertWorker(ctx, &InstantWorker{
		UserID:         userID,
		QuotaRemaining: 10,
		UpdatedAt:      now,
	})

	// 3. Atomically debit user's main wallet balance via immutable ledger
	debitInput := wallet.RecordTransactionInput{
		UserID:        userID,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategoryPassPurchase,
		Amount:        passPrice,
		ReferenceID:   pass.ID.Hex(),
		Description:   "InstantPass Activation (10 Spot Gigs)",
		Metadata: map[string]interface{}{
			"pass_id": pass.ID.Hex(),
			"type":    "instant_pass",
			"quota":   10,
			"channel": "wallet",
		},
	}

	_, updatedSummary, err := s.walletService.RecordTransaction(ctx, debitInput)
	if err != nil {
		return nil, nil, fmt.Errorf("wallet debit transaction failed: %w", err)
	}

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   userID,
				Type:     "instant_pass_activated",
				Category: notification.CategorySystem,
				Title:    "InstantPass Activated",
				Message:  "Your InstantPass (10 spot gigs) is active! You can now accept spot jobs.",
				Link:     "/instant-work",
			})
		}()
	}

	return pass, updatedSummary, nil
}

// CreatePassOrder creates a ₹99 order for 10 instant gig dispatches
func (s *InstantWorkServiceImpl) CreatePassOrder(ctx context.Context, userID primitive.ObjectID) (*CreatePassOrderResponse, error) {
	keyID := s.cfg.RazorpayKeyID
	keySecret := s.cfg.RazorpayKeySecret

	// If Razorpay keys are not configured (e.g. dev environment), generate deterministic mock order
	if keyID == "" || keySecret == "" {
		mockOrderID := fmt.Sprintf("order_mock_pass_%d", time.Now().UnixNano())
		pass := &InstantPass{
			UserID:          userID,
			HasActivePass:   false,
			QuotaTotal:      10,
			QuotaRemaining:  10,
			PriceINR:        99.00,
			RazorpayOrderID: mockOrderID,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		if err := s.repo.CreatePass(ctx, pass); err != nil {
			return nil, err
		}
		return &CreatePassOrderResponse{
			KeyID:   "rzp_mock_key_instant_pass",
			OrderID: mockOrderID,
			Amount:  9900,
			PassINR: 99.00,
		}, nil
	}

	// Call official Razorpay Orders API
	orderPayload := map[string]interface{}{
		"amount":   9900, // ₹99.00 in paise
		"currency": "INR",
		"receipt":  fmt.Sprintf("inst_pass_%d", time.Now().Unix()),
		"notes": map[string]string{
			"user_id": userID.Hex(),
			"type":    "instant_pass",
		},
	}
	bodyBytes, err := json.Marshal(orderPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, err
	}
	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", keyID, keySecret)))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to contact Razorpay API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("razorpay order creation failed with status %d", resp.StatusCode)
	}

	var rzpResp struct {
		ID     string  `json:"id"`
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rzpResp); err != nil {
		return nil, err
	}

	pass := &InstantPass{
		UserID:          userID,
		HasActivePass:   false,
		QuotaTotal:      10,
		QuotaRemaining:  10,
		PriceINR:        99.00,
		RazorpayOrderID: rzpResp.ID,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	if err := s.repo.CreatePass(ctx, pass); err != nil {
		return nil, err
	}

	return &CreatePassOrderResponse{
		KeyID:   keyID,
		OrderID: rzpResp.ID,
		Amount:  9900,
		PassINR: 99.00,
	}, nil
}

// VerifyPassPayment validates HMAC signature and activates the ₹99 pass
func (s *InstantWorkServiceImpl) VerifyPassPayment(ctx context.Context, userID primitive.ObjectID, req VerifyPassPaymentRequest) (*InstantPass, error) {
	if req.RazorpayOrderID == "" || req.RazorpayPaymentID == "" {
		return nil, errors.New("missing order or payment identification")
	}

	keySecret := s.cfg.RazorpayKeySecret

	// Signature verification (skip if mock order in dev)
	if keySecret != "" && !strings.HasPrefix(req.RazorpayOrderID, "order_mock_") {
		data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
		mac := hmac.New(sha256.New, []byte(keySecret))
		mac.Write([]byte(data))
		expected := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(expected), []byte(req.RazorpaySignature)) {
			return nil, errors.New("invalid razorpay payment signature")
		}
	}

	activatedPass, err := s.repo.ActivatePass(ctx, req.RazorpayOrderID, req.RazorpayPaymentID)
	if err != nil {
		return nil, err
	}

	// Record transaction in immutable wallet ledger
	debitInput := wallet.RecordTransactionInput{
		UserID:        userID,
		Type:          wallet.TypeDebit,
		TargetBalance: wallet.BalanceMain,
		Category:      wallet.CategoryPassPurchase,
		Amount:        99.00,
		ReferenceID:   req.RazorpayPaymentID,
		Description:   "InstantPass Online Purchase via Razorpay",
		Metadata: map[string]interface{}{
			"order_id":   req.RazorpayOrderID,
			"payment_id": req.RazorpayPaymentID,
			"channel":    "razorpay",
			"quota":      10,
		},
	}
	_, _, _ = s.walletService.RecordTransaction(ctx, debitInput)

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   userID,
				Type:     "instant_pass_activated",
				Category: notification.CategorySystem,
				Title:    "InstantPass Activated",
				Message:  "Your InstantPass (10 spot gigs) is active via Razorpay!",
				Link:     "/instant-work",
			})
		}()
	}

	return activatedPass, nil
}

// CreateSpotJob creates a spot hiring demand and opens the 3-minute broadcast window
func (s *InstantWorkServiceImpl) CreateSpotJob(ctx context.Context, recruiterID primitive.ObjectID, req CreateInstantJobRequest) (*InstantJob, error) {
	u, err := s.userRepo.FindUserByID(ctx, recruiterID.Hex())
	if err != nil {
		return nil, err
	}

	recruiterName := "Recruiter"
	companyName := "Verified Employer"
	recruiterMobile := ""
	if u != nil {
		if u.CompanyName != "" {
			companyName = u.CompanyName
		}
		if u.Name != "" {
			recruiterName = u.Name
		} else if u.FirstName != "" {
			recruiterName = u.FirstName + " " + u.LastName
		}
		recruiterMobile = u.Mobile
	}

	now := time.Now()
	job := &InstantJob{
		RecruiterID:     recruiterID,
		RecruiterName:   recruiterName,
		RecruiterMobile: recruiterMobile,
		CompanyName:     companyName,
		Skill:           req.Skill,
		Location: GeoJSONPoint{
			Type:        "Point",
			Coordinates: []float64{req.Lng, req.Lat},
		},
		Address:         req.Address,
		PayRate:         req.PayRate,
		RateType:        req.RateType,
		DurationHours:   req.DurationHours,
		RequiredWorkers: req.RequiredWorkers,
		Notes:           req.Notes,
		Status:          JobStatusDispatching,
		ExpiresAt:       now.Add(3 * time.Minute), // 3-minute broadcast window
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, err
	}

	return job, nil
}

// GetNearbyJobsForCandidate queries open dispatching spot jobs for candidate feed
func (s *InstantWorkServiceImpl) GetNearbyJobsForCandidate(ctx context.Context, candidateID primitive.ObjectID, lng, lat float64, radiusKm float64, skill string) ([]InstantJob, error) {
	radiusMeters := radiusKm * 1000.0
	if radiusMeters <= 0 {
		radiusMeters = 10000.0 // 10 km default
	}

	return s.repo.FindNearbyJobsForWorker(ctx, lng, lat, radiusMeters, skill)
}

// ClaimSpotGig performs the atomic CAS lock to claim a broadcasted spot job
func (s *InstantWorkServiceImpl) ClaimSpotGig(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	// Verify candidate has active pass quota
	pass, err := s.repo.GetActivePassByUserID(ctx, candidateID)
	if err != nil {
		return nil, err
	}
	if pass == nil || !pass.HasActivePass || pass.QuotaRemaining <= 0 {
		return nil, ErrPassQuotaExhausted
	}

	u, err := s.userRepo.FindUserByID(ctx, candidateID.Hex())
	if err != nil {
		return nil, err
	}

	name := "Candidate"
	mobile := ""
	if u != nil {
		if u.Name != "" {
			name = u.Name
		} else if u.FirstName != "" {
			name = u.FirstName + " " + u.LastName
		}
		mobile = u.Mobile
	}

	// 1. Atomic Compare-And-Swap (CAS) claim lock
	claimedJob, err := s.repo.ClaimJobAtomic(ctx, jobID, candidateID, name, mobile)
	if err != nil {
		return nil, err
	}

	// 2. Decrement candidate pass quota atomically
	_, _ = s.repo.DecrementQuota(ctx, candidateID)

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:    claimedJob.RecruiterID,
				ActorID:   &candidateID,
				ActorName: name,
				Type:      "instant_job_claimed",
				Category:  notification.CategoryJobs,
				Title:     "Spot Gig Claimed",
				Message:   fmt.Sprintf("%s claimed your spot gig for %s (%s)", name, claimedJob.Skill, claimedJob.Address),
				Link:      "/instant-hire",
				Metadata: map[string]interface{}{
					"job_id": jobID.Hex(),
					"skill":  claimedJob.Skill,
				},
			})
		}()
	}

	return claimedJob, nil
}

// GetActiveJobForCandidate returns candidate's currently active gig
func (s *InstantWorkServiceImpl) GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error) {
	return s.repo.GetActiveJobForCandidate(ctx, candidateID)
}

// GetActiveJobForRecruiter returns recruiter's currently active spot gig
func (s *InstantWorkServiceImpl) GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error) {
	return s.repo.GetActiveJobForRecruiter(ctx, recruiterID)
}

// CompleteSpotJob marks gig completed by candidate
func (s *InstantWorkServiceImpl) CompleteSpotJob(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	job, err := s.repo.GetJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if job == nil {
		return nil, ErrJobNotFound
	}
	if job.CandidateID == nil || *job.CandidateID != candidateID {
		return nil, ErrUnauthorizedJob
	}

	completedJob, err := s.repo.CompleteJob(ctx, jobID)
	if err != nil {
		return nil, err
	}

	if s.notifService != nil {
		go func() {
			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:   job.RecruiterID,
				ActorID:  &candidateID,
				Type:     "instant_job_completed",
				Category: notification.CategoryJobs,
				Title:    "Spot Gig Marked Complete",
				Message:  fmt.Sprintf("Candidate has marked the %s gig as completed. Please review and release payout.", job.Skill),
				Link:     "/instant-hire",
				Metadata: map[string]interface{}{
					"job_id": jobID.Hex(),
				},
			})
		}()
	}

	return completedJob, nil
}

// CloseSpotJob marks gig closed and releases earnings into worker's wallet
func (s *InstantWorkServiceImpl) CloseSpotJob(ctx context.Context, recruiterID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	job, err := s.repo.GetJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if job == nil {
		return nil, ErrJobNotFound
	}
	if job.RecruiterID != recruiterID {
		return nil, ErrUnauthorizedJob
	}

	closedJob, err := s.repo.CloseJob(ctx, jobID)
	if err != nil {
		return nil, err
	}

	// Release payout directly into candidate's wallet as withdrawable earnings
	if closedJob.CandidateID != nil {
		payoutAmount := closedJob.PayRate
		if closedJob.RateType == "hourly" && closedJob.DurationHours > 0 {
			payoutAmount = closedJob.PayRate * float64(closedJob.DurationHours)
		}
		if payoutAmount > 0 {
			creditInput := wallet.RecordTransactionInput{
				UserID:        *closedJob.CandidateID,
				Type:          wallet.TypeCredit,
				TargetBalance: wallet.BalanceEarnings,
				Category:      wallet.CategoryGigPayout,
				Amount:        payoutAmount,
				ReferenceID:   closedJob.ID.Hex(),
				Description:   fmt.Sprintf("Spot Gig Payout: %s (%s)", closedJob.Skill, closedJob.CompanyName),
				Metadata: map[string]interface{}{
					"job_id":      closedJob.ID.Hex(),
					"skill":       closedJob.Skill,
					"employer":    closedJob.CompanyName,
					"rate_type":   closedJob.RateType,
					"hourly_rate": closedJob.PayRate,
					"channel":     "wallet",
				},
			}
			_, _, _ = s.walletService.RecordTransaction(ctx, creditInput)

			if s.notifService != nil {
				candID := *closedJob.CandidateID
				go func() {
					_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
						UserID:   candID,
						Type:     "instant_job_payout",
						Category: notification.CategorySystem,
						Title:    "Gig Payout Released",
						Message:  fmt.Sprintf("₹%.2f credited to your wallet for %s gig (%s).", payoutAmount, closedJob.Skill, closedJob.CompanyName),
						Link:     "/wallet",
						Metadata: map[string]interface{}{
							"job_id": closedJob.ID.Hex(),
							"amount": payoutAmount,
						},
					})
				}()
			}
		}
	}

	return closedJob, nil
}
