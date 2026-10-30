package feed

import (
	"context"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/features/user"
	"km-backend/internal/storage"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	ErrFeedContentEmpty      = apperr.New("FEED_CONTENT_EMPTY", "Please write something before posting.")
	ErrFeedPostNotFound      = apperr.New("FEED_POST_NOT_FOUND", "This post doesn't exist or was removed.")
	ErrFeedUnauthorized      = apperr.New("FEED_UNAUTHORIZED", "You are not allowed to perform this action.")
	ErrFeedInvalidMedia      = apperr.New("FEED_INVALID_MEDIA", "The uploaded media link is invalid.")
	ErrFeedInvalidReaction   = apperr.New("FEED_INVALID_REACTION", "Please select a valid reaction.")
	ErrFeedCommentEmpty      = apperr.New("FEED_COMMENT_EMPTY", "Comment cannot be empty.")
	ErrFeedReportReasonEmpty = apperr.New("FEED_REPORT_REASON_EMPTY", "Please provide a reason for reporting.")
)

type FeedService interface {
	CreatePost(ctx context.Context, userID primitive.ObjectID, req CreatePostRequest) (*FeedPostResponse, error)
	GetFeed(ctx context.Context, currentUserID *primitive.ObjectID, category string, before time.Time, limit int, authorID *primitive.ObjectID, savedOnly bool) (*FeedListResponse, error)
	GetPost(ctx context.Context, currentUserID *primitive.ObjectID, postID primitive.ObjectID) (*FeedPostResponse, error)
	DeletePost(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID primitive.ObjectID) error
	ReactToPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, reaction string) (*FeedPostResponse, error)
	ToggleSavePost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID) (bool, error)
	ToggleRepostPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID) (bool, int, error)
	AddComment(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, req CommentRequest) (*FeedCommentResponse, error)
	GetComments(ctx context.Context, currentUserID *primitive.ObjectID, postID primitive.ObjectID, limit int) ([]FeedCommentResponse, error)
	DeleteComment(ctx context.Context, userID primitive.ObjectID, isAdmin bool, commentID primitive.ObjectID) error
	ReportPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, req ReportPostRequest) error
}

type feedService struct {
	repo    FeedRepository
	userRepo user.UserRepository
	store   storage.Storage
	cfg     *config.Config
}

func NewFeedService(repo FeedRepository, userRepo user.UserRepository, store storage.Storage, cfg *config.Config) FeedService {
	return &feedService{
		repo:     repo,
		userRepo: userRepo,
		store:    store,
		cfg:      cfg,
	}
}

func (s *feedService) CreatePost(ctx context.Context, userID primitive.ObjectID, req CreatePostRequest) (*FeedPostResponse, error) {
	content := strings.TrimSpace(req.Content)
	mediaURL := strings.TrimSpace(req.MediaURL)

	if content == "" && mediaURL == "" {
		return nil, ErrFeedContentEmpty
	}

	mediaType := ""
	if mediaURL != "" {
		// Verify media_url contains feed_image
		if !strings.Contains(mediaURL, "feed_image/") {
			return nil, ErrFeedInvalidMedia
		}
		mediaType = "image"
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" || category == CategoryAll {
		category = CategoryJobs
	}

	// Clean tags: ensure hashtag prefix and lowercase
	cleanTags := make([]string, 0, len(req.Tags))
	for _, t := range req.Tags {
		t = strings.TrimSpace(t)
		if t != "" {
			if !strings.HasPrefix(t, "#") {
				t = "#" + t
			}
			cleanTags = append(cleanTags, t)
		}
	}

	post := &Post{
		AuthorID:   userID,
		Content:    content,
		Category:   category,
		Tags:       cleanTags,
		MediaURL:   mediaURL,
		MediaType:  mediaType,
		Reactions:  make(map[string]string),
		SavedBy:    make([]string, 0),
		RepostedBy: make([]string, 0),
	}

	created, err := s.repo.CreatePost(ctx, post)
	if err != nil {
		return nil, err
	}

	return s.buildPostResponse(ctx, created, &userID, nil)
}

func (s *feedService) GetFeed(ctx context.Context, currentUserID *primitive.ObjectID, category string, before time.Time, limit int, authorID *primitive.ObjectID, savedOnly bool) (*FeedListResponse, error) {
	savedByStr := ""
	if savedOnly && currentUserID != nil {
		savedByStr = currentUserID.Hex()
	}

	posts, err := s.repo.FindPosts(ctx, category, before, limit+1, authorID, savedByStr)
	if err != nil {
		return nil, err
	}

	hasMore := len(posts) > limit
	if hasMore {
		posts = posts[:limit]
	}

	// Collect author IDs for batch resolution
	authorIDMap := make(map[primitive.ObjectID]bool)
	authorCounts := make(map[string]int)

	for _, p := range posts {
		authorIDMap[p.AuthorID] = true
		authorCounts[p.AuthorID.Hex()]++
	}

	var authorIDs []primitive.ObjectID
	for id := range authorIDMap {
		authorIDs = append(authorIDs, id)
	}

	usersMap, _ := s.userRepo.FindUsersByIDs(ctx, authorIDs)

	// Record impressions in background
	if len(authorCounts) > 0 {
		go func() {
			_ = s.userRepo.IncrementPostImpressions(context.Background(), authorCounts)
		}()
	}

	responses := make([]FeedPostResponse, 0, len(posts))
	var nextCursor string
	for _, p := range posts {
		resp, _ := s.buildPostResponse(ctx, &p, currentUserID, usersMap)
		if resp != nil {
			responses = append(responses, *resp)
		}
	}

	if len(posts) > 0 {
		nextCursor = posts[len(posts)-1].CreatedAt.UTC().Format(time.RFC3339Nano)
	}

	return &FeedListResponse{
		Posts:      responses,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

func (s *feedService) GetPost(ctx context.Context, currentUserID *primitive.ObjectID, postID primitive.ObjectID) (*FeedPostResponse, error) {
	post, err := s.repo.FindPostByID(ctx, postID)
	if err != nil || post == nil {
		return nil, ErrFeedPostNotFound
	}

	return s.buildPostResponse(ctx, post, currentUserID, nil)
}

func (s *feedService) DeletePost(ctx context.Context, userID primitive.ObjectID, isAdmin bool, postID primitive.ObjectID) error {
	post, err := s.repo.FindPostByID(ctx, postID)
	if err != nil || post == nil {
		return ErrFeedPostNotFound
	}

	if !isAdmin && post.AuthorID != userID {
		return ErrFeedUnauthorized
	}

	// Delete from MongoDB
	if err := s.repo.DeletePost(ctx, postID); err != nil {
		return err
	}

	// Delete associated media from R2/Storage if present
	if post.MediaURL != "" && s.store != nil {
		key := extractStorageKey(post.MediaURL)
		if key != "" {
			go func() {
				_ = s.store.Delete(context.Background(), storage.Public, key)
			}()
		}
	}

	return nil
}

func (s *feedService) ReactToPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, reaction string) (*FeedPostResponse, error) {
	reaction = strings.ToLower(strings.TrimSpace(reaction))
	switch reaction {
	case ReactionLike, ReactionCelebrate, ReactionSupport, ReactionLove, ReactionInsightful:
	default:
		return nil, ErrFeedInvalidReaction
	}

	updated, err := s.repo.SetReaction(ctx, postID, userID.Hex(), reaction)
	if err != nil || updated == nil {
		return nil, ErrFeedPostNotFound
	}

	return s.buildPostResponse(ctx, updated, &userID, nil)
}

func (s *feedService) ToggleSavePost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID) (bool, error) {
	return s.repo.ToggleSave(ctx, postID, userID.Hex())
}

func (s *feedService) ToggleRepostPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID) (bool, int, error) {
	return s.repo.ToggleRepost(ctx, postID, userID.Hex())
}

func (s *feedService) AddComment(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, req CommentRequest) (*FeedCommentResponse, error) {
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return nil, ErrFeedCommentEmpty
	}

	post, err := s.repo.FindPostByID(ctx, postID)
	if err != nil || post == nil {
		return nil, ErrFeedPostNotFound
	}

	comment := &Comment{
		PostID:   postID,
		AuthorID: userID,
		Content:  content,
		LikedBy:  make([]string, 0),
	}

	created, err := s.repo.CreateComment(ctx, comment)
	if err != nil {
		return nil, err
	}

	// Resolve author info
	usersMap, _ := s.userRepo.FindUsersByIDs(ctx, []primitive.ObjectID{userID})
	authorResp := formatAuthor(userID, usersMap)

	return &FeedCommentResponse{
		ID:         created.ID.Hex(),
		PostID:     created.PostID.Hex(),
		Author:     authorResp,
		CreatedAt:  created.CreatedAt.UTC().Format(time.RFC3339),
		Content:    created.Content,
		LikesCount: created.LikesCount,
		IsLiked:    false,
	}, nil
}

func (s *feedService) GetComments(ctx context.Context, currentUserID *primitive.ObjectID, postID primitive.ObjectID, limit int) ([]FeedCommentResponse, error) {
	comments, err := s.repo.FindCommentsByPostID(ctx, postID, limit)
	if err != nil {
		return nil, err
	}

	authorIDMap := make(map[primitive.ObjectID]bool)
	for _, c := range comments {
		authorIDMap[c.AuthorID] = true
	}
	var authorIDs []primitive.ObjectID
	for id := range authorIDMap {
		authorIDs = append(authorIDs, id)
	}

	usersMap, _ := s.userRepo.FindUsersByIDs(ctx, authorIDs)

	resps := make([]FeedCommentResponse, 0, len(comments))
	for _, c := range comments {
		isLiked := false
		if currentUserID != nil {
			uidStr := currentUserID.Hex()
			for _, l := range c.LikedBy {
				if l == uidStr {
					isLiked = true
					break
				}
			}
		}

		resps = append(resps, FeedCommentResponse{
			ID:         c.ID.Hex(),
			PostID:     c.PostID.Hex(),
			Author:     formatAuthor(c.AuthorID, usersMap),
			CreatedAt:  c.CreatedAt.UTC().Format(time.RFC3339),
			Content:    c.Content,
			LikesCount: c.LikesCount,
			IsLiked:    isLiked,
		})
	}

	return resps, nil
}

func (s *feedService) DeleteComment(ctx context.Context, userID primitive.ObjectID, isAdmin bool, commentID primitive.ObjectID) error {
	comment, err := s.repo.FindCommentByID(ctx, commentID)
	if err != nil || comment == nil {
		return ErrFeedPostNotFound
	}

	post, _ := s.repo.FindPostByID(ctx, comment.PostID)

	// Can delete if: comment author, post author, or platform admin
	canDelete := isAdmin || comment.AuthorID == userID || (post != nil && post.AuthorID == userID)
	if !canDelete {
		return ErrFeedUnauthorized
	}

	return s.repo.DeleteComment(ctx, commentID, comment.PostID)
}

func (s *feedService) ReportPost(ctx context.Context, userID primitive.ObjectID, postID primitive.ObjectID, req ReportPostRequest) error {
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return ErrFeedReportReasonEmpty
	}

	report := &PostReport{
		PostID:     postID,
		ReporterID: userID,
		Reason:     reason,
	}

	return s.repo.CreateReport(ctx, report)
}

// Helper methods

func (s *feedService) buildPostResponse(ctx context.Context, p *Post, currentUserID *primitive.ObjectID, usersMap map[primitive.ObjectID]*user.User) (*FeedPostResponse, error) {
	if usersMap == nil {
		usersMap, _ = s.userRepo.FindUsersByIDs(ctx, []primitive.ObjectID{p.AuthorID})
	}

	author := formatAuthor(p.AuthorID, usersMap)

	isLiked := false
	userReaction := ""
	isSaved := false
	isReposted := false

	if currentUserID != nil {
		uidStr := currentUserID.Hex()
		if r, ok := p.Reactions[uidStr]; ok && r != "" {
			isLiked = true
			userReaction = r
		}
		for _, sId := range p.SavedBy {
			if sId == uidStr {
				isSaved = true
				break
			}
		}
		for _, rId := range p.RepostedBy {
			if rId == uidStr {
				isReposted = true
				break
			}
		}
	}

	return &FeedPostResponse{
		ID:            p.ID.Hex(),
		Author:        author,
		CreatedAt:     p.CreatedAt.UTC().Format(time.RFC3339),
		TimestampMs:   p.CreatedAt.UnixMilli(),
		Content:       p.Content,
		Tags:          p.Tags,
		Category:      p.Category,
		MediaURL:      p.MediaURL,
		MediaType:     p.MediaType,
		LikesCount:    p.LikesCount,
		RepostsCount:  p.RepostsCount,
		CommentsCount: p.CommentsCount,
		IsLiked:       isLiked,
		UserReaction:  userReaction,
		IsReposted:    isReposted,
		IsSaved:       isSaved,
	}, nil
}

func formatAuthor(authorID primitive.ObjectID, usersMap map[primitive.ObjectID]*user.User) FeedAuthorResponse {
	resp := FeedAuthorResponse{
		ID:         authorID.Hex(),
		Name:       "Member",
		Headline:   "Member on KaamMilega™",
		IsVerified: false,
		Role:       "user",
		Badge:      "Member",
	}

	if usersMap == nil {
		return resp
	}

	u, ok := usersMap[authorID]
	if !ok || u == nil {
		return resp
	}

	name := strings.TrimSpace(u.Name)
	if name == "" {
		name = strings.TrimSpace(u.FirstName + " " + u.LastName)
	}
	if name != "" {
		resp.Name = name
	}

	if u.Headline != "" {
		resp.Headline = u.Headline
	} else if u.CompanyName != "" {
		resp.Headline = u.CompanyName
	}

	resp.Avatar = u.ProfileImage

	// Check recruiter role
	isRecruiter := false
	for _, r := range u.Roles {
		if r == user.RoleRecruiter {
			isRecruiter = true
			break
		}
	}
	if isRecruiter {
		resp.Role = "recruiter"
		resp.Badge = "Recruiter"
	}

	resp.IsVerified = u.IsEmailVerified || u.VerificationStatus == "verified"

	return resp
}

func extractStorageKey(mediaURL string) string {
	idx := strings.Index(mediaURL, "feed_image/")
	if idx != -1 {
		return mediaURL[idx:]
	}
	return ""
}
