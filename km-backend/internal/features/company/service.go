package company

import (
	"context"
	"errors"
	"strings"
	"time"

	"km-backend/internal/features/job"
	"km-backend/internal/features/user"
)

type CompanyService struct {
	userRepo user.UserRepository
	jobRepo  job.JobRepository
}

func NewCompanyService(userRepo user.UserRepository, jobRepo job.JobRepository) *CompanyService {
	return &CompanyService{
		userRepo: userRepo,
		jobRepo:  jobRepo,
	}
}

// openJobCount counts the recruiter's live listings (status "Open", not hidden because the
// account is deactivated)
func (s *CompanyService) openJobCount(ctx context.Context, recruiterID string) int {
	jobs, err := s.jobRepo.FindByRecruiter(ctx, recruiterID)
	if err != nil {
		return 0
	}
	n := 0
	for _, j := range jobs {
		if strings.EqualFold(j.Status, "Open") && !j.HiddenByAccount {
			n++
		}
	}
	return n
}

// Helper to convert User document to Company response document
func FromUserDocument(u *user.Document) Document {
	return Document{
		Name: u.Name,
		URL:  u.URL,
	}
}

func FromUserDocuments(docs []user.Document) []Document {
	var results []Document
	for _, d := range docs {
		results = append(results, FromUserDocument(&d))
	}
	return results
}

func ToUserDocuments(docs []Document) []user.Document {
	var results []user.Document
	for _, d := range docs {
		results = append(results, user.Document{
			Name: d.Name,
			URL:  d.URL,
		})
	}
	return results
}

func (s *CompanyService) CreateCompany(ctx context.Context, req CreateCompanyRequest) (*CompanyResponse, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("company name is required")
	}

	if req.RecruiterID != "" {
		return s.UpdateCompany(ctx, req.RecruiterID, UpdateCompanyRequest{
			Name:      req.Name,
			Logo:      req.Logo,
			Website:   req.Website,
			GST:       req.GST,
			Documents: req.Documents,
			Status:    req.Status,
		})
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		if len(req.Documents) > 0 {
			status = "pending"
		} else {
			status = "no_appeal"
		}
	}

	recruiterName := strings.TrimSpace(req.RecruiterName)
	if recruiterName == "" {
		recruiterName = strings.TrimSpace(req.Name) + " Recruiter"
	}

	u := &user.User{
		Name:               recruiterName,
		Headline:           strings.TrimSpace(req.Designation),
		Email:              strings.ToLower(strings.TrimSpace(req.Email)),
		Mobile:             strings.TrimSpace(req.Mobile),
		Roles:              []string{user.RoleRecruiter},
		IsRegistered:       true,
		CompanyName:        strings.TrimSpace(req.Name),
		CompanyLogo:        strings.TrimSpace(req.Logo),
		CompanyWebsite:     strings.TrimSpace(req.Website),
		Industry:           strings.TrimSpace(req.Industry),
		GST:                strings.TrimSpace(req.GST),
		CompanyDocuments:   ToUserDocuments(req.Documents),
		VerificationStatus: status,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	createdUser, err := s.userRepo.CreateUser(ctx, u)
	if err != nil {
		return nil, err
	}

	return s.GetCompany(ctx, createdUser.ID.Hex())
}

func (s *CompanyService) GetCompany(ctx context.Context, id string) (*CompanyResponse, error) {
	// Find User by ID (Company ID == User ID in this model)
	u, err := s.userRepo.FindUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, nil
	}

	canBypassRole := false // logic to check if user really is recruiter?
	// For now, assuming only recruiters are fetched or we don't care about strict role check here
	// But let's verify role
	isRecruiter := false
	for _, r := range u.Roles {
		if r == user.RoleRecruiter {
			isRecruiter = true
			break
		}
	}
	if !isRecruiter && !canBypassRole {
		// Just return nil or allow it?
		// return nil, errors.New("user is not a company/recruiter")
		// Let's proceed, as admin might view anyone
	}

	recruiterInfo := RecruiterInfo{
		Name:        u.Name,
		Designation: u.Headline,
		LastActive:  u.LastActiveAt.Format("Jan 02, 2006"), // Simple format
	}

	return &CompanyResponse{
		ID:          u.ID.Hex(),
		RecruiterID: u.ID.Hex(), // Same ID
		Name:        u.CompanyName,
		Logo:        u.CompanyLogo,
		Website:     u.CompanyWebsite,
		GST:         u.GST,
		Documents:   FromUserDocuments(u.CompanyDocuments),
		Status:      u.VerificationStatus,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
		Recruiter:   recruiterInfo,
	}, nil
}

func (s *CompanyService) GetCompanies(ctx context.Context, filter CompanyFilter) ([]CompanyResponse, int64, error) {
	// Map CompanyFilter to UserFilter
	userFilter := user.UserFilter{
		Role:               user.RoleRecruiter,
		Search:             filter.Search,
		VerificationStatus: filter.Status,
		Page:               filter.Page,
		Limit:              filter.Limit,
		AdminView:          true, // served only on /api/admin/companies
	}

	users, total, err := s.userRepo.FindUsers(ctx, userFilter)
	if err != nil {
		return nil, 0, err
	}

	var responses []CompanyResponse
	for _, u := range users {
		recruiterInfo := RecruiterInfo{
			Name:        u.Name,
			Designation: u.Headline,
			// Calculate relative time or simple format
			LastActive: "Recently", // u.LastActiveAt
		}
		if !u.LastActiveAt.IsZero() {
			recruiterInfo.LastActive = u.LastActiveAt.Format("Jan 02, 2006")
		}

		// Use User ID as Company ID
		responses = append(responses, CompanyResponse{
			ID:          u.ID.Hex(),
			RecruiterID: u.ID.Hex(),
			Name:        u.CompanyName,
			Logo:        u.CompanyLogo,
			Website:     u.CompanyWebsite,
			GST:         u.GST,
			Documents:   FromUserDocuments(u.CompanyDocuments),
			Status:      u.VerificationStatus,
			CreatedAt:   u.CreatedAt,
			UpdatedAt:   u.UpdatedAt,
			Recruiter:   recruiterInfo,
		})
	}

	return responses, total, nil
}

func (s *CompanyService) UpdateCompany(ctx context.Context, id string, req UpdateCompanyRequest) (*CompanyResponse, error) {
	u, err := s.userRepo.FindUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, errors.New("company (user) not found")
	}

	// Update fields
	if req.Name != "" {
		u.CompanyName = req.Name
	}
	if req.Logo != "" {
		u.CompanyLogo = req.Logo
	}
	if req.Website != "" {
		u.CompanyWebsite = req.Website
	}
	if req.GST != "" {
		u.GST = req.GST
	}
	if req.Documents != nil {
		u.CompanyDocuments = ToUserDocuments(req.Documents)
	}
	if req.Status != "" {
		u.VerificationStatus = req.Status
	}

	u.UpdatedAt = time.Now()

	updated, err := s.userRepo.UpdateUser(ctx, u)
	if err != nil {
		return nil, err
	}

	return s.GetCompany(ctx, updated.ID.Hex())
}

func (s *CompanyService) DeleteCompany(ctx context.Context, id string) error {
	return s.userRepo.DeleteUser(ctx, id)
}

func (s *CompanyService) GetTopCompanies(ctx context.Context, limit int) ([]TopCompanyResponse, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	users, _, err := s.userRepo.FindUsers(ctx, user.UserFilter{
		Role:  user.RoleRecruiter,
		Limit: limit,
	})
	if err != nil {
		return []TopCompanyResponse{}, err
	}

	var top []TopCompanyResponse
	for _, u := range users {
		if u.CompanyName != "" {
			// The company's industry, not the recruiter's personal headline ("HR", "Founder");
			// empty values stay empty instead of placeholder text
			category := strings.TrimSpace(u.Industry)
			location := strings.TrimSpace(u.City)
			top = append(top, TopCompanyResponse{
				ID:       u.ID.Hex(),
				Name:     u.CompanyName,
				Logo:     u.CompanyLogo,
				Website:  u.CompanyWebsite,
				Category: category,
				Location: location,
				JobCount: s.openJobCount(ctx, u.ID.Hex()),
				Verified: u.VerificationStatus == "verified",
			})
		}
	}
	return top, nil
}

