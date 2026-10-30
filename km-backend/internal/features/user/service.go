package user

import (
	"context"
	crand "crypto/rand"
	"crypto/tls"
	"errors"
	"fmt"
	"km-backend/internal/common/apperr"
	"math/big"
	"net/smtp"
	"regexp"
	"slices"
	"strings"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/skill"
	"km-backend/internal/features/sms"
	"km-backend/internal/middleware"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type UserService interface {
	SendOTP(ctx context.Context, mobile string, role string) error
	VerifyOTP(ctx context.Context, mobile, code string, role string) (*VerifyOTPResponse, error)
	LoginWithPassword(ctx context.Context, req PasswordLoginRequest) (*PasswordLoginResponse, error)
	RegisterWithPassword(ctx context.Context, req PasswordRegisterRequest) (*PasswordLoginResponse, error)
	SetPassword(ctx context.Context, userID string, req SetPasswordRequest) error
	RevokeSessions(ctx context.Context, userID string) error
	CanViewProfile(ctx context.Context, owner *User, viewerID string, viewerIsAdmin bool) (bool, error)
	Register(ctx context.Context, userID string, req RegisterRequest) (*User, error)
	GetProfile(ctx context.Context, userID string) (*User, error)
	GenerateToken(user *User) (string, error)
	UpdateProfile(ctx context.Context, userID string, updates map[string]interface{}) (*User, error)
	AddEducation(ctx context.Context, userID string, edu Education) (*User, error)
	UpdateEducation(ctx context.Context, userID string, eduID string, edu Education) (*User, error)
	DeleteEducation(ctx context.Context, userID string, eduID string) (*User, error)
	AddExperience(ctx context.Context, userID string, exp Experience) (*User, error)
	UpdateExperience(ctx context.Context, userID string, expID string, exp Experience) (*User, error)
	DeleteExperience(ctx context.Context, userID string, expID string) (*User, error)
	AddProject(ctx context.Context, userID string, project Project) (*User, error)
	UpdateProject(ctx context.Context, userID string, projectID string, project Project) (*User, error)
	DeleteProject(ctx context.Context, userID string, projectID string) (*User, error)
	AddSkill(ctx context.Context, userID string, skillName string) (*User, error)
	DeleteSkill(ctx context.Context, userID string, skillName string) (*User, error)
	SendEmailOTP(ctx context.Context, email string) error
	VerifyEmailOTP(ctx context.Context, email, code string, userID string) error
	ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error
	ResetPassword(ctx context.Context, req ResetPasswordRequest) error
	GetAllUsers(ctx context.Context) ([]*User, error)
	GetCommunityUsers(ctx context.Context) ([]*User, error)
	GetExperts(ctx context.Context) ([]*User, error)
	SearchUsers(ctx context.Context, query string) ([]*User, error)
	ApplyForExpert(ctx context.Context, userID string, req ApplyExpertRequest) (*User, error)
	ApproveExpert(ctx context.Context, adminID string, targetUserID string, req ApproveExpertRequest) (*User, error)
	GetExpertApplication(ctx context.Context, userID string) (*ExpertApplicationStatus, error)
	GetExpertRequests(ctx context.Context) ([]*User, error)
	ToggleBookmark(ctx context.Context, userID string, jobID string) ([]string, error)
	GetUserSettings(ctx context.Context, userID string) (*UserSettings, error)
	UpdateUserSettings(ctx context.Context, userID string, settings UserSettings) (*UserSettings, error)
	GetPlatformStats(ctx context.Context) (map[string]interface{}, error)
	GetLiveActivity(ctx context.Context) ([]map[string]interface{}, error)
	RecordProfileView(ctx context.Context, targetUserID, viewerID string) error
	GetProfileViewers(ctx context.Context, userID string) ([]*User, error)
	RecordPostImpressions(ctx context.Context, viewerID string, authorIDs []string) error
	UpdateUsername(ctx context.Context, userID, newUsername string) (*User, error)
	CheckUsernameAvailability(ctx context.Context, currentUserID, username string) (bool, string, error)
	UpdateOpenToWork(ctx context.Context, userID string, prefs OpenToWorkPreferences) (*User, error)
	UpdateProvidingServices(ctx context.Context, userID string, prefs ProvidingServicesPreferences) (*User, error)
	GetProfileCompletion(ctx context.Context, userID string) (*ProfileCompletion, error)
	ExportUsersCSV(ctx context.Context, role string) ([]byte, error)
	ExportJobsCSV(ctx context.Context, status string) ([]byte, error)
	ExportRevenueCSV(ctx context.Context, status string) ([]byte, error)
	GlobalSearch(ctx context.Context, query string) (*GlobalSearchResponse, error)
}

type UserServiceImpl struct {
	repo       UserRepository
	smsService sms.SMSService
	skillRepo  skill.SkillRepository
	config     *config.Config
	mailer     notification.Mailer
	notifier   notification.NotificationService
}

func NewUserService(repo UserRepository, smsService sms.SMSService, skillRepo skill.SkillRepository, cfg *config.Config, mailer notification.Mailer, notifier notification.NotificationService) UserService {
	// Trigger non-destructive background backfill for legacy users
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = repo.BackfillUsernames(bgCtx)
	}()

	return &UserServiceImpl{
		repo:       repo,
		smsService: smsService,
		skillRepo:  skillRepo,
		config:     cfg,
		mailer:     mailer,
		notifier:   notifier,
	}
}

const (
	otpResendCooldown  = 30 * time.Second
	// minPasswordLength applies to new passwords only (NIST SP 800-63B minimum);
	// existing shorter passwords still sign in
	minPasswordLength = 8
	otpMaxSendsPerHour = 5
	otpMaxAttempts     = 5
)

// Roles a person can obtain by signing in through a portal. Expert and admin
// are only granted after payment / admin approval, never by self-service.
var selfServiceRoles = []string{RoleUser, RoleRecruiter}

// generateOTPCode returns a cryptographically random 4-digit code
var errPasswordTooShort = fmt.Errorf("password must be at least %d characters long", minPasswordLength)

func generateOTPCode() (string, error) {
	n, err := crand.Int(crand.Reader, big.NewInt(10000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n.Int64()), nil
}

// checkOTPCode compares a submitted code and burns the OTP after too many wrong attempts
func (s *UserServiceImpl) checkOTPCode(ctx context.Context, otp *OTP, code string) error {
	if otp.Code == strings.TrimSpace(code) {
		return nil
	}
	if otp.Attempts+1 >= otpMaxAttempts {
		_ = s.repo.MarkOTPUsed(ctx, otp.ID)
		return apperr.New("OTP_TOO_MANY_ATTEMPTS", "too many incorrect attempts. Please request a new code")
	}
	_ = s.repo.IncrementOTPAttempts(ctx, otp.ID)
	return apperr.New("OTP_INVALID", "Invalid OTP")
}

// ensureEmailAvailable returns an error if another account already uses this email
func (s *UserServiceImpl) ensureEmailAvailable(ctx context.Context, userID primitive.ObjectID, email string) error {
	existing, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		return err
	}
	if existing != nil && existing.ID != userID {
		return apperr.New("EMAIL_TAKEN", "this email address is already linked to another account")
	}
	return nil
}

// applyEmailChange sets a new email on the user. A changed email is always unverified;
// verification is only granted server-side by VerifyEmailOTP.
func applyEmailChange(user *User, email string) {
	normalized := strings.ToLower(strings.TrimSpace(email))
	if normalized == "" || strings.EqualFold(normalized, user.Email) {
		return
	}
	user.Email = normalized
	user.IsEmailVerified = false
	user.EmailVerifiedAt = nil
}

func (s *UserServiceImpl) SendOTP(ctx context.Context, mobile string, role string) error {
	cleaned := cleanMobile(mobile)
	if len(cleaned) != 10 {
		return errors.New("please enter a valid 10-digit mobile number")
	}

	if role != RoleAdmin && !slices.Contains(selfServiceRoles, role) {
		return errors.New("invalid sign-in portal")
	}

	// For admin portal login, verify that user actually exists and has admin privileges
	if role == RoleAdmin {
		user, err := s.repo.FindUserByMobile(ctx, cleaned)
		if err != nil || user == nil || !slices.Contains(user.Roles, RoleAdmin) {
			return errors.New("access denied: no admin account found with this mobile number")
		}
	}

	// Throttle: one code per cooldown window and a capped number per hour
	latest, err := s.repo.GetLatestOTP(ctx, cleaned)
	if err != nil {
		return err
	}
	if latest != nil && time.Since(latest.CreatedAt) < otpResendCooldown {
		return errors.New("please wait a few seconds before requesting a new code")
	}
	sentLastHour, err := s.repo.CountMobileOTPsSince(ctx, cleaned, time.Now().Add(-time.Hour))
	if err != nil {
		return err
	}
	if sentLastHour >= otpMaxSendsPerHour {
		return apperr.New("OTP_TOO_MANY_REQUESTS", "too many code requests. Please try again after some time")
	}

	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	// Create OTP record (stored with cleaned 10-digit mobile for consistent lookup)
	otp := &OTP{
		Mobile: cleaned,
		Code:   code,
	}

	err = s.repo.SaveOTP(ctx, otp)
	if err != nil {
		return err
	}

	// Send via SMS Service
	_, err = s.smsService.SendSMS(ctx, cleaned, "KM_SMS_LOGIN_OTP", []string{code})
	if err != nil {
		return err
	}

	return nil
}

func (s *UserServiceImpl) VerifyOTP(ctx context.Context, mobile, code string, role string) (*VerifyOTPResponse, error) {
	if role != RoleAdmin && !slices.Contains(selfServiceRoles, role) {
		return nil, errors.New("invalid sign-in portal")
	}

	cleaned := cleanMobile(mobile)
	if len(cleaned) != 10 {
		cleaned = mobile
	}

	// 1. Get latest OTP (check cleaned 10-digit mobile first, fallback to raw input)
	otp, err := s.repo.GetLatestOTP(ctx, cleaned)
	if err != nil {
		return nil, err
	}
	if otp == nil && cleaned != mobile {
		otp, _ = s.repo.GetLatestOTP(ctx, mobile)
	}
	if otp == nil {
		return nil, apperr.New("OTP_EXPIRED", "OTP not found or expired")
	}

	// 2. Verify Code (invalidates the code after too many wrong attempts)
	if err := s.checkOTPCode(ctx, otp, code); err != nil {
		return nil, err
	}

	// 3. Mark OTP used
	if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
		return nil, err
	}

	// 4. Find or Create User
	user, err := s.repo.FindUserByMobile(ctx, cleaned)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if user == nil {
		// Admin cannot be created via self-serve OTP login
		if role == RoleAdmin {
			return nil, errors.New("admin account not found")
		}

		// Create new user (unregistered)
		user = &User{
			Mobile:        cleaned,
			IsRegistered:  false,
			OTPVerifiedAt: &now,
			Roles:         []string{role}, // Use requested role
		}
		user, err = s.repo.CreateUser(ctx, user)
		if err != nil {
			return nil, err
		}
	} else {
		// Verify role authorization
		if role == RoleAdmin {
			if !slices.Contains(user.Roles, RoleAdmin) {
				return nil, errors.New("access denied: user does not have admin privileges")
			}
		} else {
			// Industry standard (LinkedIn/Uber/Urban Company style):
			// If an existing candidate logs into employer portal or vice-versa,
			// expand their role profile so they can operate freely in both portals.
			if !slices.Contains(user.Roles, role) {
				user.Roles = append(user.Roles, role)
			}
		}

		// Update existing user
		user.OTPVerifiedAt = &now
		user, err = s.repo.UpdateUser(ctx, user)
		if err != nil {
			return nil, err
		}
	}

	// 5. Generate Token
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &VerifyOTPResponse{
		Token:        token,
		IsRegistered: user.IsRegistered,
		User:         user,
	}, nil
}

func (s *UserServiceImpl) Register(ctx context.Context, userID string, req RegisterRequest) (*User, error) {
	// Setup user profile
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	name := strings.TrimSpace(req.Name)
	if len(name) < 2 {
		return nil, errors.New("please enter your full name")
	}

	// Update fields
	user.Name = name
	registeringRecruiter := false
	for _, r := range req.Roles {
		// Only portal roles can be self-assigned; expert/admin need approval
		if !slices.Contains(selfServiceRoles, r) {
			continue
		}
		if r == RoleRecruiter {
			registeringRecruiter = true
		}
		if !slices.Contains(user.Roles, r) {
			user.Roles = append(user.Roles, r)
		}
	}
	if len(user.Roles) == 0 {
		user.Roles = []string{RoleUser}
	}
	user.IsRegistered = true
	user.UpdatedAt = time.Now()

	// Profile fields: only overwrite what was sent, so completing one portal's
	// onboarding never wipes details saved from the other portal.
	if req.Gender != "" {
		user.Gender = req.Gender
	}
	if req.EducationLevel != "" {
		user.EducationLevel = req.EducationLevel
	}
	if req.WorkExperience != "" {
		user.WorkExperience = req.WorkExperience
	}
	if strings.TrimSpace(req.City) != "" {
		user.City = strings.TrimSpace(req.City)
	}
	if len(req.JobCategories) > 0 {
		user.JobCategories = req.JobCategories
	}
	if req.ExperienceDetail != "" {
		user.ExperienceDetail = req.ExperienceDetail
	}
	if req.Headline != "" {
		user.Headline = req.Headline
	}
	if len(req.Skills) > 0 {
		user.Skills = req.Skills
	}
	if strings.TrimSpace(req.Email) != "" {
		email := strings.ToLower(strings.TrimSpace(req.Email))
		if !emailRegex.MatchString(email) {
			return nil, apperr.New("EMAIL_INVALID", "please enter a valid email address")
		}
		if err := s.ensureEmailAvailable(ctx, user.ID, email); err != nil {
			return nil, err
		}
		applyEmailChange(user, email)
	}
	if req.Password != "" {
		if len(req.Password) < minPasswordLength {
			return nil, errPasswordTooShort
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		user.Password = string(hashed)
	}
	if registeringRecruiter {
		user.IsConsultant = req.IsConsultant
	}
	if req.CompanyName != "" {
		user.CompanyName = req.CompanyName
	}
	if req.CompanyWebsite != "" {
		user.CompanyWebsite = req.CompanyWebsite
	}
	if req.CompanyLogo != "" {
		user.CompanyLogo = req.CompanyLogo
	}
	if req.GST != "" {
		user.GST = req.GST
	}
	if req.Industry != "" {
		user.Industry = req.Industry
	}
	var docs []Document
	for _, d := range req.CompanyDocuments {
		if strings.TrimSpace(d.URL) != "" {
			docs = append(docs, Document{Name: strings.TrimSpace(d.Name), URL: strings.TrimSpace(d.URL)})
		}
	}
	if len(docs) > 0 {
		user.CompanyDocuments = docs
	}

	updatedUser, err := s.repo.UpdateUser(ctx, user)
	if err != nil {
		return nil, err
	}

	return updatedUser, nil
}

func (s *UserServiceImpl) GetProfile(ctx context.Context, userID string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	if user.Username == "" {
		user.Username = GenerateDefaultUsername(user.Name, user.ID.Hex())
		_, _ = s.repo.UpdateUser(ctx, user)
	}
	user.HasPassword = user.Password != ""
	return user, nil
}

func (s *UserServiceImpl) GetProfileCompletion(ctx context.Context, userID string) (*ProfileCompletion, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	completion := CalculateProfileCompletion(user)
	return &completion, nil
}

func (s *UserServiceImpl) GenerateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"sub":    user.ID.Hex(),
		"mobile": user.Mobile,
		"email":  user.Email,
		"roles":  user.Roles,
		"sv":     user.SessionVersion, // must match the stored version (see middleware.AuthMiddleware)
		"exp":    time.Now().Add(time.Hour * 72).Unix(), // 3 days
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func (s *UserServiceImpl) UpdateProfile(ctx context.Context, userID string, updates map[string]interface{}) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Email is applied before the loop so a changed email always resets verification,
	// regardless of map iteration order (an admin may still set is_email_verified after it).
	if v, ok := updates["email"].(string); ok && strings.TrimSpace(v) != "" {
		email := strings.ToLower(strings.TrimSpace(v))
		if !emailRegex.MatchString(email) {
			return nil, apperr.New("EMAIL_INVALID", "please enter a valid email address")
		}
		if err := s.ensureEmailAvailable(ctx, user.ID, email); err != nil {
			return nil, err
		}
		applyEmailChange(user, email)
	}

	// Dynamic update (simplified for now, can be improved with reflection or specific checks)
	for key, value := range updates {
		switch key {
		case "mobile":
			if v, ok := value.(string); ok && strings.TrimSpace(v) != "" {
				user.Mobile = cleanMobile(v)
			}
		case "date_of_birth":
			if v, ok := value.(string); ok {
				user.DateOfBirth = v
			}
		case "name":
			if v, ok := value.(string); ok {
				user.Name = v
			}
		case "first_name":
			if v, ok := value.(string); ok {
				user.FirstName = v
			}
		case "last_name":
			if v, ok := value.(string); ok {
				user.LastName = v
			}
		case "headline":
			if v, ok := value.(string); ok {
				user.Headline = v
			}
		case "about":
			if v, ok := value.(string); ok {
				user.About = v
			}
		case "additional_name":
			if v, ok := value.(string); ok {
				user.AdditionalName = v
			}
		case "pronouns":
			if v, ok := value.(string); ok {
				user.Pronouns = v
			}
		case "address":
			if v, ok := value.(string); ok {
				user.Address = v
			}
		case "profile_image":
			if v, ok := value.(string); ok {
				user.ProfileImage = v
			}
		case "cover_image":
			if v, ok := value.(string); ok {
				user.CoverImage = v
			}
		case "gender":
			if v, ok := value.(string); ok {
				user.Gender = v
			}
		case "city":
			if v, ok := value.(string); ok {
				user.City = v
			}
		case "is_email_verified":
			if v, ok := value.(bool); ok {
				user.IsEmailVerified = v
				if v {
					now := time.Now()
					user.EmailVerifiedAt = &now
				}
			}
		case "roles":
			if v, ok := value.([]string); ok {
				user.Roles = v
			} else if v, ok := value.([]interface{}); ok {
				var strRoles []string
				for _, item := range v {
					if strItem, ok := item.(string); ok {
						strRoles = append(strRoles, strItem)
					}
				}
				user.Roles = strRoles
			}
		case "portfolio_url":
			if v, ok := value.(string); ok {
				user.PortfolioURL = v
			}
		case "portfolio_label":
			if v, ok := value.(string); ok {
				user.PortfolioLabel = v
			}
		case "state":
			if v, ok := value.(string); ok {
				user.State = v
			}
		case "country":
			if v, ok := value.(string); ok {
				user.Country = v
			}
		case "skills":
			if v, ok := value.([]string); ok {
				user.Skills = v
			} else if v, ok := value.([]interface{}); ok {
				var strSkills []string
				for _, item := range v {
					if strItem, ok := item.(string); ok {
						strSkills = append(strSkills, strItem)
					}
				}
				user.Skills = strSkills
			}
		case "last_login_lat":
			if v, ok := value.(float64); ok {
				user.LastLoginLat = v
			}
		case "last_login_lng":
			if v, ok := value.(float64); ok {
				user.LastLoginLng = v
			}
		case "company_name":
			if v, ok := value.(string); ok {
				user.CompanyName = v
			}
		case "company_logo":
			if v, ok := value.(string); ok {
				user.CompanyLogo = v
			}
		case "company_website":
			if v, ok := value.(string); ok {
				user.CompanyWebsite = v
			}
		case "gst":
			if v, ok := value.(string); ok {
				user.GST = v
			}
		case "is_consultant":
			if v, ok := value.(bool); ok {
				user.IsConsultant = v
			}
		case "verification_status":
			if v, ok := value.(string); ok {
				user.VerificationStatus = v
			}
		}
	}

	// Since we are using Mongo, replacing the whole doc or using $set is fine.
	// Our repo has UpdateUser which does ReplaceOne.
	// For better scalability with nested arrays, we should add specific Push/Pull methods in repo.

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) AddEducation(ctx context.Context, userID string, edu Education) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if edu.ID == "" {
		edu.ID = primitive.NewObjectID().Hex()
	}
	user.Education = append(user.Education, edu)
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) UpdateEducation(ctx context.Context, userID string, eduID string, updated Education) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	found := false
	for i, edu := range user.Education {
		if edu.ID == eduID {
			updated.ID = eduID
			user.Education[i] = updated
			found = true
			break
		}
	}
	if !found {
		return nil, errors.New("education entry not found")
	}

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) DeleteEducation(ctx context.Context, userID string, eduID string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	filtered := make([]Education, 0, len(user.Education))
	for _, edu := range user.Education {
		if edu.ID != eduID {
			filtered = append(filtered, edu)
		}
	}
	user.Education = filtered
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) AddExperience(ctx context.Context, userID string, exp Experience) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	if exp.ID == "" {
		exp.ID = primitive.NewObjectID().Hex()
	}
	user.Experience = append(user.Experience, exp)
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) UpdateExperience(ctx context.Context, userID string, expID string, updated Experience) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	found := false
	for i, exp := range user.Experience {
		if exp.ID == expID {
			updated.ID = expID
			user.Experience[i] = updated
			found = true
			break
		}
	}
	if !found {
		return nil, errors.New("experience entry not found")
	}

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) DeleteExperience(ctx context.Context, userID string, expID string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	filtered := make([]Experience, 0, len(user.Experience))
	for _, exp := range user.Experience {
		if exp.ID != expID {
			filtered = append(filtered, exp)
		}
	}
	user.Experience = filtered
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) AddProject(ctx context.Context, userID string, project Project) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	project.Title = strings.TrimSpace(project.Title)
	if project.Title == "" {
		return nil, errors.New("project title is required")
	}

	if project.ID == "" {
		project.ID = primitive.NewObjectID().Hex()
	}
	user.Projects = append(user.Projects, project)
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) UpdateProject(ctx context.Context, userID string, projectID string, updated Project) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	updated.Title = strings.TrimSpace(updated.Title)
	if updated.Title == "" {
		return nil, errors.New("project title is required")
	}

	found := false
	for i, p := range user.Projects {
		if p.ID == projectID {
			updated.ID = projectID
			user.Projects[i] = updated
			found = true
			break
		}
	}

	if !found {
		return nil, errors.New("project not found")
	}

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) DeleteProject(ctx context.Context, userID string, projectID string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	filteredProjects := make([]Project, 0, len(user.Projects))
	for _, p := range user.Projects {
		if p.ID != projectID {
			filteredProjects = append(filteredProjects, p)
		}
	}
	user.Projects = filteredProjects
	return s.repo.UpdateUser(ctx, user)
}

// ErrSkillNotInCatalogue: profile skills must come from the admin-managed skills catalogue
var ErrSkillNotInCatalogue = apperr.New("SKILL_NOT_IN_CATALOGUE", "This skill isn't in the KaamMilega skills list. Pick one from the suggestions.")

// ErrSkillRequired: an empty skill name
var ErrSkillRequired = apperr.New("SKILL_REQUIRED", "Enter a skill to add.")

func (s *UserServiceImpl) AddSkill(ctx context.Context, userID string, skillName string) (*User, error) {
	skillName = strings.TrimSpace(skillName)
	if skillName == "" {
		return nil, ErrSkillRequired
	}
	// 1. Verify skill exists in admin-defined skills (case-insensitive)
	existingSkill, err := s.skillRepo.GetSkillByName(ctx, skillName)
	if err != nil {
		return nil, err
	}
	if existingSkill == nil {
		return nil, ErrSkillNotInCatalogue
	}
	// Store the catalogue's spelling, not what was typed
	skillName = existingSkill.Name

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Check if skill already added
	for _, skill := range user.Skills {
		if skill == skillName {
			return user, nil // Already exists
		}
	}

	user.Skills = append(user.Skills, skillName)
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) DeleteSkill(ctx context.Context, userID string, skillName string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	filtered := make([]string, 0, len(user.Skills))
	for _, skill := range user.Skills {
		if !strings.EqualFold(skill, skillName) {
			filtered = append(filtered, skill)
		}
	}
	user.Skills = filtered
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) SendEmailOTP(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if !emailRegex.MatchString(email) {
		return apperr.New("EMAIL_INVALID", "please enter a valid email address")
	}

	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	// Create OTP record
	otp := &OTP{
		Email: email,
		Code:  code,
	}

	err = s.repo.SaveOTP(ctx, otp)
	if err != nil {
		return err
	}

	// Never write live codes to production logs; keep it for local development only
	if s.config.Environment != "production" {
		fmt.Printf("Email OTP generated for %s: %s\n", email, code)
	}

	// Send verification email via centralized mailer if available
	if s.mailer != nil {
		if err := s.mailer.SendEmailOTP(notification.EmailOTPParams{
			ToEmail: email,
			Code:    code,
			Purpose: "verification",
		}); err != nil {
			fmt.Printf("Error sending verification email via mailer: %v\n", err)
			return fmt.Errorf("failed to send email: %w", err)
		}
		fmt.Printf("Successfully sent verification email to %s via notification mailer\n", email)
		return nil
	}

	// Fallback direct SMTP if mailer not wired
	if s.config.SMTPUsername != "" && s.config.SMTPPassword != "" {
		subject := "KaamMilega Verification Code"
		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #d9e0ea; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(7, 26, 77, 0.06);">
          <tr>
            <td style="background: linear-gradient(90deg, #0B5ED7 0%%, #FF6B00 100%%); height: 4px; line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 20px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <a href="https://kaammilega.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="https://kaammilega.com/kaammilega-logo-icon.png" alt="KaamMilega Icon" width="38" height="39" style="display: block; width: 38px; height: 39px; max-width: 38px; border: 0; outline: none; text-decoration: none;" />
                    </a>
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="https://kaammilega.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="https://kaammilega.com/kaammilega-logo-text.png" alt="Kaammilega™" width="158" height="28" style="display: block; width: 158px; height: 28px; max-width: 158px; border: 0; outline: none; text-decoration: none;" />
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 14px;">
                <span style="display: inline-block; background-color: #f4f7fb; border: 1px solid #d9e0ea; color: #0b5ed7; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 20px;">
                  Email Verification Code
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; color: #374151; font-size: 15px; line-height: 1.65;">
              <p style="margin: 0 0 16px 0; font-weight: 600; color: #111827;">Hello,</p>
              <p style="margin: 0 0 24px 0; color: #5b6472;">Please use the 4-digit verification code below to confirm your email address and complete your account setup:</p>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #eff6ff; border: 2px dashed #0b5ed7; border-radius: 16px; padding: 24px 20px;">
                    <div style="font-size: 38px; font-weight: 900; color: #071a4d; letter-spacing: 14px; font-family: 'Courier New', Courier, monospace; margin-left: 14px;">%s</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ff6b00; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #9a3412; line-height: 1.5;">
                    ⏱️ <strong>Security Notice:</strong> This code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #8f9aa8; font-size: 13px;">If you did not request this email, please safely ignore it.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; color: #8f9aa8; font-size: 11px; line-height: 1.6;">
              &copy; 2026 KaamMilega Platform Pvt. Ltd. &middot; All rights reserved.<br>
              <a href="https://kaammilega.com" style="color: #0b5ed7; text-decoration: none; font-weight: 600;">kaammilega.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, code)

		err := sendSESEmail(
			s.config.SMTPHost,
			s.config.SMTPPort,
			s.config.SMTPUsername,
			s.config.SMTPPassword,
			s.config.SMTPFromEmail,
			s.config.SMTPFromName,
			email,
			subject,
			htmlBody,
		)
		if err != nil {
			fmt.Printf("Error sending email via direct SMTP: %v\n", err)
			return fmt.Errorf("failed to send email: %w", err)
		}
		fmt.Printf("Successfully sent verification email to %s via direct SMTP\n", email)
	}

	return nil
}

func sendSESEmail(smtpHost, smtpPort, username, password, fromEmail, fromName, toEmail, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
	auth := smtp.PlainAuth("", username, password, smtpHost)

	header := make(map[string]string)
	header["From"] = fmt.Sprintf("%s <%s>", fromName, fromEmail)
	header["To"] = toEmail
	header["Subject"] = subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/html; charset=UTF-8"

	message := ""
	for k, v := range header {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body

	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("failed to dial SMTP server: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         smtpHost,
	}

	if err = client.StartTLS(tlsConfig); err != nil {
		return fmt.Errorf("failed to execute StartTLS: %w", err)
	}

	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate SMTP: %w", err)
	}

	if err = client.Mail(fromEmail); err != nil {
		return fmt.Errorf("failed to set MAIL FROM: %w", err)
	}

	if err = client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("failed to set RCPT TO: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to send DATA command: %w", err)
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

func (s *UserServiceImpl) VerifyEmailOTP(ctx context.Context, email, code string, userID string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	otp, err := s.repo.GetLatestEmailOTP(ctx, email)
	if err != nil {
		return err
	}
	if otp == nil {
		return apperr.New("OTP_EXPIRED", "OTP not found or expired")
	}

	if err := s.checkOTPCode(ctx, otp, code); err != nil {
		return err
	}

	now := time.Now()

	// If logged-in user ID is passed, update user directly
	if userID != "" {
		user, _ := s.repo.FindUserByID(ctx, userID)
		if user != nil {
			if err := s.ensureEmailAvailable(ctx, user.ID, email); err != nil {
				return err
			}
			if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
				return err
			}
			user.Email = email
			user.IsEmailVerified = true
			user.EmailVerifiedAt = &now
			_, err := s.repo.UpdateUser(ctx, user)
			return err
		}
	}

	if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
		return err
	}

	// If user exists with this email, mark as verified
	user, _ := s.repo.FindUserByEmail(ctx, email)
	if user != nil {
		user.IsEmailVerified = true
		user.EmailVerifiedAt = &now
		_, _ = s.repo.UpdateUser(ctx, user)
	}

	return nil
}

func (s *UserServiceImpl) GetAllUsers(ctx context.Context) ([]*User, error) {
	// Admin user list: includes deactivated/deleted and private accounts
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Role: RoleUser, AdminView: true})
	return users, err
}

func (s *UserServiceImpl) GetCommunityUsers(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Role: RoleUser, Limit: 12})
	return users, err
}

func (s *UserServiceImpl) GetExperts(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Role: RoleExpert})
	return users, err
}

func (s *UserServiceImpl) SearchUsers(ctx context.Context, query string) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Search: query, Limit: 20})
	if err == nil && len(users) > 0 {
		go func(found []*User) {
			for _, u := range found {
				u.SearchAppearances++
				_, _ = s.repo.UpdateUser(context.Background(), u)
			}
		}(users)
	}
	return users, err
}

func (s *UserServiceImpl) GetExpertRequests(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{ExpertApprovalStatus: "pending", AdminView: true})
	return users, err
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (s *UserServiceImpl) LoginWithPassword(ctx context.Context, req PasswordLoginRequest) (*PasswordLoginResponse, error) {
	identifier := strings.TrimSpace(req.Email)
	if identifier == "" && req.Identifier != "" {
		identifier = strings.TrimSpace(req.Identifier)
	}
	req.Password = strings.TrimSpace(req.Password)

	if identifier == "" || req.Password == "" {
		return nil, errors.New("email or mobile and password are required")
	}

	var user *User
	var err error

	// If identifier is formatted as a 10-digit mobile number, search by mobile first
	cleaned := cleanMobile(identifier)
	if len(cleaned) == 10 {
		user, err = s.repo.FindUserByMobile(ctx, cleaned)
	}

	// If not found by mobile or identifier is an email, search by email
	if user == nil {
		user, err = s.repo.FindUserByEmail(ctx, strings.ToLower(identifier))
	}
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("invalid email/mobile or password")
	}

	// FIRST-TIME PASSWORD CREATION HOOK:
	// If candidate registered via Mobile OTP and never created a password,
	// return a guided setup prompt response instead of a blocking error.
	if user.Password == "" {
		return &PasswordLoginResponse{
			RequiresPasswordSetup: true,
			Message:               "This account has no password yet. Sign in with Mobile OTP, then create a password from Settings.",
		}, nil
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Role enforcement
	if req.Role != "" {
		hasTargetRole := slices.Contains(user.Roles, req.Role)
		if !hasTargetRole {
			switch req.Role {
			case RoleRecruiter:
				return nil, errors.New("This account is registered as a Candidate. Please sign in via the Candidate portal.")
			case RoleUser:
				return nil, errors.New("This account is registered as a Recruiter. Please sign in via the Recruiter portal.")
			default:
				return nil, errors.New("access denied: unauthorized role for this portal")
			}
		}
	}

	// Update last active
	user.LastActiveAt = time.Now()
	_, _ = s.repo.UpdateUser(ctx, user)

	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate auth token: %w", err)
	}

	return &PasswordLoginResponse{
		Token:        token,
		User:         user,
		IsRegistered: user.IsRegistered,
	}, nil
}

func (s *UserServiceImpl) RegisterWithPassword(ctx context.Context, req PasswordRegisterRequest) (*PasswordLoginResponse, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Name == "" {
		return nil, errors.New("full name is required")
	}
	if req.Email == "" {
		return nil, errors.New("email address is required")
	}
	if !emailRegex.MatchString(req.Email) {
		return nil, apperr.New("EMAIL_INVALID", "please enter a valid email address")
	}
	if req.Password == "" {
		return nil, errors.New("password is required")
	}
	if len(req.Password) < minPasswordLength {
		return nil, errPasswordTooShort
	}

	existing, err := s.repo.FindUserByEmail(ctx, req.Email)
	if err == nil && existing != nil {
		return nil, apperr.New("EMAIL_TAKEN", "an account with this email already exists")
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	role := req.Role
	if role == "" {
		role = RoleUser
	}
	if !slices.Contains(selfServiceRoles, role) {
		return nil, errors.New("invalid sign-up portal")
	}

	now := time.Now()
	newUser := &User{
		Name:         req.Name,
		Email:        req.Email,
		Password:     string(hashedBytes),
		Roles:        []string{role},
		IsRegistered: false,
		CreatedAt:    now,
		UpdatedAt:    now,
		LastActiveAt: now,
	}

	createdUser, err := s.repo.CreateUser(ctx, newUser)
	if err != nil {
		return nil, err
	}

	token, err := s.GenerateToken(createdUser)
	if err != nil {
		return nil, fmt.Errorf("failed to generate auth token: %w", err)
	}

	return &PasswordLoginResponse{
		Token:        token,
		User:         createdUser,
		IsRegistered: createdUser.IsRegistered,
	}, nil
}

func (s *UserServiceImpl) SetPassword(ctx context.Context, userID string, req SetPasswordRequest) error {
	if len(req.NewPassword) < minPasswordLength {
		return errPasswordTooShort
	}

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	// Changing an existing password always needs the current one. (Previously an empty
	// current_password skipped the check, so a stolen session could take over the account.)
	// Accounts created by OTP have no password yet and may set a first one.
	if user.Password != "" {
		if req.CurrentPassword == "" {
			return errors.New("enter your current password")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)); err != nil {
			return errors.New("incorrect current password")
		}
		if req.CurrentPassword == req.NewPassword {
			return errors.New("new password must be different from the current one")
		}
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	if err := s.repo.UpdatePassword(ctx, userID, string(hashedBytes)); err != nil {
		return err
	}
	// A password change signs out every other device (the controller re-issues this one)
	return s.RevokeSessions(ctx, userID)
}

// CanViewProfile applies the owner's account status and profile_visibility setting to a viewer.
//   - deactivated / pending deletion / deleted accounts: admins only
//   - "private": recruiters the owner applied to, and admins
//   - "connections": accepted connections, recruiters the owner applied to, and admins
func (s *UserServiceImpl) CanViewProfile(ctx context.Context, owner *User, viewerID string, viewerIsAdmin bool) (bool, error) {
	if viewerIsAdmin || owner.ID.Hex() == viewerID {
		return true, nil
	}
	if !IsActiveAccount(owner.AccountStatus) {
		return false, nil
	}
	switch owner.Settings.ProfileVisibility {
	case "private":
		if viewerID == "" {
			return false, nil
		}
		return s.repo.HasRestrictedProfileAccess(ctx, owner.ID.Hex(), viewerID, false)
	case "connections":
		if viewerID == "" {
			return false, nil
		}
		return s.repo.HasRestrictedProfileAccess(ctx, owner.ID.Hex(), viewerID, true)
	default:
		return true, nil
	}
}

// RevokeSessions signs the user out on every device by invalidating all issued tokens
func (s *UserServiceImpl) RevokeSessions(ctx context.Context, userID string) error {
	if _, err := s.repo.BumpSessionVersion(ctx, userID); err != nil {
		return err
	}
	middleware.InvalidateSession(userID)
	return nil
}

func (s *UserServiceImpl) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return errors.New("email address is required")
	}
	if !emailRegex.MatchString(email) {
		return apperr.New("EMAIL_INVALID", "please enter a valid email address")
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		return err
	}
	if user == nil {
		return apperr.New("EMAIL_NOT_FOUND", "no account found with this email address")
	}

	// Check if this is an OTP-only account with no password set
	if user.Password == "" {
		return errors.New("no password has been set for this account. Please use 'Login with OTP' to sign in.")
	}

	// Role enforcement if role provided
	if req.Role != "" && !slices.Contains(user.Roles, req.Role) {
		if req.Role == "recruiter" && slices.Contains(user.Roles, "user") {
			return errors.New("This account is registered as a Candidate. Please use the Candidate portal to reset your password.")
		}
		if req.Role == "user" && slices.Contains(user.Roles, "recruiter") {
			return errors.New("This account is registered as a Recruiter. Please use the Recruiter portal to reset your password.")
		}
		return fmt.Errorf("this account does not have the %s role", req.Role)
	}

	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	otp := &OTP{
		Email: email,
		Code:  code,
	}

	if err := s.repo.SaveOTP(ctx, otp); err != nil {
		return err
	}

	// Send reset email via centralized mailer if available
	if s.mailer != nil {
		if err := s.mailer.SendEmailOTP(notification.EmailOTPParams{
			ToEmail: email,
			Code:    code,
			Purpose: "password_reset",
		}); err != nil {
			fmt.Printf("Error sending password reset email via mailer: %v\n", err)
			return fmt.Errorf("failed to send reset email: %w", err)
		}
		fmt.Printf("Successfully sent password reset email to %s via notification mailer\n", email)
		return nil
	}

	// Fallback direct SMTP if mailer not wired
	if s.config.SMTPUsername != "" && s.config.SMTPPassword != "" {
		subject := "KaamMilega Password Reset Code"
		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #d9e0ea; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(7, 26, 77, 0.06);">
          <tr>
            <td style="background: linear-gradient(90deg, #0B5ED7 0%%, #FF6B00 100%%); height: 4px; line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 20px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <a href="https://kaammilega.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="https://kaammilega.com/kaammilega-logo-icon.png" alt="KaamMilega Icon" width="38" height="39" style="display: block; width: 38px; height: 39px; max-width: 38px; border: 0; outline: none; text-decoration: none;" />
                    </a>
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="https://kaammilega.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="https://kaammilega.com/kaammilega-logo-text.png" alt="Kaammilega™" width="158" height="28" style="display: block; width: 158px; height: 28px; max-width: 158px; border: 0; outline: none; text-decoration: none;" />
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 14px;">
                <span style="display: inline-block; background-color: #f4f7fb; border: 1px solid #d9e0ea; color: #0b5ed7; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 20px;">
                  Password Reset Code
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; color: #374151; font-size: 15px; line-height: 1.65;">
              <p style="margin: 0 0 16px 0; font-weight: 600; color: #111827;">Hello,</p>
              <p style="margin: 0 0 24px 0; color: #5b6472;">We received a request to reset your password. Use the 4-digit verification code below to proceed with setting a new password:</p>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #eff6ff; border: 2px dashed #0b5ed7; border-radius: 16px; padding: 24px 20px;">
                    <div style="font-size: 38px; font-weight: 900; color: #071a4d; letter-spacing: 14px; font-family: 'Courier New', Courier, monospace; margin-left: 14px;">%s</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ff6b00; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #9a3412; line-height: 1.5;">
                    ⏱️ <strong>Security Notice:</strong> This code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #8f9aa8; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; color: #8f9aa8; font-size: 11px; line-height: 1.6;">
              &copy; 2026 KaamMilega Platform Pvt. Ltd. &middot; All rights reserved.<br>
              <a href="https://kaammilega.com" style="color: #0b5ed7; text-decoration: none; font-weight: 600;">kaammilega.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, code)

		err := sendSESEmail(
			s.config.SMTPHost,
			s.config.SMTPPort,
			s.config.SMTPUsername,
			s.config.SMTPPassword,
			s.config.SMTPFromEmail,
			s.config.SMTPFromName,
			email,
			subject,
			htmlBody,
		)
		if err != nil {
			fmt.Printf("Error sending password reset email via direct SMTP: %v\n", err)
			return fmt.Errorf("failed to send reset email: %w", err)
		}
		fmt.Printf("Successfully sent password reset email to %s via direct SMTP\n", email)
	}

	return nil
}

func (s *UserServiceImpl) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	code := strings.TrimSpace(req.Code)
	newPassword := strings.TrimSpace(req.NewPassword)

	if email == "" || code == "" || newPassword == "" {
		return errors.New("email, verification code, and new password are required")
	}
	if len(code) != 4 {
		return errors.New("please enter a valid 4-digit verification code")
	}
	if len(newPassword) < 6 {
		return errPasswordTooShort
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		return err
	}
	if user == nil {
		return apperr.New("EMAIL_NOT_FOUND", "no account found with this email address")
	}

	// Role enforcement if role provided
	if req.Role != "" && !slices.Contains(user.Roles, req.Role) {
		if req.Role == "recruiter" && slices.Contains(user.Roles, "user") {
			return errors.New("This account is registered as a Candidate. Please use the Candidate portal to reset your password.")
		}
		if req.Role == "user" && slices.Contains(user.Roles, "recruiter") {
			return errors.New("This account is registered as a Recruiter. Please use the Recruiter portal to reset your password.")
		}
		return fmt.Errorf("this account does not have the %s role", req.Role)
	}

	otp, err := s.repo.GetLatestEmailOTP(ctx, email)
	if err != nil {
		return err
	}
	if otp == nil {
		return apperr.New("OTP_EXPIRED", "verification code has expired or is invalid. Please request a new code.")
	}

	if err := s.checkOTPCode(ctx, otp, code); err != nil {
		return err
	}

	if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
		return err
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.repo.UpdatePassword(ctx, user.ID.Hex(), string(hashedBytes)); err != nil {
		return err
	}
	// A reset means the old password may be known to someone else: sign out every device
	return s.RevokeSessions(ctx, user.ID.Hex())
}

func (s *UserServiceImpl) ToggleBookmark(ctx context.Context, userID string, jobID string) ([]string, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user ID")
	}
	if jobID == "" {
		return nil, errors.New("job ID is required")
	}
	return s.repo.ToggleBookmark(ctx, userID, jobID)
}

func (s *UserServiceImpl) GetUserSettings(ctx context.Context, userID string) (*UserSettings, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user ID")
	}
	return s.repo.GetUserSettings(ctx, userID)
}

func (s *UserServiceImpl) UpdateUserSettings(ctx context.Context, userID string, settings UserSettings) (*UserSettings, error) {
	if userID == "" {
		return nil, errors.New("unauthorized: missing user ID")
	}
	return s.repo.UpdateUserSettings(ctx, userID, settings)
}

func (s *UserServiceImpl) GetPlatformStats(ctx context.Context) (map[string]interface{}, error) {
	return s.repo.GetPlatformStats(ctx)
}

func (s *UserServiceImpl) GetLiveActivity(ctx context.Context) ([]map[string]interface{}, error) {
	return s.repo.GetLiveActivity(ctx)
}

func (s *UserServiceImpl) RecordProfileView(ctx context.Context, targetUserID, viewerID string) error {
	if targetUserID == "" {
		return errors.New("target user ID required")
	}

	target, err := s.repo.FindUserByID(ctx, targetUserID)
	if err != nil || target == nil {
		return err
	}

	targetIDHex := target.ID.Hex()

	// Never record or count self-views (or unauthenticated visits)
	if viewerID == "" || viewerID == targetIDHex {
		return nil
	}

	// 24-hour debounce check: if viewer is already in recent viewers, do not increment again
	alreadyViewedRecently := false
	for _, vid := range target.ProfileViewers {
		if vid == viewerID {
			alreadyViewedRecently = true
			break
		}
	}

	if alreadyViewedRecently {
		return nil
	}

	// Atomic increment and prepend unique viewer
	target.ProfileViews++
	target.ProfileViewers = append([]string{viewerID}, target.ProfileViewers...)
	if len(target.ProfileViewers) > 20 {
		target.ProfileViewers = target.ProfileViewers[:20]
	}

	_, err = s.repo.UpdateUser(ctx, target)
	return err
}

func (s *UserServiceImpl) GetProfileViewers(ctx context.Context, userID string) ([]*User, error) {
	if userID == "" {
		return nil, errors.New("user ID required")
	}

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, err
	}

	userIDHex := user.ID.Hex()
	if len(user.ProfileViewers) == 0 {
		return []*User{}, nil
	}

	var viewers []*User
	cleanedViewers := make([]string, 0, len(user.ProfileViewers))
	hasSelfViewer := false

	for _, vid := range user.ProfileViewers {
		// Filter out self-viewer if it was previously recorded
		if vid == userIDHex {
			hasSelfViewer = true
			continue
		}
		cleanedViewers = append(cleanedViewers, vid)
		v, err := s.repo.FindUserByID(ctx, vid)
		if err == nil && v != nil && v.ID.Hex() != userIDHex {
			viewers = append(viewers, v)
		}
	}

	// If self-viewer was detected, clean up the array in the database permanently
	if hasSelfViewer {
		user.ProfileViewers = cleanedViewers
		_, _ = s.repo.UpdateUser(ctx, user)
	}

	return viewers, nil
}

func (s *UserServiceImpl) RecordPostImpressions(ctx context.Context, viewerID string, authorIDs []string) error {
	if len(authorIDs) == 0 {
		return nil
	}

	counts := make(map[string]int)
	for _, id := range authorIDs {
		id = strings.TrimSpace(id)
		if id == "" || id == viewerID {
			continue
		}
		counts[id]++
	}

	if len(counts) == 0 {
		return nil
	}

	go func(c map[string]int) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.repo.IncrementPostImpressions(bgCtx, c)
	}(counts)

	return nil
}

var reservedUsernames = map[string]bool{
	"admin": true, "administrator": true, "api": true, "login": true,
	"register": true, "auth": true, "settings": true, "profile": true,
	"wallet": true, "jobs": true, "mentorship": true, "network": true,
	"events": true, "company": true, "expert": true, "experts": true,
	"community": true, "help": true, "support": true, "root": true,
	"system": true, "kaammilega": true, "instantmilega": true,
	"viewers": true, "impressions": true, "notifications": true,
}

var validUsernameRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$`)

func ValidateUsernameFormat(username string) error {
	username = strings.ToLower(strings.TrimSpace(username))
	if len(username) < 3 || len(username) > 30 {
		return errors.New("username must be between 3 and 30 characters")
	}
	if strings.Contains(username, "--") {
		return errors.New("username cannot contain consecutive hyphens")
	}
	if !validUsernameRegex.MatchString(username) {
		return errors.New("username must only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen")
	}
	if reservedUsernames[username] {
		return errors.New("this username is reserved by the platform")
	}
	return nil
}

func (s *UserServiceImpl) CheckUsernameAvailability(ctx context.Context, currentUserID, username string) (bool, string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if err := ValidateUsernameFormat(username); err != nil {
		return false, err.Error(), nil
	}

	existing, err := s.repo.FindUserByUsername(ctx, username)
	if err != nil {
		return false, "Error verifying username", err
	}

	if existing != nil {
		if currentUserID != "" && existing.ID.Hex() == currentUserID {
			return true, "This is your current URL", nil
		}
		return false, "This URL is already taken. Please try another.", nil
	}

	return true, "Username is available", nil
}

func (s *UserServiceImpl) UpdateUsername(ctx context.Context, userID, newUsername string) (*User, error) {
	if userID == "" {
		return nil, errors.New("unauthorized")
	}

	newUsername = strings.ToLower(strings.TrimSpace(newUsername))
	if err := ValidateUsernameFormat(newUsername); err != nil {
		return nil, err
	}

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	if user.Username == newUsername {
		return user, nil
	}

	// Verify not already taken by someone else
	existing, err := s.repo.FindUserByUsername(ctx, newUsername)
	if err == nil && existing != nil && existing.ID.Hex() != userID {
		return nil, errors.New("this URL is already in use by another member")
	}

	user.Username = newUsername
	updated, err := s.repo.UpdateUser(ctx, user)
	if err != nil {
		return nil, err
	}

	return updated, nil
}

func (s *UserServiceImpl) UpdateOpenToWork(ctx context.Context, userID string, prefs OpenToWorkPreferences) (*User, error) {
	if userID == "" {
		return nil, errors.New("unauthorized")
	}

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	if prefs.Visibility == "" {
		prefs.Visibility = "all"
	}

	user.OpenToWork = &prefs
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) UpdateProvidingServices(ctx context.Context, userID string, prefs ProvidingServicesPreferences) (*User, error) {
	if userID == "" {
		return nil, errors.New("unauthorized")
	}

	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	if prefs.Currency == "" {
		prefs.Currency = "INR"
	}

	user.ProvidingServices = &prefs
	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) ExportUsersCSV(ctx context.Context, role string) ([]byte, error) {
	return s.repo.ExportUsersCSV(ctx, role)
}

func (s *UserServiceImpl) ExportJobsCSV(ctx context.Context, status string) ([]byte, error) {
	return s.repo.ExportJobsCSV(ctx, status)
}

func (s *UserServiceImpl) ExportRevenueCSV(ctx context.Context, status string) ([]byte, error) {
	return s.repo.ExportRevenueCSV(ctx, status)
}

func (s *UserServiceImpl) GlobalSearch(ctx context.Context, query string) (*GlobalSearchResponse, error) {
	return s.repo.GlobalSearch(ctx, query)
}

