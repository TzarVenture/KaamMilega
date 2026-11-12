package credential

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/features/file"
	"km-backend/internal/features/network"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service interface {
	Profile(ctx context.Context, viewer *primitive.ObjectID, viewerIsAdmin bool, userID string) (*ProfileCredentials, error)
	Endorsers(ctx context.Context, viewer *primitive.ObjectID, viewerIsAdmin bool, userID, skill string) (*EndorserList, error)
	Endorse(ctx context.Context, endorser primitive.ObjectID, userID, skill string) error
	Unendorse(ctx context.Context, endorser primitive.ObjectID, userID, skill string) error

	AddCertification(ctx context.Context, owner primitive.ObjectID, req CertificationRequest) (*CertificationView, error)
	UpdateCertification(ctx context.Context, owner primitive.ObjectID, certID string, req CertificationRequest) (*CertificationView, error)
	DeleteCertification(ctx context.Context, owner primitive.ObjectID, certID string) error

	ReviewQueue(ctx context.Context, status string) ([]ReviewItem, error)
	Review(ctx context.Context, admin primitive.ObjectID, certID string, req ReviewRequest) (*CertificationView, error)
}

// What the service needs from other modules, kept small so tests can fake them
type userLookup interface {
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUsersByIDs(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error)
}
type profileGate interface {
	CanViewProfile(ctx context.Context, owner *user.User, viewerID string, viewerIsAdmin bool) (bool, error)
}
type connectionLookup interface {
	GetConnectionStatus(ctx context.Context, a, b primitive.ObjectID) (network.ConnectionStatus, error)
}
type fileLookup interface {
	Get(ctx context.Context, id string) (*file.File, error)
}
type notifier interface {
	CreateNotification(ctx context.Context, req notification.CreateNotificationRequest) (*notification.Notification, error)
}

type service struct {
	repo        Repository
	users       userLookup
	profiles    profileGate
	connections connectionLookup
	files       fileLookup
	notify      notifier
	now         func() time.Time
}

func NewService(repo Repository, users user.UserRepository, profiles user.UserService, connections network.NetworkRepository,
	files file.FileRepository, notify notification.NotificationService) Service {
	return newService(repo, users, profiles, connections, files, notify)
}

func newService(repo Repository, users userLookup, profiles profileGate, connections connectionLookup, files fileLookup, notify notifier) *service {
	return &service{repo: repo, users: users, profiles: profiles, connections: connections, files: files, notify: notify, now: time.Now}
}

// ─── Reading a profile ──────────────────────────────────────────────────────────

// visibleOwner loads a profile the viewer is allowed to see
func (s *service) visibleOwner(ctx context.Context, viewer *primitive.ObjectID, viewerIsAdmin bool, userID string) (*user.User, error) {
	if _, err := primitive.ObjectIDFromHex(userID); err != nil {
		return nil, ErrUserNotFound
	}
	u, err := s.users.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return nil, ErrUserNotFound
	}
	viewerID := ""
	if viewer != nil {
		viewerID = viewer.Hex()
	}
	ok, err := s.profiles.CanViewProfile(ctx, u, viewerID, viewerIsAdmin)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}

func (s *service) Profile(ctx context.Context, viewer *primitive.ObjectID, viewerIsAdmin bool, userID string) (*ProfileCredentials, error) {
	u, err := s.visibleOwner(ctx, viewer, viewerIsAdmin, userID)
	if err != nil {
		return nil, err
	}
	isOwner := viewer != nil && *viewer == u.ID

	endorsements, err := s.repo.EndorsementsFor(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	certs, err := s.repo.ListCertifications(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	endorserIDs := make([]primitive.ObjectID, 0, len(endorsements))
	for _, e := range endorsements {
		endorserIDs = append(endorserIDs, e.EndorserID)
	}
	bylines, err := s.activeBylines(ctx, endorserIDs)
	if err != nil {
		return nil, err
	}

	now := s.now()
	certified := map[string]bool{}
	for i := range certs {
		if certs[i].Status == StatusVerified && !certs[i].Expired(now) {
			for _, sk := range certs[i].Skills {
				certified[skillKey(sk)] = true
			}
		}
	}

	bySkill := map[string][]Endorsement{}
	for _, e := range endorsements {
		bySkill[e.SkillKey] = append(bySkill[e.SkillKey], e)
	}
	out := &ProfileCredentials{Skills: []SkillView{}, Certifications: []CertificationView{}, IsOwner: isOwner}
	seen := map[string]bool{}
	for _, name := range u.Skills {
		key := skillKey(name)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		v := SkillView{Name: strings.TrimSpace(name), Endorsers: []user.Byline{}, Certified: certified[key]}
		// Newest first; endorsers whose accounts closed don't count
		for _, e := range bySkill[key] {
			b, ok := bylines[e.EndorserID]
			if !ok {
				continue
			}
			v.Endorsements++
			if viewer != nil && e.EndorserID == *viewer {
				v.EndorsedByMe = true
			}
			if len(v.Endorsers) < EndorsersShown {
				v.Endorsers = append(v.Endorsers, b)
			}
		}
		out.Skills = append(out.Skills, v)
	}
	for i := range certs {
		out.Certifications = append(out.Certifications, certView(&certs[i], now, isOwner || viewerIsAdmin, isOwner))
	}
	if viewer != nil && !isOwner {
		if out.CanEndorse, err = s.canEndorse(ctx, *viewer, u.ID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (s *service) Endorsers(ctx context.Context, viewer *primitive.ObjectID, viewerIsAdmin bool, userID, skill string) (*EndorserList, error) {
	u, err := s.visibleOwner(ctx, viewer, viewerIsAdmin, userID)
	if err != nil {
		return nil, err
	}
	name, ok := listedSkill(u, skill)
	if !ok {
		return nil, ErrSkillNotListed
	}
	es, err := s.repo.EndorsersOf(ctx, u.ID, skillKey(skill), 200)
	if err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(es))
	for _, e := range es {
		ids = append(ids, e.EndorserID)
	}
	bylines, err := s.activeBylines(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := &EndorserList{Skill: name, Endorsers: []user.Byline{}}
	for _, e := range es {
		if b, ok := bylines[e.EndorserID]; ok {
			out.Endorsers = append(out.Endorsers, b)
		}
	}
	return out, nil
}

// ─── Endorsing ──────────────────────────────────────────────────────────────────

func (s *service) canEndorse(ctx context.Context, endorser, owner primitive.ObjectID) (bool, error) {
	status, err := s.connections.GetConnectionStatus(ctx, endorser, owner)
	if err != nil || status != network.StatusAccepted {
		return false, err
	}
	blocked, err := s.repo.Blocked(ctx, endorser, owner)
	return !blocked, err
}

func (s *service) Endorse(ctx context.Context, endorser primitive.ObjectID, userID, skill string) error {
	owner, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if owner == endorser {
		return ErrEndorseSelf
	}
	u, err := s.users.FindUserByID(ctx, userID)
	if err != nil || u == nil || !user.IsActiveAccount(u.AccountStatus) {
		return ErrUserNotFound
	}
	name, ok := listedSkill(u, skill)
	if !ok {
		return ErrSkillNotListed
	}
	allowed, err := s.canEndorse(ctx, endorser, owner)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrNotConnected
	}
	now := s.now()
	count, err := s.repo.CountEndorsementsSince(ctx, endorser, now.Add(-24*time.Hour))
	if err != nil {
		return err
	}
	if count >= MaxEndorsementsPerDay {
		return ErrEndorseLimit
	}
	created, err := s.repo.Endorse(ctx, &Endorsement{UserID: owner, SkillKey: skillKey(name), Skill: name, EndorserID: endorser, CreatedAt: now})
	if err != nil {
		return err
	}
	if created {
		s.notifyEndorsement(owner, endorser, name)
	}
	return nil
}

func (s *service) Unendorse(ctx context.Context, endorser primitive.ObjectID, userID, skill string) error {
	owner, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return ErrUserNotFound
	}
	key := skillKey(skill)
	if key == "" {
		return ErrSkillNotListed
	}
	return s.repo.Unendorse(ctx, owner, key, endorser)
}

// listedSkill finds the skill on the member's profile, returning it as they wrote it
func listedSkill(u *user.User, skill string) (string, bool) {
	key := skillKey(skill)
	if key == "" {
		return "", false
	}
	for _, s := range u.Skills {
		if skillKey(s) == key {
			return strings.TrimSpace(s), true
		}
	}
	return "", false
}

func (s *service) activeBylines(ctx context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]user.Byline, error) {
	out := map[primitive.ObjectID]user.Byline{}
	if len(ids) == 0 {
		return out, nil
	}
	users, err := s.users.FindUsersByIDs(ctx, unique(ids))
	if err != nil {
		return nil, err
	}
	for id, u := range users {
		if u != nil && user.IsActiveAccount(u.AccountStatus) {
			out[id] = user.BylineOf(u)
		}
	}
	return out, nil
}

func unique(ids []primitive.ObjectID) []primitive.ObjectID {
	seen := make(map[primitive.ObjectID]bool, len(ids))
	out := make([]primitive.ObjectID, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// ─── Certificates ───────────────────────────────────────────────────────────────

var monthRe = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

func (s *service) AddCertification(ctx context.Context, owner primitive.ObjectID, req CertificationRequest) (*CertificationView, error) {
	n, err := s.repo.CountCertifications(ctx, owner)
	if err != nil {
		return nil, err
	}
	if n >= MaxCertifications {
		return nil, ErrCertLimit
	}
	c, err := s.buildCertification(ctx, owner, req)
	if err != nil {
		return nil, err
	}
	now := s.now()
	c.ID = primitive.NewObjectIDFromTimestamp(now)
	c.Status = initialStatus(c)
	c.CreatedAt, c.UpdatedAt = now, now
	if err := s.repo.CreateCertification(ctx, c); err != nil {
		return nil, err
	}
	v := certView(c, now, true, true)
	return &v, nil
}

func (s *service) UpdateCertification(ctx context.Context, owner primitive.ObjectID, certID string, req CertificationRequest) (*CertificationView, error) {
	old, err := s.ownCertification(ctx, owner, certID)
	if err != nil {
		return nil, err
	}
	c, err := s.buildCertification(ctx, owner, req)
	if err != nil {
		return nil, err
	}
	c.ID, c.CreatedAt = old.ID, old.CreatedAt
	if sameEvidence(old, c) {
		// Nothing a reviewer looked at changed, so the review stands
		c.Status, c.ReviewNote, c.ReviewedBy, c.ReviewedAt = old.Status, old.ReviewNote, old.ReviewedBy, old.ReviewedAt
	} else {
		c.Status = initialStatus(c)
	}
	c.UpdatedAt = s.now()
	if err := s.repo.UpdateCertification(ctx, c); err != nil {
		return nil, err
	}
	v := certView(c, s.now(), true, true)
	return &v, nil
}

func (s *service) DeleteCertification(ctx context.Context, owner primitive.ObjectID, certID string) error {
	id, err := primitive.ObjectIDFromHex(certID)
	if err != nil {
		return ErrCertNotFound
	}
	ok, err := s.repo.DeleteCertification(ctx, id, owner)
	if err != nil {
		return err
	}
	if !ok {
		return ErrCertNotFound
	}
	return nil
}

func (s *service) ownCertification(ctx context.Context, owner primitive.ObjectID, certID string) (*Certification, error) {
	id, err := primitive.ObjectIDFromHex(certID)
	if err != nil {
		return nil, ErrCertNotFound
	}
	c, err := s.repo.FindCertification(ctx, id)
	if err != nil {
		return nil, err
	}
	if c == nil || c.UserID != owner {
		return nil, ErrCertNotFound
	}
	return c, nil
}

// buildCertification checks a request and turns it into a certificate (without ID or status)
func (s *service) buildCertification(ctx context.Context, owner primitive.ObjectID, req CertificationRequest) (*Certification, error) {
	c := &Certification{
		UserID:        owner,
		Name:          strings.Join(strings.Fields(req.Name), " "),
		Issuer:        strings.Join(strings.Fields(req.Issuer), " "),
		IssuedOn:      strings.TrimSpace(req.IssuedOn),
		ExpiresOn:     strings.TrimSpace(req.ExpiresOn),
		CredentialID:  strings.TrimSpace(req.CredentialID),
		CredentialURL: strings.TrimSpace(req.CredentialURL),
	}
	if n := utf8.RuneCountInString(c.Name); n < 2 || n > 120 {
		return nil, ErrCertName
	}
	if n := utf8.RuneCountInString(c.Issuer); n < 2 || n > 120 {
		return nil, ErrCertIssuer
	}
	if !monthRe.MatchString(c.IssuedOn) || c.IssuedOn > s.now().Format("2006-01") {
		return nil, ErrCertDate
	}
	if c.ExpiresOn != "" && (!monthRe.MatchString(c.ExpiresOn) || c.ExpiresOn < c.IssuedOn) {
		return nil, ErrCertDate
	}
	if utf8.RuneCountInString(c.CredentialID) > 100 {
		return nil, ErrCertCredentialID
	}
	if c.CredentialURL != "" {
		u, err := url.Parse(c.CredentialURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || len(c.CredentialURL) > 500 {
			return nil, ErrCertURL
		}
	}
	if fid := strings.TrimSpace(req.FileID); fid != "" {
		id, err := primitive.ObjectIDFromHex(fid)
		if err != nil {
			return nil, ErrCertFile
		}
		f, err := s.files.Get(ctx, fid)
		if err != nil || f == nil || f.UploadedBy != owner || f.Kind != FileKindCertificate {
			return nil, ErrCertFile
		}
		c.FileID, c.FileURL = &id, f.URL
	}
	if len(req.Skills) > 0 {
		if len(req.Skills) > MaxCertSkills {
			return nil, ErrCertSkills
		}
		u, err := s.users.FindUserByID(ctx, owner.Hex())
		if err != nil || u == nil {
			return nil, ErrCertSkills
		}
		seen := map[string]bool{}
		for _, sk := range req.Skills {
			name, ok := listedSkill(u, sk)
			if !ok {
				return nil, ErrCertSkills
			}
			if !seen[skillKey(name)] {
				seen[skillKey(name)] = true
				c.Skills = append(c.Skills, name)
			}
		}
	}
	return c, nil
}

// initialStatus: with something to check (a file, a link or an ID) it waits for review
func initialStatus(c *Certification) string {
	if c.FileID != nil || c.CredentialURL != "" || c.CredentialID != "" {
		return StatusPending
	}
	return StatusUnverified
}

// sameEvidence: every field a reviewer relies on is unchanged
func sameEvidence(a, b *Certification) bool {
	sameFile := (a.FileID == nil && b.FileID == nil) || (a.FileID != nil && b.FileID != nil && *a.FileID == *b.FileID)
	return sameFile && a.Name == b.Name && a.Issuer == b.Issuer && a.IssuedOn == b.IssuedOn && a.ExpiresOn == b.ExpiresOn &&
		a.CredentialID == b.CredentialID && a.CredentialURL == b.CredentialURL && sameSkills(a.Skills, b.Skills)
}

func sameSkills(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	keys := map[string]bool{}
	for _, s := range a {
		keys[skillKey(s)] = true
	}
	for _, s := range b {
		if !keys[skillKey(s)] {
			return false
		}
	}
	return true
}

func certView(c *Certification, now time.Time, showFile, showReview bool) CertificationView {
	v := CertificationView{
		ID: c.ID.Hex(), Name: c.Name, Issuer: c.Issuer, IssuedOn: c.IssuedOn, ExpiresOn: c.ExpiresOn, Expired: c.Expired(now),
		CredentialID: c.CredentialID, CredentialURL: c.CredentialURL, Skills: c.Skills, Status: c.Status, CreatedAt: c.CreatedAt,
	}
	if v.Skills == nil {
		v.Skills = []string{}
	}
	if showFile && c.FileID != nil {
		v.FileID, v.FileURL = c.FileID.Hex(), c.FileURL
	}
	if showReview {
		v.ReviewNote, v.ReviewedAt = c.ReviewNote, c.ReviewedAt
	} else if v.Status == StatusRejected {
		// Visitors only learn whether a certificate is verified
		v.Status = StatusUnverified
	}
	return v
}

// ─── Admin review ───────────────────────────────────────────────────────────────

func (s *service) ReviewQueue(ctx context.Context, status string) ([]ReviewItem, error) {
	switch status {
	case StatusPending, StatusVerified, StatusRejected, StatusUnverified, "":
	default:
		status = StatusPending
	}
	certs, err := s.repo.ListByStatus(ctx, status, 200)
	if err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(certs))
	for _, c := range certs {
		ids = append(ids, c.UserID)
	}
	owners, err := s.users.FindUsersByIDs(ctx, unique(ids))
	if err != nil {
		return nil, err
	}
	now := s.now()
	out := make([]ReviewItem, 0, len(certs))
	for i := range certs {
		u := owners[certs[i].UserID]
		if u == nil {
			continue
		}
		out = append(out, ReviewItem{CertificationView: certView(&certs[i], now, true, true), Owner: user.BylineOf(u)})
	}
	return out, nil
}

func (s *service) Review(ctx context.Context, admin primitive.ObjectID, certID string, req ReviewRequest) (*CertificationView, error) {
	id, err := primitive.ObjectIDFromHex(certID)
	if err != nil {
		return nil, ErrCertNotFound
	}
	note := strings.TrimSpace(req.Note)
	var status string
	switch req.Decision {
	case "verify":
		status = StatusVerified
	case "reject":
		status = StatusRejected
		if n := utf8.RuneCountInString(note); n < 5 || n > 300 {
			return nil, ErrReviewDecision
		}
	default:
		return nil, ErrReviewDecision
	}
	if utf8.RuneCountInString(note) > 300 {
		return nil, ErrReviewDecision
	}
	now := s.now()
	ok, err := s.repo.Review(ctx, id, status, note, admin, now)
	if err != nil {
		return nil, err
	}
	if !ok {
		c, err := s.repo.FindCertification(ctx, id)
		if err != nil {
			return nil, err
		}
		if c == nil {
			return nil, ErrCertNotFound
		}
		return nil, ErrReviewState
	}
	c, err := s.repo.FindCertification(ctx, id)
	if err != nil || c == nil {
		return nil, ErrCertNotFound
	}
	s.notifyReview(c)
	v := certView(c, now, true, true)
	return &v, nil
}

// ─── Notifications ──────────────────────────────────────────────────────────────

func (s *service) notifyEndorsement(owner, endorser primitive.ObjectID, skill string) {
	if s.notify == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		bylines, err := s.activeBylines(ctx, []primitive.ObjectID{endorser})
		if err != nil {
			return
		}
		b, ok := bylines[endorser]
		if !ok {
			return
		}
		if _, err := s.notify.CreateNotification(ctx, notification.CreateNotificationRequest{
			UserID: owner, ActorID: &endorser, ActorName: b.Name, ActorAvatar: b.Avatar,
			Type: notification.TypeSkillEndorsement, Category: notification.CategoryNetwork,
			Title:    "New skill endorsement",
			Message:  fmt.Sprintf("%s endorsed you for %s", b.Name, skill),
			Link:     "/profile#skills",
			Metadata: map[string]interface{}{"skill": skill},
		}); err != nil {
			log.Printf("credential: endorsement notification failed: %v", err)
		}
	}()
}

func (s *service) notifyReview(c *Certification) {
	if s.notify == nil {
		return
	}
	title, msg := "Certificate verified", fmt.Sprintf("We checked \"%s\" and marked it verified on your profile.", c.Name)
	if c.Status == StatusRejected {
		title, msg = "Certificate not verified", fmt.Sprintf("We couldn't verify \"%s\": %s", c.Name, c.ReviewNote)
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := s.notify.CreateNotification(ctx, notification.CreateNotificationRequest{
			UserID: c.UserID, Type: notification.TypeCertificateReview, Category: notification.CategorySystem,
			Title: title, Message: msg, Link: "/profile#certifications",
			Metadata: map[string]interface{}{"certification_id": c.ID.Hex(), "status": c.Status},
		}); err != nil {
			log.Printf("credential: review notification failed: %v", err)
		}
	}()
}
