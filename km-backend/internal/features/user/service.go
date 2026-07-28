package user

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"math/rand"
	"net/smtp"
	"slices"
	"time"

	"km-backend/internal/config"
	"km-backend/internal/features/skill"
	"km-backend/internal/features/sms"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserService interface {
	SendOTP(ctx context.Context, mobile string, role string) error
	VerifyOTP(ctx context.Context, mobile, code string, role string) (*VerifyOTPResponse, error)
	Register(ctx context.Context, userID string, req RegisterRequest) (*User, error)
	GetProfile(ctx context.Context, userID string) (*User, error)
	GenerateToken(user *User) (string, error)
	UpdateProfile(ctx context.Context, userID string, updates map[string]interface{}) (*User, error)
	AddEducation(ctx context.Context, userID string, edu Education) (*User, error)
	AddExperience(ctx context.Context, userID string, exp Experience) (*User, error)
	AddSkill(ctx context.Context, userID string, skillName string) (*User, error)
	SendEmailOTP(ctx context.Context, email string) error
	VerifyEmailOTP(ctx context.Context, email, code string) error
	GetAllUsers(ctx context.Context) ([]*User, error)
	GetExperts(ctx context.Context) ([]*User, error)
	SearchUsers(ctx context.Context, query string) ([]*User, error)
	ApplyForExpert(ctx context.Context, userID string, req ApplyExpertRequest) (*User, error)
	ApproveExpert(ctx context.Context, adminID string, targetUserID string, status string) (*User, error)
	GetExpertRequests(ctx context.Context) ([]*User, error)
}

type UserServiceImpl struct {
	repo       UserRepository
	smsService sms.SMSService
	skillRepo  skill.SkillRepository
	config     *config.Config
}

func NewUserService(repo UserRepository, smsService sms.SMSService, skillRepo skill.SkillRepository, cfg *config.Config) UserService {
	return &UserServiceImpl{
		repo:       repo,
		smsService: smsService,
		skillRepo:  skillRepo,
		config:     cfg,
	}
}

func (s *UserServiceImpl) SendOTP(ctx context.Context, mobile string, role string) error {
	// 0. Check for role mismatch if user exists
	user, err := s.repo.FindUserByMobile(ctx, mobile)
	if err == nil && user != nil {
		hasTargetRole := false
		for _, r := range user.Roles {
			if r == role {
				hasTargetRole = true
				break
			}
		}
		if !hasTargetRole {
			if role == RoleRecruiter {
				return errors.New("this mobile number is already registered as a user")
			} else if role == RoleUser {
				return errors.New("this mobile number is already registered as a recruiter")
			}
		}
	}

	// Generate 4-digit OTP
	code := fmt.Sprintf("%04d", rand.Intn(10000))

	// Create OTP record
	otp := &OTP{
		Mobile: mobile,
		Code:   code,
	}

	err = s.repo.SaveOTP(ctx, otp)
	if err != nil {
		return err
	}

	// Send via SMS Service
	_, err = s.smsService.SendSMS(ctx, mobile, "KM_SMS_LOGIN_OTP", []string{code})
	if err != nil {
		// Log error but maybe don't fail if SMS service is flaky?
		// For now, return error.
		return err
	}

	return nil
}

func (s *UserServiceImpl) VerifyOTP(ctx context.Context, mobile, code string, role string) (*VerifyOTPResponse, error) {
	// 1. Get latest OTP
	otp, err := s.repo.GetLatestOTP(ctx, mobile)
	if err != nil {
		return nil, err
	}
	if otp == nil {
		return nil, errors.New("OTP not found or expired")
	}

	// 2. Verify Code
	if otp.Code != code {
		return nil, errors.New("Invalid OTP")
	}

	// 3. Mark OTP used
	if err := s.repo.MarkOTPUsed(ctx, otp.ID); err != nil {
		return nil, err
	}

	// 4. Find or Create User
	user, err := s.repo.FindUserByMobile(ctx, mobile)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if user == nil {
		// Admin cannot be created via OTP login
		if role == RoleAdmin {
			return nil, errors.New("admin account not found")
		}

		// Create new user (unregistered)
		user = &User{
			Mobile:        mobile,
			IsRegistered:  false,
			OTPVerifiedAt: &now,
			Roles:         []string{role}, // Use requested role
		}
		user, err = s.repo.CreateUser(ctx, user)
		if err != nil {
			return nil, err
		}
	} else {
		// Check for role mismatch
		hasTargetRole := slices.Contains(user.Roles, role)
		if !hasTargetRole {
			switch role {
			case RoleAdmin:
				return nil, errors.New("access denied: user does not have admin privileges")
			case RoleRecruiter:
				return nil, errors.New("this mobile number is already registered as a user")
			case RoleUser:
				return nil, errors.New("this mobile number is already registered as a recruiter")
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

	// Update fields
	user.Name = req.Name
	user.Roles = req.Roles
	user.IsRegistered = true
	user.UpdatedAt = time.Now()

	// Profile fields
	user.Gender = req.Gender
	user.EducationLevel = req.EducationLevel
	user.WorkExperience = req.WorkExperience
	user.City = req.City
	user.JobCategories = req.JobCategories
	user.ExperienceDetail = req.ExperienceDetail
	user.Email = req.Email
	user.IsConsultant = req.IsConsultant

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
	return user, nil
}

func (s *UserServiceImpl) GenerateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"sub":    user.ID.Hex(),
		"mobile": user.Mobile,
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

	// Dynamic update (simplified for now, can be improved with reflection or specific checks)
	for key, value := range updates {
		switch key {
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

func (s *UserServiceImpl) AddSkill(ctx context.Context, userID string, skillName string) (*User, error) {
	// 1. Verify skill exists in admin-defined skills
	existingSkill, err := s.skillRepo.GetSkillByName(ctx, skillName)
	if err != nil {
		return nil, err
	}
	if existingSkill == nil {
		return nil, errors.New("skill not found in predefined list")
	}

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

func (s *UserServiceImpl) SendEmailOTP(ctx context.Context, email string) error {
	// Generate 4-digit OTP
	code := fmt.Sprintf("%04d", rand.Intn(10000))

	// Create OTP record
	otp := &OTP{
		Email: email,
		Code:  code,
	}

	err := s.repo.SaveOTP(ctx, otp)
	if err != nil {
		return err
	}

	fmt.Printf("Email OTP generated for %s: %s\n", email, code)

	// Send live email via AWS SES SMTP if credentials are configured
	if s.config.SMTPUsername != "" && s.config.SMTPPassword != "" {
		subject := "KaamMilega Verification Code"
		htmlBody := fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto; background-color: #ffffff;">
				<div style="text-align: center; margin-bottom: 20px;">
					<h2 style="color: #4b1b54; margin: 0; font-size: 24px;">KaamMilega</h2>
					<p style="color: #64748b; font-size: 14px; margin-top: 4px;">Verification Code</p>
				</div>
				<p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello,</p>
				<p style="color: #334155; font-size: 15px; line-height: 1.5;">Use the verification code below to confirm your email address:</p>
				<div style="text-align: center; margin: 28px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
					<span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4b1b54; font-family: monospace;">%s</span>
				</div>
				<p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">This code is valid for 5 minutes. If you did not request this verification code, please ignore this email.</p>
				<hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
				<p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">&copy; KaamMilega. All rights reserved.</p>
			</div>
		`, code)

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
			fmt.Printf("Error sending email via AWS SES: %v\n", err)
			return fmt.Errorf("failed to send email: %w", err)
		}
		fmt.Printf("Successfully sent verification email to %s via AWS SES\n", email)
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

func (s *UserServiceImpl) VerifyEmailOTP(ctx context.Context, email, code string) error {
	otp, err := s.repo.GetLatestEmailOTP(ctx, email)
	if err != nil {
		return err
	}
	if otp == nil {
		return errors.New("OTP not found or expired")
	}

	if otp.Code != code {
		return errors.New("Invalid OTP")
	}

	return s.repo.MarkOTPUsed(ctx, otp.ID)
}

func (s *UserServiceImpl) GetAllUsers(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Role: RoleUser})
	return users, err
}

func (s *UserServiceImpl) GetExperts(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Role: RoleExpert})
	return users, err
}

func (s *UserServiceImpl) SearchUsers(ctx context.Context, query string) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{Search: query, Limit: 20})
	return users, err
}

func (s *UserServiceImpl) ApplyForExpert(ctx context.Context, userID string, req ApplyExpertRequest) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	user.ExpertCategory = req.ExpertCategory
	user.ExpertBio = req.ExpertBio
	user.ExpertPricing = req.ExpertPricing
	user.ExpertDocuments = req.ExpertDocuments
	user.ExpertApprovalStatus = "pending"

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) ApproveExpert(ctx context.Context, adminID string, targetUserID string, status string) (*User, error) {
	user, err := s.repo.FindUserByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	user.ExpertApprovalStatus = status
	if status == "approved" {
		hasExpert := false
		for _, r := range user.Roles {
			if r == RoleExpert {
				hasExpert = true
				break
			}
		}
		if !hasExpert {
			user.Roles = append(user.Roles, RoleExpert)
		}
	}

	return s.repo.UpdateUser(ctx, user)
}

func (s *UserServiceImpl) GetExpertRequests(ctx context.Context) ([]*User, error) {
	users, _, err := s.repo.FindUsers(ctx, UserFilter{ExpertApprovalStatus: "pending"})
	return users, err
}
