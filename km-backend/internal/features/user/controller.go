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
// @Description Get other user profile by ID. Enforces profile_visibility settings.
// @Tags user
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} User
// @Router /api/user/{id} [get]
func (ctrl *UserController) GetOtherUserProfile(c *fiber.Ctx) error {
	targetUserID := c.Params("id")
	if targetUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	// Determine who is requesting
	requesterID, _ := c.Locals("user_id").(string)

	user, err := ctrl.service.GetProfile(c.Context(), targetUserID)
	if err != nil {
		if err.Error() == "user not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Enforce profile_visibility — owners always bypass
	targetIDHex := user.ID.Hex()
	if requesterID != targetIDHex {
		visibility := user.Settings.ProfileVisibility
		if visibility == "private" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "This profile is private",
				"visible": false,
			})
		}
		// Record view only for authentic other-user visits
		if requesterID != "" {
			_ = ctrl.service.RecordProfileView(c.Context(), targetIDHex, requesterID)
		}
	}

	return c.JSON(user)
}

func (ctrl *UserController) GetProfileViewers(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	viewers, err := ctrl.service.GetProfileViewers(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(viewers)
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

func (ctrl *UserController) UpdateEducation(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	eduID := c.Params("id")
	if eduID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Education ID is required"})
	}

	var edu Education
	if err := c.BodyParser(&edu); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.UpdateEducation(c.Context(), userID, eduID, edu)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) DeleteEducation(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	eduID := c.Params("id")
	if eduID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Education ID is required"})
	}

	user, err := ctrl.service.DeleteEducation(c.Context(), userID, eduID)
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

func (ctrl *UserController) UpdateExperience(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	expID := c.Params("id")
	if expID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Experience ID is required"})
	}

	var exp Experience
	if err := c.BodyParser(&exp); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := ctrl.service.UpdateExperience(c.Context(), userID, expID, exp)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) DeleteExperience(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	expID := c.Params("id")
	if expID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Experience ID is required"})
	}

	user, err := ctrl.service.DeleteExperience(c.Context(), userID, expID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) AddProject(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var project Project
	if err := c.BodyParser(&project); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	user, err := ctrl.service.AddProject(c.Context(), userID, project)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) UpdateProject(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Project ID is required"})
	}

	var project Project
	if err := c.BodyParser(&project); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	user, err := ctrl.service.UpdateProject(c.Context(), userID, projectID, project)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(user)
}

func (ctrl *UserController) DeleteProject(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	projectID := c.Params("id")
	if projectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Project ID is required"})
	}

	user, err := ctrl.service.DeleteProject(c.Context(), userID, projectID)
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

func (ctrl *UserController) DeleteSkill(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	skillName := c.Params("skillName")
	if skillName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Skill name is required"})
	}

	user, err := ctrl.service.DeleteSkill(c.Context(), userID, skillName)
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

func (ctrl *UserController) GetCommunityUsers(c *fiber.Ctx) error {
	users, err := ctrl.service.GetCommunityUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(users)
}

func (ctrl *UserController) GetPlatformStats(c *fiber.Ctx) error {
	stats, err := ctrl.service.GetPlatformStats(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "stats": stats})
}

func (ctrl *UserController) GetPlatformLiveActivity(c *fiber.Ctx) error {
	activity, err := ctrl.service.GetLiveActivity(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "events": activity})
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

// LoginWithPassword godoc
// @Summary Login with Email/Mobile and Password
// @Description Authenticate user via email/mobile and password
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordLoginRequest true "Credentials"
// @Success 200 {object} PasswordLoginResponse
// @Router /api/auth/login/password [post]
func (ctrl *UserController) LoginWithPassword(c *fiber.Ctx) error {
	var req PasswordLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	res, err := ctrl.service.LoginWithPassword(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

// RegisterWithPassword godoc
// @Summary Register with Password
// @Description Register a new account with email/mobile and password
// @Tags auth
// @Accept json
// @Produce json
// @Param request body PasswordRegisterRequest true "Registration Info"
// @Success 200 {object} PasswordLoginResponse
// @Router /api/auth/register/password [post]
func (ctrl *UserController) RegisterWithPassword(c *fiber.Ctx) error {
	var req PasswordRegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	res, err := ctrl.service.RegisterWithPassword(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

// SetPassword godoc
// @Summary Set or Change Password
// @Description Set or update user password
// @Tags user
// @Accept json
// @Produce json
// @Param request body SetPasswordRequest true "Password details"
// @Success 200 {object} map[string]string
// @Router /api/user/password [put]
func (ctrl *UserController) SetPassword(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req SetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	if err := ctrl.service.SetPassword(c.Context(), userID, req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}

func (ctrl *UserController) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := ctrl.service.ForgotPassword(c.Context(), req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Password reset code sent to your email"})
}

func (ctrl *UserController) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := ctrl.service.ResetPassword(c.Context(), req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Password reset successfully. You can now sign in with your new password."})
}

func (ctrl *UserController) UpdateUserRoles(c *fiber.Ctx) error {
	targetUserID := c.Params("id")
	if targetUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	var req struct {
		Roles []string `json:"roles"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{
		"roles": req.Roles,
	}

	user, err := ctrl.service.UpdateProfile(c.Context(), targetUserID, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

func (ctrl *UserController) AdminUpdateUserProfile(c *fiber.Ctx) error {
	targetUserID := c.Params("id")
	if targetUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User ID is required"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	user, err := ctrl.service.UpdateProfile(c.Context(), targetUserID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

func (ctrl *UserController) ToggleBookmark(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	jobID := c.Params("jobId")
	if jobID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "jobId parameter is required"})
	}

	bookmarks, err := ctrl.service.ToggleBookmark(c.Context(), userID, jobID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":         "Bookmark updated",
		"bookmarked_jobs": bookmarks,
	})
}

func (ctrl *UserController) GetBookmarkedJobs(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	user, err := ctrl.service.GetProfile(c.Context(), userID)
	if err != nil || user == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"bookmarked_jobs": user.BookmarkedJobs,
	})
}

func (ctrl *UserController) GetSettings(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	settings, err := ctrl.service.GetUserSettings(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(settings)
}

func (ctrl *UserController) UpdateSettings(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UserSettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid settings payload"})
	}

	updated, err := ctrl.service.UpdateUserSettings(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "Settings updated successfully",
		"settings": updated,
	})
}

type RecordImpressionsRequest struct {
	AuthorIDs []string `json:"author_ids"`
}

func (ctrl *UserController) RecordPostImpressions(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)

	var req RecordImpressionsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if len(req.AuthorIDs) == 0 {
		return c.JSON(fiber.Map{"status": "ok", "recorded": 0})
	}

	// Restrict max batch size to 100
	if len(req.AuthorIDs) > 100 {
		req.AuthorIDs = req.AuthorIDs[:100]
	}

	if err := ctrl.service.RecordPostImpressions(c.Context(), userID, req.AuthorIDs); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record impressions"})
	}

	return c.JSON(fiber.Map{"status": "ok", "recorded": len(req.AuthorIDs)})
}

func (ctrl *UserController) UpdateUsername(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UpdateUsernameRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	updated, err := ctrl.service.UpdateUsername(c.Context(), userID, req.Username)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "Custom URL updated successfully",
		"username": updated.Username,
		"user":     updated,
	})
}

func (ctrl *UserController) CheckUsernameAvailability(c *fiber.Ctx) error {
	username := c.Query("username")
	currentUserID, _ := c.Locals("user_id").(string)

	available, message, err := ctrl.service.CheckUsernameAvailability(c.Context(), currentUserID, username)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"available": available,
		"message":   message,
		"username":  strings.ToLower(strings.TrimSpace(username)),
	})
}

func (ctrl *UserController) UpdateOpenToWork(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req OpenToWorkPreferences
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	updated, err := ctrl.service.UpdateOpenToWork(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      "Open to work preferences updated",
		"open_to_work": updated.OpenToWork,
		"user":         updated,
	})
}

func (ctrl *UserController) UpdateProvidingServices(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req ProvidingServicesPreferences
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	updated, err := ctrl.service.UpdateProvidingServices(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":            "Providing services preferences updated",
		"providing_services": updated.ProvidingServices,
		"user":               updated,
	})
}
