package instant_work

import (
	"context"
	"crypto/rand"
	"fmt"
	"math"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/payment"
	"km-backend/internal/features/user"
	"km-backend/internal/features/wallet"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrPassRequired       = apperr.New("PASS_REQUIRED", "an active InstantPass (₹99) is required to go Free Now and receive dispatches")
	ErrPassQuotaExhausted = apperr.New("PASS_QUOTA_EXHAUSTED", "your InstantPass has no gig credits left. Buy a new pass to accept more gigs")
	ErrPassUsed           = apperr.New("PASS_USED", "this InstantPass has been used, so it can't be refunded")
	ErrJobNotFound        = apperr.New("INSTANT_JOB_NOT_FOUND", "instant job not found")
	ErrUnauthorizedJob    = apperr.New("INSTANT_JOB_FORBIDDEN", "unauthorized access to this instant job")
	ErrJobNotCompleted    = apperr.New("INSTANT_JOB_NOT_COMPLETED", "this gig must be completed before it can be closed")
	ErrJobWrongState      = apperr.New("INSTANT_JOB_WRONG_STATE", "this gig can't be changed at its current stage")
	ErrSelfClaim          = apperr.New("INSTANT_JOB_SELF_CLAIM", "you can't accept a job you posted")
	ErrGigUnavailable     = apperr.New("GIG_UNAVAILABLE", "this gig has already been claimed by another candidate or has expired")
	ErrAlreadyOnGig       = apperr.New("INSTANT_ALREADY_ON_GIG", "finish your current gig before taking another one")
	ErrOpenJobExists      = apperr.New("INSTANT_OPEN_JOB_EXISTS", "you already have an open spot job. Close or cancel it first")
	ErrInvalidLocation    = apperr.New("INSTANT_LOCATION_INVALID", "share a valid location")
	ErrSkillRequired      = apperr.New("INSTANT_SKILL_REQUIRED", "choose a skill")
)

// Limits on what a hirer or worker can enter
const (
	maxPayRate         = 1_00_000.0
	maxHourlyRate      = 10_000.0
	maxDurationHours   = 24
	maxSkillLength     = 60
	maxAddressLength   = 300
	maxNotesLength     = 1000
	defaultRadiusKm    = 5.0
	maxRadiusKm        = 10.0
	broadcastWindow    = 3 * time.Minute
	radarCandidatesMax = 30
)

func invalid(message string) error { return apperr.New("INSTANT_JOB_INVALID", message) }

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
	CancelSpotJob(ctx context.Context, recruiterID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error)
}

type InstantWorkServiceImpl struct {
	repo          InstantWorkRepository
	userRepo      user.UserRepository
	walletService wallet.WalletService
	notifService  notification.NotificationService
	cfg           *config.Config
	payments      payment.Service
	tx            database.Transactor
}

func NewInstantWorkService(
	repo InstantWorkRepository,
	userRepo user.UserRepository,
	walletService wallet.WalletService,
	cfg *config.Config,
	notifService notification.NotificationService,
	payments payment.Service,
	tx database.Transactor,
) InstantWorkService {
	s := &InstantWorkServiceImpl{
		repo:          repo,
		userRepo:      userRepo,
		walletService: walletService,
		notifService:  notifService,
		cfg:           cfg,
		payments:      payments,
		tx:            tx,
	}
	payments.Register(payment.PurposeInstantPass, payment.Handlers{
		Fulfill: s.fulfillPass,
		Revoke:  s.revokePass,
	})
	walletService.RegisterPurchaseRevoker(wallet.CategoryPassPurchase, s.revokeWalletPass)
	return s
}

// displayName is the user's full name, or fallback
func displayName(u *user.User, fallback string) string {
	if u == nil {
		return fallback
	}
	if n := strings.TrimSpace(u.Name); n != "" {
		return n
	}
	if n := strings.TrimSpace(u.FirstName + " " + u.LastName); n != "" {
		return n
	}
	return fallback
}

// shortName turns "Ramesh Kumar" into "Ramesh K." for people who haven't been matched yet
func shortName(name string) string {
	parts := strings.Fields(name)
	if len(parts) < 2 {
		return name
	}
	last, _ := utf8.DecodeRuneInString(parts[len(parts)-1])
	return parts[0] + " " + string(last) + "."
}

func validLocation(lat, lng float64) bool {
	if math.IsNaN(lat) || math.IsNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return false
	}
	return !(lat == 0 && lng == 0) // 0,0 is a missing location, not a real one
}

// radiusOrDefault keeps a search radius between 1 and 10 km
func radiusOrDefault(km float64) float64 {
	if math.IsNaN(km) || km <= 0 {
		return defaultRadiusKm
	}
	return math.Min(math.Max(km, 1), maxRadiusKm)
}

func (s *InstantWorkServiceImpl) notify(req notification.CreateNotificationRequest) {
	if s.notifService == nil {
		return
	}
	go func() { _, _ = s.notifService.CreateNotification(context.Background(), req) }()
}

// GetCandidateStatus returns availability, skill, and pass credits and expiry
func (s *InstantWorkServiceImpl) GetCandidateStatus(ctx context.Context, userID primitive.ObjectID) (*CandidateStatusResponse, error) {
	worker, err := s.repo.GetWorkerByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	pass, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := &CandidateStatusResponse{CurrentLocation: GeoJSONPoint{Type: "Point", Coordinates: []float64{}}}
	if pass != nil {
		resp.HasActivePass = true
		resp.QuotaRemaining = pass.QuotaRemaining
		resp.QuotaTotal = pass.QuotaTotal
		resp.PassExpiresAt = &pass.ExpiresAt
	}
	if worker != nil {
		resp.IsFreeNow = worker.IsFreeNow && pass != nil && pass.QuotaRemaining > 0
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

// ToggleAvailability turns Free Now on (needs a pass with credits and a location) or off
func (s *InstantWorkServiceImpl) ToggleAvailability(ctx context.Context, userID primitive.ObjectID, req ToggleAvailabilityRequest) (*InstantWorker, error) {
	if !req.IsFreeNow {
		if err := s.repo.SetWorkerFreeNow(ctx, userID, false); err != nil {
			return nil, err
		}
		worker, err := s.repo.GetWorkerByUserID(ctx, userID)
		if err != nil {
			return nil, err
		}
		if worker == nil {
			return &InstantWorker{UserID: userID}, nil
		}
		return worker, nil
	}

	skill := strings.TrimSpace(req.Skill)
	if skill == "" || utf8.RuneCountInString(skill) > maxSkillLength {
		return nil, ErrSkillRequired
	}
	if math.IsNaN(req.HourlyRate) || req.HourlyRate < 0 || req.HourlyRate > maxHourlyRate {
		return nil, invalid(fmt.Sprintf("hourly rate must be between ₹0 and ₹%.0f", maxHourlyRate))
	}
	if !validLocation(req.Lat, req.Lng) {
		return nil, ErrInvalidLocation
	}

	pass, err := s.repo.GetActivePassByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if pass == nil {
		return nil, ErrPassRequired
	}
	if pass.QuotaRemaining <= 0 {
		return nil, ErrPassQuotaExhausted
	}
	if job, err := s.repo.GetActiveJobForCandidate(ctx, userID); err != nil {
		return nil, err
	} else if job != nil {
		return nil, ErrAlreadyOnGig
	}

	u, err := s.userRepo.FindUserByID(ctx, userID.Hex())
	if err != nil {
		return nil, err
	}
	worker := &InstantWorker{
		UserID:         userID,
		Name:           displayName(u, "Professional"),
		ActiveSkill:    skill,
		HourlyRate:     math.Round(req.HourlyRate*100) / 100,
		Location:       GeoJSONPoint{Type: "Point", Coordinates: []float64{req.Lng, req.Lat}},
		IsFreeNow:      true,
		QuotaRemaining: pass.QuotaRemaining,
		PassExpiresAt:  pass.ExpiresAt,
	}
	if u != nil {
		worker.Avatar = u.ProfileImage
		worker.Mobile = u.Mobile
	}
	return s.repo.SetWorkerAvailability(ctx, worker, true)
}

// UpdateLocation stores the worker's periodic location ping
func (s *InstantWorkServiceImpl) UpdateLocation(ctx context.Context, userID primitive.ObjectID, req LocationPingRequest) error {
	if !validLocation(req.Lat, req.Lng) {
		return ErrInvalidLocation
	}
	return s.repo.UpdateWorkerPing(ctx, userID, GeoJSONPoint{Type: "Point", Coordinates: []float64{req.Lng, req.Lat}})
}

// GetNearbyCandidatesForRecruiter lists free workers nearby. Locations are moved 100-180 m and
// names shortened, so nobody can be found exactly before they accept a job.
func (s *InstantWorkServiceImpl) GetNearbyCandidatesForRecruiter(ctx context.Context, lng, lat float64, radiusKm float64, skill string) ([]NearbyCandidateResult, error) {
	if !validLocation(lat, lng) {
		return nil, ErrInvalidLocation
	}
	candidates, err := s.repo.FindNearbyWorkers(ctx, lng, lat, radiusOrDefault(radiusKm)*1000, skill, radarCandidatesMax)
	if err != nil {
		return nil, err
	}
	for i := range candidates {
		candidates[i].Name = shortName(candidates[i].Name)
		if len(candidates[i].Location.Coordinates) == 2 {
			jLng, jLat := jitterCoordinates(candidates[i].Location.Coordinates[0], candidates[i].Location.Coordinates[1])
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

// normaliseJob checks and tidies a spot job request
func normaliseJob(req CreateInstantJobRequest) (CreateInstantJobRequest, error) {
	req.Skill = strings.TrimSpace(req.Skill)
	req.Address = strings.TrimSpace(req.Address)
	req.Notes = strings.TrimSpace(req.Notes)
	req.RateType = strings.ToLower(strings.TrimSpace(req.RateType))

	switch {
	case req.Skill == "" || utf8.RuneCountInString(req.Skill) > maxSkillLength:
		return req, ErrSkillRequired
	case !validLocation(req.Lat, req.Lng):
		return req, ErrInvalidLocation
	case utf8.RuneCountInString(req.Address) < 3 || utf8.RuneCountInString(req.Address) > maxAddressLength:
		return req, invalid("enter the work address")
	case utf8.RuneCountInString(req.Notes) > maxNotesLength:
		return req, invalid(fmt.Sprintf("notes can be up to %d characters", maxNotesLength))
	case math.IsNaN(req.PayRate) || req.PayRate < 1 || req.PayRate > maxPayRate:
		return req, invalid(fmt.Sprintf("pay must be between ₹1 and ₹%.0f", maxPayRate))
	}
	if req.RateType == "" {
		req.RateType = "flat"
	}
	if req.RateType != "hourly" && req.RateType != "flat" {
		return req, invalid("rate type must be hourly or flat")
	}
	if req.DurationHours < 0 || req.DurationHours > maxDurationHours || (req.RateType == "hourly" && req.DurationHours < 1) {
		return req, invalid(fmt.Sprintf("duration must be between 1 and %d hours", maxDurationHours))
	}
	if req.RequiredWorkers == 0 {
		req.RequiredWorkers = 1
	}
	if req.RequiredWorkers != 1 {
		return req, invalid("one booking can have one worker for now")
	}
	req.PayRate = math.Round(req.PayRate*100) / 100
	req.RadiusKm = radiusOrDefault(req.RadiusKm)
	return req, nil
}

// CreateSpotJob posts a job and opens the 3-minute window for nearby workers to accept it
func (s *InstantWorkServiceImpl) CreateSpotJob(ctx context.Context, recruiterID primitive.ObjectID, req CreateInstantJobRequest) (*InstantJob, error) {
	req, err := normaliseJob(req)
	if err != nil {
		return nil, err
	}
	open, err := s.GetActiveJobForRecruiter(ctx, recruiterID)
	if err != nil {
		return nil, err
	}
	if open != nil {
		return nil, ErrOpenJobExists
	}

	u, err := s.userRepo.FindUserByID(ctx, recruiterID.Hex())
	if err != nil {
		return nil, err
	}
	companyName := ""
	recruiterMobile := ""
	if u != nil {
		companyName = strings.TrimSpace(u.CompanyName)
		recruiterMobile = u.Mobile
	}

	now := time.Now()
	job := &InstantJob{
		RecruiterID:     recruiterID,
		RecruiterName:   displayName(u, "Hirer"),
		RecruiterMobile: recruiterMobile,
		CompanyName:     companyName,
		Skill:           req.Skill,
		Location:        GeoJSONPoint{Type: "Point", Coordinates: []float64{req.Lng, req.Lat}},
		Address:         req.Address,
		PayRate:         req.PayRate,
		RateType:        req.RateType,
		DurationHours:   req.DurationHours,
		RequiredWorkers: req.RequiredWorkers,
		Notes:           req.Notes,
		Status:          JobStatusDispatching,
		ExpiresAt:       now.Add(broadcastWindow),
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, err
	}
	return job, nil
}

// GetNearbyJobsForCandidate lists open jobs near the worker
func (s *InstantWorkServiceImpl) GetNearbyJobsForCandidate(ctx context.Context, candidateID primitive.ObjectID, lng, lat float64, radiusKm float64, skill string) ([]InstantJob, error) {
	if !validLocation(lat, lng) {
		return nil, ErrInvalidLocation
	}
	return s.repo.FindNearbyJobsForWorker(ctx, lng, lat, radiusOrDefault(radiusKm)*1000, skill, candidateID)
}

// ClaimSpotGig gives the job to the worker and spends one credit, all or nothing. The credit
// update also serialises a worker's claims, so one credit can't win two gigs at once and a
// worker can't hold two gigs.
func (s *InstantWorkServiceImpl) ClaimSpotGig(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	job, err := s.repo.GetJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if job == nil {
		return nil, ErrJobNotFound
	}
	if job.RecruiterID == candidateID {
		return nil, ErrSelfClaim
	}

	u, err := s.userRepo.FindUserByID(ctx, candidateID.Hex())
	if err != nil {
		return nil, err
	}
	name := displayName(u, "Worker")
	mobile := ""
	if u != nil {
		mobile = u.Mobile
	}

	var claimed *InstantJob
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		pass, err := s.repo.UseCredit(ctx, candidateID)
		if err != nil {
			return err
		}
		if active, err := s.repo.GetActiveJobForCandidate(ctx, candidateID); err != nil {
			return err
		} else if active != nil {
			return ErrAlreadyOnGig
		}
		if claimed, err = s.repo.ClaimJobAtomic(ctx, jobID, candidateID, name, mobile); err != nil {
			return err
		}
		if err := s.repo.SyncWorkerPass(ctx, candidateID, pass.QuotaRemaining, pass.ExpiresAt); err != nil {
			return err
		}
		return s.repo.SetWorkerFreeNow(ctx, candidateID, false)
	})
	if err != nil {
		return nil, err
	}

	s.notify(notification.CreateNotificationRequest{
		UserID:    claimed.RecruiterID,
		ActorID:   &candidateID,
		ActorName: name,
		Type:      "instant_job_claimed",
		Category:  notification.CategoryJobs,
		Title:     "Spot gig accepted",
		Message:   fmt.Sprintf("%s accepted your %s gig at %s", name, claimed.Skill, claimed.Address),
		Link:      "/instant-milega?mode=hire",
		Metadata:  map[string]interface{}{"job_id": jobID.Hex(), "skill": claimed.Skill},
	})
	return claimed, nil
}

func (s *InstantWorkServiceImpl) GetActiveJobForCandidate(ctx context.Context, candidateID primitive.ObjectID) (*InstantJob, error) {
	return s.repo.GetActiveJobForCandidate(ctx, candidateID)
}

// GetActiveJobForRecruiter returns the hirer's open job, after expiring any nobody accepted
func (s *InstantWorkServiceImpl) GetActiveJobForRecruiter(ctx context.Context, recruiterID primitive.ObjectID) (*InstantJob, error) {
	if err := s.repo.ExpireStaleJobs(ctx, recruiterID); err != nil {
		return nil, err
	}
	return s.repo.GetActiveJobForRecruiter(ctx, recruiterID)
}

// CompleteSpotJob is the worker marking their gig as done
func (s *InstantWorkServiceImpl) CompleteSpotJob(ctx context.Context, candidateID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	if err := s.requireJob(ctx, jobID, func(j *InstantJob) bool { return j.CandidateID != nil && *j.CandidateID == candidateID }); err != nil {
		return nil, err
	}
	job, err := s.repo.CompleteJob(ctx, jobID, candidateID)
	if err != nil {
		return nil, err
	}

	s.notify(notification.CreateNotificationRequest{
		UserID:   job.RecruiterID,
		ActorID:  &candidateID,
		Type:     "instant_job_completed",
		Category: notification.CategoryJobs,
		Title:    "Spot gig marked done",
		Message:  fmt.Sprintf("The worker marked your %s gig as done. Please check and close it.", job.Skill),
		Link:     "/instant-milega?mode=hire",
		Metadata: map[string]interface{}{"job_id": jobID.Hex()},
	})
	return job, nil
}

// CloseSpotJob is the hirer approving a completed gig. No money moves yet: the hirer isn't
// charged anywhere, so paying the worker here would be money from nothing.
func (s *InstantWorkServiceImpl) CloseSpotJob(ctx context.Context, recruiterID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	if err := s.requireJob(ctx, jobID, func(j *InstantJob) bool { return j.RecruiterID == recruiterID }); err != nil {
		return nil, err
	}
	var closed *InstantJob
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		if closed, err = s.repo.CloseJob(ctx, jobID, recruiterID); err != nil {
			return err
		}
		return s.repo.IncrementWorkerGigs(ctx, *closed.CandidateID)
	})
	if err != nil {
		return nil, err
	}
	return closed, nil
}

// CancelSpotJob is the hirer withdrawing a job no worker has accepted yet
func (s *InstantWorkServiceImpl) CancelSpotJob(ctx context.Context, recruiterID primitive.ObjectID, jobID primitive.ObjectID) (*InstantJob, error) {
	if err := s.requireJob(ctx, jobID, func(j *InstantJob) bool { return j.RecruiterID == recruiterID }); err != nil {
		return nil, err
	}
	return s.repo.CancelJob(ctx, jobID, recruiterID)
}

// requireJob checks the job exists and that allowed says the caller may act on it
func (s *InstantWorkServiceImpl) requireJob(ctx context.Context, jobID primitive.ObjectID, allowed func(*InstantJob) bool) error {
	job, err := s.repo.GetJobByID(ctx, jobID)
	if err != nil {
		return err
	}
	if job == nil {
		return ErrJobNotFound
	}
	if !allowed(job) {
		return ErrUnauthorizedJob
	}
	return nil
}
