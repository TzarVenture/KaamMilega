package user

import (
	"log"
	"strings"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type UserController struct {
	service UserService
	config  *config.Config
}

func NewUserController(service UserService, cfg *config.Config) *UserController {
	return &UserController{service: service, config: cfg}
}

// SendOTP godoc
// @Summary Send OTP
// @Description Send OTP to mobile
// @Tags auth
// @Accept json
// @Produce json
// @Param request body SendOTPRequest true "Mobile Number"
// @Success 200 {object} map[string]string
// @Router /api/auth/otp/send [post]
func (ctrl *UserController) SendOTP(c *fiber.Ctx) error {
	var req SendOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	role := req.Role
	if role == "" {
		role = RoleUser
	}

	if err := ctrl.service.SendOTP(c.Context(), req.Mobile, role); err != nil {
		log.Printf("SendOTP Error: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "OTP sent successfully"})
}

// VerifyOTP godoc
// @Summary Verify OTP
// @Description Verify OTP and login/register
// @Tags auth
// @Accept json
// @Produce json
// @Param request body VerifyOTPRequest true "Mobile and Code"
// @Success 200 {object} VerifyOTPResponse
// @Router /api/auth/otp/verify [post]
func (ctrl *UserController) VerifyOTP(c *fiber.Ctx) error {
	var req VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	role := req.Role
	if role == "" {
		role = RoleUser
	}

	res, err := ctrl.service.VerifyOTP(c.Context(), req.Mobile, req.Code, role)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

// Register godoc
// @Summary Register User
// @Description Complete registration
// @Tags auth
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Profile Details"
// @Success 200 {object} User
// @Router /api/auth/register [post]
func (ctrl *UserController) Register(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.Register(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

// GetProfile godoc
// @Summary Get User Profile
// @Description Get current user profile
// @Tags auth
// @Security BearerAuth
// @Accept json
// @Produce json
// @Success 200 {object} User
// @Router /api/user/profile [get]
func (ctrl *UserController) GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	user, err := ctrl.service.GetProfile(c.Context(), userID)
	if err != nil {
		if err.Error() == "user not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

// GetOtherUserProfile godoc
// @Summary Get Other User Profile
// @Description Get other user profile by ID
// @Tags user
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} User
// @Router /api/user/{id} [get]
func (ctrl *UserController) GetOtherUserProfile(c *fiber.Ctx) error {
	userID := c.Params("id")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	user, err := ctrl.service.GetProfile(c.Context(), userID)
	if err != nil {
		if err.Error() == "user not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) AddEducation(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var edu Education
	if err := c.BodyParser(&edu); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.AddEducation(c.Context(), userID, edu)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) AddExperience(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var exp Experience
	if err := c.BodyParser(&exp); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.AddExperience(c.Context(), userID, exp)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) AddSkill(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		SkillName string `json:"skill_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.AddSkill(c.Context(), userID, req.SkillName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var updates map[string]interface{}
	if err := c.BodyParser(&updates); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.UpdateProfile(c.Context(), userID, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) SendEmailOTP(c *fiber.Ctx) error {
	var req SendEmailOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if err := ctrl.service.SendEmailOTP(c.Context(), req.Email); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "OTP sent to email successfully"})
}

func (ctrl *UserController) VerifyEmailOTP(c *fiber.Ctx) error {
	var req VerifyEmailOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
				return []byte(ctrl.config.JWTSecret), nil
			})
			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					if sub, ok := claims["sub"].(string); ok {
						userID = sub
					}
				}
			}
		}
	}

	if err := ctrl.service.VerifyEmailOTP(c.Context(), req.Email, req.Code, userID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Email verified successfully"})
}

// GetAllUsers godoc
// @Summary Get All Users
// @Description Get all users (Admin only)
// @Tags user
// @Accept json
// @Produce json
// @Success 200 {array} User
// @Router /api/admin/users [get]
func (ctrl *UserController) GetAllUsers(c *fiber.Ctx) error {
	// Add role check here if needed, or rely on middleware
	// userID := c.Locals("user_id").(string)

	users, err := ctrl.service.GetAllUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(users)
}

func (ctrl *UserController) GetExperts(c *fiber.Ctx) error {
	users, err := ctrl.service.GetExperts(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

func (ctrl *UserController) SearchUsers(c *fiber.Ctx) error {
	query := c.Query("q")
	users, err := ctrl.service.SearchUsers(c.Context(), query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	// Return basic info only
	return c.JSON(users)
}

func (ctrl *UserController) ApplyForExpert(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req ApplyExpertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.ApplyForExpert(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) ApproveExpert(c *fiber.Ctx) error {
	targetUserID := c.Params("id")
	if targetUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	var req ApproveExpertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	// For now, allow any authenticated admin route access (middleware handles role ideally)
	adminID := "" // c.Locals("user_id").(string)

	user, err := ctrl.service.ApproveExpert(c.Context(), adminID, targetUserID, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) GetExpertRequests(c *fiber.Ctx) error {
	users, err := ctrl.service.GetExpertRequests(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

