package ads

import (
	"errors"
	"log"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/features/analytics"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	svc Service
}

func NewController(svc Service) *Controller {
	return &Controller{svc: svc}
}

func roles(c *fiber.Ctx) []string {
	switch rs := c.Locals("roles").(type) {
	case []string:
		return rs
	case []interface{}:
		out := make([]string, 0, len(rs))
		for _, r := range rs {
			if s, ok := r.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func memberID(c *fiber.Ctx) (primitive.ObjectID, bool) {
	s, _ := c.Locals("user_id").(string)
	if s == "" {
		return primitive.NilObjectID, false
	}
	id, err := primitive.ObjectIDFromHex(s)
	return id, err == nil
}

func hasRole(c *fiber.Ctx, role string) bool {
	for _, r := range roles(c) {
		if r == role {
			return true
		}
	}
	return false
}

// viewerKey tells people apart for the frequency cap and counts: a member's ID, "guest:" and
// the anonymous visitor ID, or "" for admins, bots and visitors without a cookie (not counted).
func viewerKey(c *fiber.Ctx) string {
	if id, ok := memberID(c); ok {
		if hasRole(c, "admin") {
			return ""
		}
		return id.Hex()
	}
	if vid := analytics.VisitorID(c); vid != "" {
		return "guest:" + vid
	}
	return ""
}

func adID(c *fiber.Ctx) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	return id, err == nil
}

// Serve returns ads for a slot. ?placement=feed_sidebar&count=1 (count up to 3, for lists that
// show several). An empty list means the slot should collapse.
func (ctrl *Controller) Serve(c *fiber.Ctx) error {
	placement := c.Query("placement")
	if !validPlacement(placement) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unknown placement"})
	}
	n := c.QueryInt("count", 1)
	if n < 1 || n > 3 {
		n = 1
	}
	if analytics.IsBot(c.Get(fiber.HeaderUserAgent)) {
		return c.JSON(fiber.Map{"ads": []*PublicAd{}})
	}

	who := Audience{Groups: []string{"guest"}}
	if id, ok := memberID(c); ok {
		who.Groups = roles(c)
		if city, err := ctrl.svc.UserCity(c.Context(), id); err == nil {
			who.City = city
		}
	}
	picked, err := ctrl.svc.Pick(c.Context(), placement, viewerKey(c), who, n)
	if err != nil {
		log.Printf("[ads] pick %s: %v", placement, err)
		return c.JSON(fiber.Map{"ads": []*PublicAd{}})
	}
	out := make([]*PublicAd, len(picked))
	for i, p := range picked {
		out[i] = p.Public()
	}
	// Ads change per person and per request
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	return c.JSON(fiber.Map{"ads": out})
}

// Impression is sent by the browser once half the ad has been on screen for a second
func (ctrl *Controller) Impression(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return c.SendStatus(fiber.StatusNoContent)
	}
	if err := ctrl.svc.Impression(c.Context(), id, viewerKey(c)); err != nil && !errors.Is(err, ErrNotFound) {
		log.Printf("[ads] impression %s: %v", id.Hex(), err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Click counts the click and sends the person on to the advertiser
func (ctrl *Controller) Click(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return c.Status(fiber.StatusNotFound).SendString("Ad not found")
	}
	link, err := ctrl.svc.Click(c.Context(), id, viewerKey(c))
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("Ad not found")
	}
	c.Set(fiber.HeaderCacheControl, "no-store")
	c.Set("Referrer-Policy", "origin")
	return c.Redirect(link, fiber.StatusFound)
}

// AdminCampaign is a campaign with what it's doing now and its click-through rate
type AdminCampaign struct {
	*Campaign
	State string  `json:"state"`
	CTR   float64 `json:"ctr"`
}

func adminView(c *Campaign, now time.Time) AdminCampaign {
	ctr := 0.0
	if c.Impressions > 0 {
		ctr = float64(c.Clicks) / float64(c.Impressions)
	}
	if c.Placements == nil {
		c.Placements = []string{}
	}
	if c.Cities == nil {
		c.Cities = []string{}
	}
	if c.Audiences == nil {
		c.Audiences = []string{}
	}
	return AdminCampaign{Campaign: c, State: c.State(now), CTR: ctr}
}

func badInput(c *fiber.Ctx, err error) error {
	if apperr.CodeOf(err) != "" {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	if errors.Is(err, ErrNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Campaign not found"})
	}
	log.Printf("[ads] %v", err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong. Please try again."})
}

// AdminList returns every campaign (newest first) and the slots and audiences to pick from
func (ctrl *Controller) AdminList(c *fiber.Ctx) error {
	list, err := ctrl.svc.List(c.Context(), strings.TrimSpace(c.Query("search")))
	if err != nil {
		return badInput(c, err)
	}
	now := time.Now()
	out := make([]AdminCampaign, len(list))
	for i, item := range list {
		out[i] = adminView(item, now)
	}
	return c.JSON(fiber.Map{"campaigns": out, "placements": Placements, "audiences": Audiences})
}

func (ctrl *Controller) AdminGet(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return badInput(c, ErrNotFound)
	}
	item, err := ctrl.svc.Get(c.Context(), id)
	if err != nil {
		return badInput(c, err)
	}
	return c.JSON(adminView(item, time.Now()))
}

func (ctrl *Controller) AdminCreate(c *fiber.Ctx) error {
	var in CampaignInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	adminID, _ := memberID(c)
	item, err := ctrl.svc.Create(c.Context(), &in, adminID)
	if err != nil {
		return badInput(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(adminView(item, time.Now()))
}

func (ctrl *Controller) AdminUpdate(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return badInput(c, ErrNotFound)
	}
	var in CampaignInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	item, err := ctrl.svc.Update(c.Context(), id, &in)
	if err != nil {
		return badInput(c, err)
	}
	return c.JSON(adminView(item, time.Now()))
}

func (ctrl *Controller) AdminSetStatus(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return badInput(c, ErrNotFound)
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := ctrl.svc.SetStatus(c.Context(), id, body.Status); err != nil {
		return badInput(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (ctrl *Controller) AdminDelete(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return badInput(c, ErrNotFound)
	}
	if err := ctrl.svc.Delete(c.Context(), id); err != nil {
		return badInput(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}

// AdminStats is a campaign's daily impressions, reach and clicks. ?days=7|30|90
func (ctrl *Controller) AdminStats(c *fiber.Ctx) error {
	id, ok := adID(c)
	if !ok {
		return badInput(c, ErrNotFound)
	}
	days := c.QueryInt("days", 30)
	if days != 7 && days != 30 && days != 90 {
		days = 30
	}
	rows, err := ctrl.svc.Daily(c.Context(), id, days)
	if err != nil {
		return badInput(c, err)
	}
	return c.JSON(fiber.Map{"days": rows})
}
