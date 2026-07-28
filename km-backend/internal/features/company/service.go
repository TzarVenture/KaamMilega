package company

import (
	"context"
	"errors"
	"km-backend/internal/features/user"
	"time"
)

type CompanyService struct {
	userRepo user.UserRepository
}

func NewCompanyService(userRepo user.UserRepository) *CompanyService {
	return &CompanyService{
		userRepo: userRepo,
	}
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
	// In the new model, creation is likely handled by User Registration.
	// But if we want to "Add Profile" as per UI, maybe we are creating a Recruiter User?

	// Assuming this creates a new Recruiter User
	if req.RecruiterID != "" {
		// If recruiter ID is provided, maybe we are just updating their company info?
		return s.UpdateCompany(ctx, req.RecruiterID, UpdateCompanyRequest{
			Name:      req.Name,
			Logo:      req.Logo,
			Website:   req.Website,
			GST:       req.GST,
			Documents: req.Documents,
			Status:    "pending",
		})
	}

	return nil, errors.New("creating a new company requires creating a user first")
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
	// Deleting a company means deleting the User? Or just removing Recruiter role?
	// Usually delete user?
	// Since "Company IS User", we delete the User? Or maybe soft delete?
	// No delete method exposed in UserRepository for now?
	// Let's assume we don't delete via this API for now or add DeleteUser
	return errors.New("delete company not implemented safely")
}
