package instant_work

import (
	"context"
	"errors"
	"log"
	"strconv"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/features/analytics"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InstantWorkController struct {
	service InstantWorkService
	config  *config.Config
	stats   analytics.Service
}

func NewInstantWorkController(service InstantWorkService, config *config.Config, stats analytics.Service) *InstantWorkController {
	return &InstantWorkController{
		service: service,
		config:  config,
		stats:   stats,
	}
}

func parseUserID(c *fiber.Ctx) (primitive.ObjectID, error) {
	val := c.Locals("user_id")
	if val == nil {
		return primitive.NilObjectID, errors.New("unauthorized")
	}
	str, ok := val.(string)
	if !ok || str == "" {
		return primitive.NilObjectID, errors.New("unauthorized")
	}
	return primitive.ObjectIDFromHex(str)
}

// GetCandidateStatus returns live availability, active pass status and quota
func (ctrl *InstantWorkController) GetCandidateStatus(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	status, err := ctrl.service.GetCandidateStatus(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(status)
}

// ToggleAvailability toggles Free Now availability and validates active pass quota
func (ctrl *InstantWorkController) ToggleAvailability(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	var req ToggleAvailabilityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	worker, err := ctrl.service.ToggleAvailability(c.Context(), userID, req)
	if err != nil {
		if errors.Is(err, ErrPassRequired) || errors.Is(err, ErrPassQuotaExhausted) {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":          err.Error(),
				"requires_pass":  true,
				"price_inr":      99.00,
				"quota_total":    10,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(worker)
}

// UpdateLocation handles 30s background GPS heartbeats from candidate's browser
func (ctrl *InstantWorkController) UpdateLocation(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	var req LocationPingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid coordinates payload"})
	}

	if err := ctrl.service.UpdateLocation(c.Context(), userID, req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
}

// GetNearbyCandidates returns active candidates within radius with 100-180m privacy jitter
func (ctrl *InstantWorkController) GetNearbyCandidates(c *fiber.Ctx) error {
	lng, _ := strconv.ParseFloat(c.Query("lng", "72.8777"), 64)
	lat, _ := strconv.ParseFloat(c.Query("lat", "19.0760"), 64)
	radiusKm, _ := strconv.ParseFloat(c.Query("radius_km", "5.0"), 64)
	skill := c.Query("skill", "")

	candidates, err := ctrl.service.GetNearbyCandidatesForRecruiter(c.Context(), lng, lat, radiusKm, skill)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}
	ctrl.recordSearchAppearances(c, candidates)

	return c.Status(fiber.StatusOK).JSON(candidates)
}

// recordSearchAppearances counts the workers a recruiter's radar search returned as search
// appearances for them, in the background. Each worker counts once a day per recruiter, so the
// radar refreshing doesn't add up.
func (ctrl *InstantWorkController) recordSearchAppearances(c *fiber.Ctx, found []NearbyCandidateResult) {
	if ctrl.stats == nil || len(found) == 0 || hasAdminRole(c) {
		return
	}
	searcher, err := parseUserID(c)
	if err != nil {
		return
	}
	ids := make([]primitive.ObjectID, 0, len(found))
	for _, f := range found {
		ids = append(ids, f.UserID)
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := ctrl.stats.RecordSearchAppearances(ctx, searcher, ids); err != nil {
			log.Printf("analytics: recording radar search appearances: %v", err)
		}
	}()
}

func hasAdminRole(c *fiber.Ctx) bool {
	switch roles := c.Locals("roles").(type) {
	case []string:
		for _, r := range roles {
			if r == "admin" {
				return true
			}
		}
	case []interface{}:
		for _, r := range roles {
			if s, ok := r.(string); ok && s == "admin" {
				return true
			}
		}
	}
	return false
}

// PurchasePassWithWallet activates the ₹99 pass directly from the user's KaamMilega wallet balance
func (ctrl *InstantWorkController) PurchasePassWithWallet(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	pass, summary, err := ctrl.service.PurchasePassWithWallet(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"pass":           pass,
		"wallet_summary": summary,
		"message":        "InstantPass activated successfully from wallet balance",
	})
}

// CreatePassOrder creates a ₹99 order for 10 guaranteed dispatches
func (ctrl *InstantWorkController) CreatePassOrder(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	resp, err := ctrl.service.CreatePassOrder(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// VerifyPassPayment validates Razorpay signature and activates pass
func (ctrl *InstantWorkController) VerifyPassPayment(c *fiber.Ctx) error {
	userID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	var req VerifyPassPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid verification payload"})
	}

	pass, err := ctrl.service.VerifyPassPayment(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(pass)
}

// CreateSpotJob posts an urgent spot hiring demand
func (ctrl *InstantWorkController) CreateSpotJob(c *fiber.Ctx) error {
	recruiterID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	var req CreateInstantJobRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid spot job payload"})
	}

	job, err := ctrl.service.CreateSpotJob(c.Context(), recruiterID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusCreated).JSON(job)
}

// GetCandidateJobsFeed returns nearby open spot jobs for candidate
func (ctrl *InstantWorkController) GetCandidateJobsFeed(c *fiber.Ctx) error {
	candidateID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	lng, _ := strconv.ParseFloat(c.Query("lng", "72.8777"), 64)
	lat, _ := strconv.ParseFloat(c.Query("lat", "19.0760"), 64)
	radiusKm, _ := strconv.ParseFloat(c.Query("radius_km", "10.0"), 64)
	skill := c.Query("skill", "")

	jobs, err := ctrl.service.GetNearbyJobsForCandidate(c.Context(), candidateID, lng, lat, radiusKm, skill)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(jobs)
}

// ClaimGig executes atomic CAS match locking
func (ctrl *InstantWorkController) ClaimGig(c *fiber.Ctx) error {
	candidateID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	var req ClaimGigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid claim payload"})
	}

	jobID, err := primitive.ObjectIDFromHex(req.JobID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid job ID"})
	}

	job, err := ctrl.service.ClaimSpotGig(c.Context(), candidateID, jobID)
	if err != nil {
		if errors.Is(err, ErrPassQuotaExhausted) {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":         err.Error(),
				"requires_pass": true,
				"price_inr":     99.00,
			})
		}
		return c.Status(fiber.StatusConflict).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(job)
}

// GetCandidateActiveJob retrieves candidate's current active gig
func (ctrl *InstantWorkController) GetCandidateActiveJob(c *fiber.Ctx) error {
	candidateID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	job, err := ctrl.service.GetActiveJobForCandidate(c.Context(), candidateID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(job)
}

// GetRecruiterActiveJob retrieves recruiter's current active spot gig
func (ctrl *InstantWorkController) GetRecruiterActiveJob(c *fiber.Ctx) error {
	recruiterID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	job, err := ctrl.service.GetActiveJobForRecruiter(c.Context(), recruiterID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(job)
}

// CompleteJob marks gig as completed by candidate
func (ctrl *InstantWorkController) CompleteJob(c *fiber.Ctx) error {
	candidateID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	jobIDStr := c.Params("id")
	jobID, err := primitive.ObjectIDFromHex(jobIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid job ID"})
	}

	job, err := ctrl.service.CompleteSpotJob(c.Context(), candidateID, jobID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(job)
}

// CloseJob marks gig closed and settled by recruiter
func (ctrl *InstantWorkController) CloseJob(c *fiber.Ctx) error {
	recruiterID, err := parseUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(apperr.Body(err))
	}

	jobIDStr := c.Params("id")
	jobID, err := primitive.ObjectIDFromHex(jobIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid job ID"})
	}

	job, err := ctrl.service.CloseSpotJob(c.Context(), recruiterID, jobID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(err))
	}

	return c.Status(fiber.StatusOK).JSON(job)
}
