package network

import (
	"context"
	"errors"
	"fmt"
	"km-backend/internal/common/apperr"
	"sort"
	"strings"
	"time"
	"unicode"

	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type NetworkServiceImpl struct {
	repo         NetworkRepository
	notifService notification.NotificationService
	userRepo     user.UserRepository
}

func NewNetworkService(
	repo NetworkRepository,
	notifService notification.NotificationService,
	userRepo user.UserRepository,
) NetworkService {
	return &NetworkServiceImpl{
		repo:         repo,
		notifService: notifService,
		userRepo:     userRepo,
	}
}

// ErrInvitationExists: a request between the two is already pending, or they are connected
var ErrInvitationExists = apperr.New("INVITATION_EXISTS", "invitation already exists or already connected")

func (s *NetworkServiceImpl) SendInvitation(ctx context.Context, senderID primitive.ObjectID, receiverID string) error {
	rOID, err := primitive.ObjectIDFromHex(receiverID)
	if err != nil {
		return err
	}

	if senderID == rOID {
		return errors.New("cannot connect to yourself")
	}

	status, err := s.repo.GetConnectionStatus(ctx, senderID, rOID)
	if err != nil {
		return err
	}
	if status == StatusPending || status == StatusAccepted {
		return ErrInvitationExists
	}
	if status == StatusIgnored {
		_ = s.repo.DeleteInvitation(ctx, senderID, rOID)
	}

	invitation := &ConnectionRequest{
		SenderID:   senderID,
		ReceiverID: rOID,
		Status:     StatusPending,
	}

	if err := s.repo.CreateInvitation(ctx, invitation); err != nil {
		return err
	}

	// Real-time in-app notification to receiver
	if s.notifService != nil {
		go func() {
			senderName := "Someone"
			senderAvatar := ""
			if s.userRepo != nil {
				if sender, err := s.userRepo.FindUserByID(context.Background(), senderID.Hex()); err == nil && sender != nil {
					if sender.Name != "" {
						senderName = sender.Name
					} else if sender.FirstName != "" {
						senderName = sender.FirstName + " " + sender.LastName
					}
					senderAvatar = sender.ProfileImage
				}
			}

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      rOID,
				ActorID:     &senderID,
				ActorName:   senderName,
				ActorAvatar: senderAvatar,
				Type:        notification.TypeConnectionRequest,
				Category:    notification.CategoryNetwork,
				Title:       "New Connection Request",
				Message:     fmt.Sprintf("%s sent you a connection request", senderName),
				Link:        "/network",
				Metadata: map[string]interface{}{
					"sender_id": senderID.Hex(),
				},
			})
		}()
	}

	return nil
}

func (s *NetworkServiceImpl) AcceptInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	if err := s.repo.UpdateInvitationStatus(ctx, sOID, receiverID, StatusAccepted); err != nil {
		return err
	}

	// Real-time in-app notification to sender
	if s.notifService != nil {
		go func() {
			receiverName := "Someone"
			receiverAvatar := ""
			if s.userRepo != nil {
				if receiver, err := s.userRepo.FindUserByID(context.Background(), receiverID.Hex()); err == nil && receiver != nil {
					if receiver.Name != "" {
						receiverName = receiver.Name
					} else if receiver.FirstName != "" {
						receiverName = receiver.FirstName + " " + receiver.LastName
					}
					receiverAvatar = receiver.ProfileImage
				}
			}

			_, _ = s.notifService.CreateNotification(context.Background(), notification.CreateNotificationRequest{
				UserID:      sOID,
				ActorID:     &receiverID,
				ActorName:   receiverName,
				ActorAvatar: receiverAvatar,
				Type:        notification.TypeConnectionAccepted,
				Category:    notification.CategoryNetwork,
				Title:       "Connection Accepted",
				Message:     fmt.Sprintf("%s accepted your connection request", receiverName),
				Link:        fmt.Sprintf("/profile/%s", receiverID.Hex()),
				Metadata: map[string]interface{}{
					"accepted_by": receiverID.Hex(),
				},
			})
		}()
	}

	return nil
}

func (s *NetworkServiceImpl) IgnoreInvitation(ctx context.Context, receiverID primitive.ObjectID, senderID string) error {
	sOID, err := primitive.ObjectIDFromHex(senderID)
	if err != nil {
		return err
	}

	// Deleting the invitation resets the status so the sender is no longer pending and can connect again later
	return s.repo.DeleteInvitation(ctx, sOID, receiverID)
}

func (s *NetworkServiceImpl) GetPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]ConnectionRequest, error) {
	return s.repo.GetPendingInvitations(ctx, userID)
}

func (s *NetworkServiceImpl) GetSentPendingInvitations(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return s.repo.GetSentPendingInvitations(ctx, userID)
}

func (s *NetworkServiceImpl) GetConnections(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	return s.repo.GetConnections(ctx, userID)
}

func (s *NetworkServiceImpl) GetConnectionStatus(ctx context.Context, userA, userB string) (string, error) {
	uaOID, err := primitive.ObjectIDFromHex(userA)
	if err != nil {
		return "", err
	}
	ubOID, err := primitive.ObjectIDFromHex(userB)
	if err != nil {
		return "", err
	}

	status, err := s.repo.GetConnectionStatus(ctx, uaOID, ubOID)
	if err != nil {
		return "", err
	}
	return string(status), nil
}

func (s *NetworkServiceImpl) DeleteConnection(ctx context.Context, userID primitive.ObjectID, otherID string) error {
	otherOID, err := primitive.ObjectIDFromHex(otherID)
	if err != nil {
		return err
	}
	return s.repo.DeleteConnection(ctx, userID, otherOID)
}

// GetSuggestions executes the F55 recommendation engine
func (s *NetworkServiceImpl) GetSuggestions(ctx context.Context, userID primitive.ObjectID, filter SuggestionsFilter) (*SuggestionsResponse, error) {
	currentUser, err := s.userRepo.FindUserByID(ctx, userID.Hex())
	if err != nil || currentUser == nil {
		return nil, errors.New("user not found")
	}

	hasIncompleteProfile := len(currentUser.Skills) == 0 &&
		len(currentUser.JobCategories) == 0 &&
		strings.TrimSpace(currentUser.Headline) == ""

	exclusions, err := s.repo.GetExclusionIDs(ctx, userID)
	if err != nil {
		exclusions = []primitive.ObjectID{userID}
	}

	myConnections, _ := s.repo.GetConnections(ctx, userID)

	myExperience := make([]experienceEntry, 0, len(currentUser.Experience))
	for _, e := range currentUser.Experience {
		myExperience = append(myExperience, experienceEntry{CompanyName: e.CompanyName, EndDate: e.EndDate})
	}
	myEducation := make([]educationEntry, 0, len(currentUser.Education))
	for _, e := range currentUser.Education {
		myEducation = append(myEducation, educationEntry{SchoolName: e.SchoolName})
	}
	myOrgs := orgsOf(currentUser.CompanyName, myExperience, myEducation)

	// People you may know: friends of friends, counted in one query
	mutuals, err := s.repo.FriendsOfFriends(ctx, userID, myConnections)
	if err != nil {
		mutuals = map[primitive.ObjectID]int{}
	}

	candidates, err := s.gatherCandidates(ctx, exclusions, mutuals, myOrgs)
	if err != nil {
		return nil, err
	}

	userSkillsMap := make(map[string]string)
	for _, sk := range currentUser.Skills {
		norm := strings.ToLower(strings.TrimSpace(sk))
		if norm != "" {
			userSkillsMap[norm] = sk
		}
	}

	userCategoriesMap := make(map[string]string)
	for _, cat := range currentUser.JobCategories {
		norm := strings.ToLower(strings.TrimSpace(cat))
		if norm != "" {
			userCategoriesMap[norm] = cat
		}
	}

	userCity := strings.TrimSpace(currentUser.City)
	userState := strings.TrimSpace(currentUser.State)
	userHeadlineKeywords := extractKeyWords(currentUser.Headline)

	var scoredList []SuggestedConnection

	for _, cand := range candidates {
		// 1. Calculate mutual skills
		var mutualSkills []string
		for _, csk := range cand.Skills {
			norm := strings.ToLower(strings.TrimSpace(csk))
			if orig, ok := userSkillsMap[norm]; ok {
				mutualSkills = append(mutualSkills, orig)
			}
		}

		// 2. Calculate mutual job categories
		var mutualCategories []string
		for _, ccat := range cand.JobCategories {
			norm := strings.ToLower(strings.TrimSpace(ccat))
			if orig, ok := userCategoriesMap[norm]; ok {
				mutualCategories = append(mutualCategories, orig)
			}
		}

		// 3. Calculate headline keyword overlap
		candKeywords := extractKeyWords(cand.Headline)
		hasHeadlineOverlap := false
		for kw := range candKeywords {
			if userHeadlineKeywords[kw] {
				hasHeadlineOverlap = true
				break
			}
		}

		// 4. Geographic alignment
		candCity := strings.TrimSpace(cand.City)
		isSameCity := userCity != "" && candCity != "" && strings.EqualFold(candCity, userCity)
		isSameState := userState != "" && cand.State != "" && strings.EqualFold(cand.State, userState)

		// 5. Mutual connections count, and a workplace or college in common
		mutualCount := mutuals[cand.ID]
		shared := sharedOrgs(myOrgs, orgsOf(cand.CompanyName, cand.Experience, cand.Education))

		// 6. Recruiter / Expert synergy
		isRecruiterMatch := false
		for _, role := range cand.Roles {
			if role == "recruiter" || role == "expert" {
				if len(mutualCategories) > 0 || len(mutualSkills) > 0 || hasHeadlineOverlap {
					isRecruiterMatch = true
				}
			}
		}

		// 7. CRITICAL: The Professional Affinity Gate
		// (Software engineer will NEVER see a plumber even if in the same city!)
		if !hasIncompleteProfile {
			hasAffinity := len(mutualSkills) > 0 ||
				len(mutualCategories) > 0 ||
				hasHeadlineOverlap ||
				mutualCount > 0 ||
				shared.company != "" ||
				shared.school != "" ||
				isRecruiterMatch

			if !hasAffinity {
				continue
			}
		}

		// 8. Filter compliance if user selected a tab
		if filter.Type == "city" && !isSameCity {
			continue
		}
		if filter.Type == "skills" && len(mutualSkills) == 0 {
			continue
		}
		if filter.Type == "industry" && len(mutualCategories) == 0 && !hasHeadlineOverlap {
			continue
		}
		if filter.Type == "company" && shared.company == "" && shared.school == "" {
			continue
		}
		if filter.Type == "mutual" && mutualCount == 0 {
			continue
		}

		// 9. Multi-factor Scoring
		score := 0

		// Skill overlap depth (Highest weight)
		if len(mutualSkills) >= 3 {
			score += 50
		} else if len(mutualSkills) == 2 {
			score += 35
		} else if len(mutualSkills) == 1 {
			score += 20
		}

		// Industry / Job Category match
		if len(mutualCategories) > 0 {
			score += 25
		}

		// Headline keyword match
		if hasHeadlineOverlap {
			score += 15
		}

		// Local synergy bonus (Only for qualified peers in same field)
		if isSameCity {
			score += 20
		} else if isSameState {
			score += 10
		}

		// Mutual connections: the main "people you may know" signal
		if mutualCount > 0 {
			score += min(mutualCount*10, 40)
		}

		// Same workplace or college
		switch {
		case shared.colleagues:
			score += 40
		case shared.company != "":
			score += 25
		}
		if shared.school != "" {
			score += 20
		}

		// Recruiter / Expert mentorship bonus
		if isRecruiterMatch {
			score += 15
		}

		// Recency bonus
		if !cand.LastActiveAt.IsZero() && time.Since(cand.LastActiveAt) < 14*24*time.Hour {
			score += 5
		}

		// 10. Match Reason Badge Formulation
		var badge string
		var reasons []string
		if shared.colleagues {
			reasons = append(reasons, fmt.Sprintf("Also works at %s", shared.company))
		} else if shared.company != "" {
			reasons = append(reasons, fmt.Sprintf("Also worked at %s", shared.company))
		}
		if shared.school != "" {
			reasons = append(reasons, fmt.Sprintf("Also studied at %s", shared.school))
		}
		if mutualCount > 0 {
			reasons = append(reasons, mutualReason(mutualCount))
		}

		if shared.company != "" {
			badge = reasons[0]
		} else if mutualCount >= 2 {
			badge = mutualReason(mutualCount)
		} else if shared.school != "" {
			badge = fmt.Sprintf("Also studied at %s", shared.school)
		} else if len(mutualSkills) >= 2 {
			maxShow := 2
			if len(mutualSkills) < maxShow {
				maxShow = len(mutualSkills)
			}
			badge = fmt.Sprintf("Shares %d skills: %s", len(mutualSkills), strings.Join(mutualSkills[:maxShow], ", "))
			reasons = append(reasons, fmt.Sprintf("%d skills in common (%s)", len(mutualSkills), strings.Join(mutualSkills, ", ")))
		} else if len(mutualSkills) == 1 && isSameCity {
			badge = fmt.Sprintf("Shares %s • %s", mutualSkills[0], candCity)
			reasons = append(reasons, fmt.Sprintf("Both skilled in %s", mutualSkills[0]))
			reasons = append(reasons, fmt.Sprintf("Based in your city (%s)", candCity))
		} else if len(mutualSkills) == 1 {
			badge = fmt.Sprintf("Shares %s skill", mutualSkills[0])
			reasons = append(reasons, fmt.Sprintf("Both skilled in %s", mutualSkills[0]))
		} else if isSameCity && len(mutualCategories) > 0 {
			badge = fmt.Sprintf("%s in %s", mutualCategories[0], candCity)
			reasons = append(reasons, fmt.Sprintf("Same field: %s", mutualCategories[0]))
			reasons = append(reasons, fmt.Sprintf("Based in %s", candCity))
		} else if len(mutualCategories) > 0 {
			badge = fmt.Sprintf("Also in %s", mutualCategories[0])
			reasons = append(reasons, fmt.Sprintf("Same industry: %s", mutualCategories[0]))
		} else if isRecruiterMatch {
			badge = "Recruiter in your field"
			reasons = append(reasons, "Active recruiter in your industry")
		} else if mutualCount > 0 {
			badge = mutualReason(mutualCount)
		} else if isSameCity {
			badge = fmt.Sprintf("Based in %s", candCity)
			reasons = append(reasons, fmt.Sprintf("In your city (%s)", candCity))
		} else {
			badge = "Suggested connection"
			reasons = append(reasons, "Verified professional member")
		}

		// 11. Clean display name
		displayName := cand.Name
		if displayName == "" {
			if cand.FirstName != "" {
				displayName = strings.TrimSpace(cand.FirstName + " " + cand.LastName)
			} else {
				displayName = "Verified Member"
			}
		}

		cleanHeadline := cand.Headline
		if cleanHeadline == "" && len(cand.JobCategories) > 0 {
			cleanHeadline = cand.JobCategories[0] + " Specialist"
		}

		scoredList = append(scoredList, SuggestedConnection{
			ID:                     cand.ID,
			Name:                   displayName,
			Headline:               cleanHeadline,
			ProfileImage:           cand.ProfileImage,
			City:                   cand.City,
			State:                  cand.State,
			Roles:                  cand.Roles,
			Skills:                 cand.Skills,
			JobCategories:          cand.JobCategories,
			MatchScore:             score,
			MatchReasons:           reasons,
			PrimaryMatchBadge:      badge,
			MutualSkills:           mutualSkills,
			MutualConnectionsCount: mutualCount,
		})
	}

	// 12. Sort by MatchScore DESC
	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].MatchScore > scoredList[j].MatchScore
	})

	// 13. Pagination / Limit
	limit := filter.Limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	page := filter.Page
	if page < 1 {
		page = 1
	}

	start := (page - 1) * limit
	if start > len(scoredList) {
		start = len(scoredList)
	}
	end := start + limit
	if end > len(scoredList) {
		end = len(scoredList)
	}

	paginated := scoredList[start:end]

	return &SuggestionsResponse{
		Suggestions:          paginated,
		Total:                len(scoredList),
		HasIncompleteProfile: hasIncompleteProfile,
		UserCity:             userCity,
		UserSkillsCount:      len(currentUser.Skills),
	}, nil
}

func mutualReason(n int) string {
	if n == 1 {
		return "1 mutual connection"
	}
	return fmt.Sprintf("%d mutual connections", n)
}

// Pools that feed one suggestions request
const (
	recentPool  = 150 // most recently updated profiles
	mutualPool  = 100 // friends of friends with the most shared connections
	orgPool     = 100 // people from the same workplaces and colleges
	maxOrgNames = 20  // workplaces and colleges searched per request
)

// gatherCandidates collects everyone worth scoring: recently active profiles, friends of friends
// and people from the user's workplaces and colleges, each listed once.
func (s *NetworkServiceImpl) gatherCandidates(ctx context.Context, exclusions []primitive.ObjectID, mutuals map[primitive.ObjectID]int, mine orgs) ([]CandidateUser, error) {
	recent, err := s.repo.GetCandidateUsers(ctx, exclusions, recentPool)
	if err != nil {
		return nil, err
	}
	out := recent
	seen := make(map[primitive.ObjectID]bool, len(recent))
	for _, c := range recent {
		seen[c.ID] = true
	}
	merge := func(more []CandidateUser) {
		for _, c := range more {
			if !seen[c.ID] {
				seen[c.ID] = true
				out = append(out, c)
			}
		}
	}

	if len(mutuals) > 0 {
		ids := make([]primitive.ObjectID, 0, len(mutuals))
		for id := range mutuals {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool {
			if mutuals[ids[i]] != mutuals[ids[j]] {
				return mutuals[ids[i]] > mutuals[ids[j]]
			}
			return ids[i].Hex() < ids[j].Hex()
		})
		if len(ids) > mutualPool {
			ids = ids[:mutualPool]
		}
		// The pool filter still applies, so blocked, hidden and dismissed people stay out
		more, err := s.repo.GetCandidateUsersWhere(ctx, exclusions, bson.M{"_id": bson.M{"$in": ids}}, mutualPool)
		if err != nil {
			return nil, err
		}
		merge(more)
	}

	var companies, schools []primitive.Regex
	for _, key := range sortedKeys(mine.companies) {
		if len(companies) < maxOrgNames {
			companies = append(companies, primitive.Regex{Pattern: orgPattern(key), Options: "i"})
		}
	}
	for _, key := range sortedKeys(mine.schools) {
		if len(schools) < maxOrgNames {
			schools = append(schools, primitive.Regex{Pattern: orgPattern(key), Options: "i"})
		}
	}
	var either []bson.M
	if len(companies) > 0 {
		either = append(either,
			bson.M{"experience.company_name": bson.M{"$in": companies}},
			bson.M{"company_name": bson.M{"$in": companies}})
	}
	if len(schools) > 0 {
		either = append(either, bson.M{"education.school_name": bson.M{"$in": schools}})
	}
	if len(either) > 0 {
		more, err := s.repo.GetCandidateUsersWhere(ctx, exclusions, bson.M{"$or": either}, orgPool)
		if err != nil {
			return nil, err
		}
		merge(more)
	}
	return out, nil
}

func (s *NetworkServiceImpl) DismissSuggestion(ctx context.Context, userID primitive.ObjectID, targetUserID string) error {
	tOID, err := primitive.ObjectIDFromHex(targetUserID)
	if err != nil {
		return err
	}
	return s.repo.DismissSuggestion(ctx, userID, tOID)
}

var commonStopwords = map[string]bool{
	"and": true, "the": true, "for": true, "with": true, "from": true, "at": true,
	"to": true, "in": true, "of": true, "a": true, "an": true, "is": true,
	"senior": true, "junior": true, "lead": true, "staff": true, "associate": true,
	"intern": true, "experienced": true, "expert": true, "specialist": true,
}

func extractKeyWords(text string) map[string]bool {
	tokens := make(map[string]bool)
	if strings.TrimSpace(text) == "" {
		return tokens
	}

	f := func(c rune) bool {
		return !unicode.IsLetter(c) && !unicode.IsNumber(c)
	}
	words := strings.FieldsFunc(strings.ToLower(text), f)
	for _, w := range words {
		if len(w) >= 3 && !commonStopwords[w] {
			tokens[w] = true
		}
	}
	return tokens
}
