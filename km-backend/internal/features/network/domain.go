package network

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ConnectionStatus string

const (
	StatusPending  ConnectionStatus = "pending"
	StatusAccepted ConnectionStatus = "accepted"
	StatusIgnored  ConnectionStatus = "ignored"
)

type ConnectionRequest struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SenderID   primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	ReceiverID primitive.ObjectID `bson:"receiver_id" json:"receiver_id"`
	Status     ConnectionStatus   `bson:"status" json:"status"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}

type ConnectRequest struct {
	ReceiverID string `json:"receiver_id"`
}

type AcceptRequest struct {
	SenderID string `json:"sender_id"`
}

// SuggestedConnection represents a ranked recommendation for the user
type SuggestedConnection struct {
	ID                     primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name                   string             `json:"name"`
	Headline               string             `json:"headline"`
	ProfileImage           string             `json:"profile_image"`
	City                   string             `json:"city"`
	State                  string             `json:"state"`
	Roles                  []string           `json:"roles"`
	Skills                 []string           `json:"skills"`
	JobCategories          []string           `json:"job_categories"`
	MatchScore             int                `json:"match_score"`
	MatchReasons           []string           `json:"match_reasons"`
	PrimaryMatchBadge      string             `json:"primary_match_badge"`
	MutualSkills           []string           `json:"mutual_skills"`
	MutualConnectionsCount int                `json:"mutual_connections_count"`
}

// SuggestionsFilter holds request query parameters
type SuggestionsFilter struct {
	Type  string `json:"type"`  // "all", "city", "skills", "industry", "company" (workplace or college), "mutual"
	Limit int    `json:"limit"` // default 20
	Page  int    `json:"page"`
}

// SuggestionsResponse holds the response payload including profile guidance
type SuggestionsResponse struct {
	Suggestions          []SuggestedConnection `json:"suggestions"`
	Total                int                   `json:"total"`
	HasIncompleteProfile bool                  `json:"has_incomplete_profile"`
	UserCity             string                `json:"user_city"`
	UserSkillsCount      int                   `json:"user_skills_count"`
}

// DismissedSuggestion stores dismissed user recommendations
type DismissedSuggestion struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID `bson:"user_id" json:"user_id"`
	DismissedUserID primitive.ObjectID `bson:"dismissed_user_id" json:"dismissed_user_id"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
}

// CandidateUser is a lightweight projection for scoring candidate peers
type CandidateUser struct {
	ID            primitive.ObjectID `bson:"_id"`
	Name          string             `bson:"name"`
	FirstName     string             `bson:"first_name"`
	LastName      string             `bson:"last_name"`
	Headline      string             `bson:"headline"`
	ProfileImage  string             `bson:"profile_image"`
	City          string             `bson:"city"`
	State         string             `bson:"state"`
	Roles         []string           `bson:"roles"`
	Skills        []string           `bson:"skills"`
	JobCategories []string           `bson:"job_categories"`
	LastActiveAt  time.Time          `bson:"last_active_at"`
	UpdatedAt     time.Time          `bson:"updated_at"`
	CompanyName   string             `bson:"company_name"` // recruiters' own company
	Experience    []experienceEntry  `bson:"experience"`
	Education     []educationEntry   `bson:"education"`
}

type NetworkRepository interface {
	CreateInvitation(ctx context.Context, invitation *ConnectionRequest) error
	UpdateInvitationStatus(ctx context.Context, senderID, receiverID primitive.ObjectID, status ConnectionStatus) error
	GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error)
	GetSentPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnectionStatus(ctx context.Context, userA, userB primitive.ObjectID) (ConnectionStatus, error)
	DeleteInvitation(ctx context.Context, senderID, receiverID primitive.ObjectID) error
	DeleteConnection(ctx context.Context, userA, userB primitive.ObjectID) error

	// Suggestions & Exclusions (F55)
	GetExclusionIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetCandidateUsers(ctx context.Context, exclusionIDs []primitive.ObjectID, limit int) ([]CandidateUser, error)
	// GetCandidateUsersWhere is GetCandidateUsers narrowed by an extra filter
	GetCandidateUsersWhere(ctx context.Context, exclusionIDs []primitive.ObjectID, where bson.M, limit int) ([]CandidateUser, error)
	DismissSuggestion(ctx context.Context, userID, dismissedUserID primitive.ObjectID) error
	// FriendsOfFriends maps each person connected to one of the user's connections (but not to the
	// user) to how many connections they share
	FriendsOfFriends(ctx context.Context, userID primitive.ObjectID, myConnections []primitive.ObjectID) (map[primitive.ObjectID]int, error)

	// Companies to follow
	GetCompanies(ctx context.Context, where bson.M, limit int) ([]CompanyProfile, error)
	FollowCompany(ctx context.Context, userID, companyID primitive.ObjectID) error
	UnfollowCompany(ctx context.Context, userID, companyID primitive.ObjectID) error
	FollowedCompanyIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	OpenJobCounts(ctx context.Context, companyIDs []primitive.ObjectID) (map[primitive.ObjectID]int, error)
	BlockedEitherWay(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	CountFollowers(ctx context.Context, companyID primitive.ObjectID) (int64, error)
}

type NetworkService interface {
	SendInvitation(ctx context.Context, senderID primitive.ObjectID, receiverID string) error
	AcceptInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error
	IgnoreInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error
	GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error)
	GetSentPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error)
	GetConnectionStatus(ctx context.Context, userA, userB string) (string, error)
	DeleteConnection(ctx context.Context, userID primitive.ObjectID, otherID string) error

	// Suggestions Recommendation Engine (F55)
	GetSuggestions(ctx context.Context, userID primitive.ObjectID, filter SuggestionsFilter) (*SuggestionsResponse, error)
	DismissSuggestion(ctx context.Context, userID primitive.ObjectID, targetUserID string) error

	// Companies to follow
	FollowCompany(ctx context.Context, userID primitive.ObjectID, companyID string) error
	UnfollowCompany(ctx context.Context, userID primitive.ObjectID, companyID string) error
	FollowedCompanies(ctx context.Context, userID primitive.ObjectID) ([]string, error)
	CompanySuggestions(ctx context.Context, userID primitive.ObjectID, limit int) ([]SuggestedCompany, error)
	CompanyPeople(ctx context.Context, viewerID primitive.ObjectID, companyID string, limit int) ([]CompanyPerson, error)
}
