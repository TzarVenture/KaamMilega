package credential

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"km-backend/internal/features/file"
	"km-backend/internal/features/network"
	"km-backend/internal/features/notification"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ─── Fakes ──────────────────────────────────────────────────────────────────────

type memRepo struct {
	endorsements []Endorsement
	certs        map[primitive.ObjectID]*Certification
	blocks       map[[2]primitive.ObjectID]bool
}

func newMemRepo() *memRepo {
	return &memRepo{certs: map[primitive.ObjectID]*Certification{}, blocks: map[[2]primitive.ObjectID]bool{}}
}

func (m *memRepo) Endorse(_ context.Context, e *Endorsement) (bool, error) {
	for _, x := range m.endorsements {
		if x.UserID == e.UserID && x.SkillKey == e.SkillKey && x.EndorserID == e.EndorserID {
			return false, nil
		}
	}
	e.ID = primitive.NewObjectID()
	m.endorsements = append(m.endorsements, *e)
	return true, nil
}
func (m *memRepo) Unendorse(_ context.Context, u primitive.ObjectID, key string, by primitive.ObjectID) error {
	out := m.endorsements[:0]
	for _, x := range m.endorsements {
		if !(x.UserID == u && x.SkillKey == key && x.EndorserID == by) {
			out = append(out, x)
		}
	}
	m.endorsements = out
	return nil
}
func (m *memRepo) EndorsementsFor(_ context.Context, u primitive.ObjectID) ([]Endorsement, error) {
	var out []Endorsement
	for i := len(m.endorsements) - 1; i >= 0; i-- {
		if m.endorsements[i].UserID == u {
			out = append(out, m.endorsements[i])
		}
	}
	return out, nil
}
func (m *memRepo) EndorsersOf(ctx context.Context, u primitive.ObjectID, key string, _ int) ([]Endorsement, error) {
	all, _ := m.EndorsementsFor(ctx, u)
	var out []Endorsement
	for _, e := range all {
		if e.SkillKey == key {
			out = append(out, e)
		}
	}
	return out, nil
}
func (m *memRepo) CountEndorsementsSince(_ context.Context, by primitive.ObjectID, since time.Time) (int64, error) {
	var n int64
	for _, e := range m.endorsements {
		if e.EndorserID == by && !e.CreatedAt.Before(since) {
			n++
		}
	}
	return n, nil
}
func (m *memRepo) Blocked(_ context.Context, a, b primitive.ObjectID) (bool, error) {
	return m.blocks[[2]primitive.ObjectID{a, b}] || m.blocks[[2]primitive.ObjectID{b, a}], nil
}
func (m *memRepo) CreateCertification(_ context.Context, c *Certification) error {
	cp := *c
	m.certs[c.ID] = &cp
	return nil
}
func (m *memRepo) UpdateCertification(_ context.Context, c *Certification) error {
	cp := *c
	m.certs[c.ID] = &cp
	return nil
}
func (m *memRepo) DeleteCertification(_ context.Context, id, u primitive.ObjectID) (bool, error) {
	if c, ok := m.certs[id]; ok && c.UserID == u {
		delete(m.certs, id)
		return true, nil
	}
	return false, nil
}
func (m *memRepo) FindCertification(_ context.Context, id primitive.ObjectID) (*Certification, error) {
	if c, ok := m.certs[id]; ok {
		cp := *c
		return &cp, nil
	}
	return nil, nil
}
func (m *memRepo) ListCertifications(_ context.Context, u primitive.ObjectID) ([]Certification, error) {
	var out []Certification
	for _, c := range m.certs {
		if c.UserID == u {
			out = append(out, *c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].IssuedOn > out[j].IssuedOn })
	return out, nil
}
func (m *memRepo) CountCertifications(ctx context.Context, u primitive.ObjectID) (int64, error) {
	l, _ := m.ListCertifications(ctx, u)
	return int64(len(l)), nil
}
func (m *memRepo) ListByStatus(_ context.Context, status string, _ int) ([]Certification, error) {
	var out []Certification
	for _, c := range m.certs {
		if status == "" || c.Status == status {
			out = append(out, *c)
		}
	}
	return out, nil
}
func (m *memRepo) Review(_ context.Context, id primitive.ObjectID, status, note string, by primitive.ObjectID, at time.Time) (bool, error) {
	c, ok := m.certs[id]
	if !ok || c.Status != StatusPending {
		return false, nil
	}
	c.Status, c.ReviewNote, c.ReviewedBy, c.ReviewedAt = status, note, &by, &at
	return true, nil
}

type memUsers map[primitive.ObjectID]*user.User

func (m memUsers) FindUserByID(_ context.Context, id string) (*user.User, error) {
	oid, _ := primitive.ObjectIDFromHex(id)
	return m[oid], nil
}
func (m memUsers) FindUsersByIDs(_ context.Context, ids []primitive.ObjectID) (map[primitive.ObjectID]*user.User, error) {
	out := map[primitive.ObjectID]*user.User{}
	for _, id := range ids {
		if u, ok := m[id]; ok {
			out[id] = u
		}
	}
	return out, nil
}

// Private profiles are hidden from everyone but the owner and admins
type gate struct{}

func (gate) CanViewProfile(_ context.Context, owner *user.User, viewerID string, admin bool) (bool, error) {
	if admin || owner.ID.Hex() == viewerID {
		return true, nil
	}
	return user.IsActiveAccount(owner.AccountStatus) && owner.Settings.ProfileVisibility != "private", nil
}

type memConnections map[[2]primitive.ObjectID]bool

func (m memConnections) GetConnectionStatus(_ context.Context, a, b primitive.ObjectID) (network.ConnectionStatus, error) {
	if m[[2]primitive.ObjectID{a, b}] || m[[2]primitive.ObjectID{b, a}] {
		return network.StatusAccepted, nil
	}
	return "", nil
}

type memFiles map[string]*file.File

func (m memFiles) Get(_ context.Context, id string) (*file.File, error) { return m[id], nil }

type memNotify struct {
	sent chan notification.CreateNotificationRequest
}

func (m *memNotify) CreateNotification(_ context.Context, r notification.CreateNotificationRequest) (*notification.Notification, error) {
	m.sent <- r
	return &notification.Notification{}, nil
}

type fixture struct {
	svc                      *service
	repo                     *memRepo
	users                    memUsers
	conns                    memConnections
	files                    memFiles
	notify                   *memNotify
	asha, ravi, meena, admin primitive.ObjectID
	now                      time.Time
}

func newFixture() *fixture {
	f := &fixture{repo: newMemRepo(), users: memUsers{}, conns: memConnections{}, files: memFiles{},
		notify: &memNotify{sent: make(chan notification.CreateNotificationRequest, 10)},
		asha:   primitive.NewObjectID(), ravi: primitive.NewObjectID(), meena: primitive.NewObjectID(), admin: primitive.NewObjectID(),
		now: time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)}
	f.users[f.asha] = &user.User{ID: f.asha, Name: "Asha", Skills: []string{"Electrician", "CCTV Technician", "Solar Installation"}}
	f.users[f.ravi] = &user.User{ID: f.ravi, Name: "Ravi"}
	f.users[f.meena] = &user.User{ID: f.meena, Name: "Meena"}
	f.users[f.admin] = &user.User{ID: f.admin, Name: "Admin", Roles: []string{"admin"}}
	f.conns[[2]primitive.ObjectID{f.asha, f.ravi}] = true
	f.svc = newService(f.repo, f.users, gate{}, f.conns, f.files, f.notify)
	f.svc.now = func() time.Time { return f.now }
	return f
}

func (f *fixture) skill(t *testing.T, viewer *primitive.ObjectID, name string) SkillView {
	t.Helper()
	p, err := f.svc.Profile(context.Background(), viewer, false, f.asha.Hex())
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range p.Skills {
		if s.Name == name {
			return s
		}
	}
	t.Fatalf("skill %q not on profile", name)
	return SkillView{}
}

// ─── Endorsements ───────────────────────────────────────────────────────────────

func TestEndorseRules(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	cases := []struct {
		name  string
		by    primitive.ObjectID
		skill string
		want  error
	}{
		{"own skill", f.asha, "Electrician", ErrEndorseSelf},
		{"not connected", f.meena, "Electrician", ErrNotConnected},
		{"skill not on profile", f.ravi, "Plumbing", ErrSkillNotListed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := f.svc.Endorse(ctx, c.by, f.asha.Hex(), c.skill); !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}

	// A block ends the right to endorse even between connections
	f.repo.blocks[[2]primitive.ObjectID{f.asha, f.ravi}] = true
	if err := f.svc.Endorse(ctx, f.ravi, f.asha.Hex(), "Electrician"); !errors.Is(err, ErrNotConnected) {
		t.Fatalf("blocked endorser: %v", err)
	}
	delete(f.repo.blocks, [2]primitive.ObjectID{f.asha, f.ravi})

	// Suspended members can't be endorsed
	f.users[f.asha].AccountStatus = user.AccountSuspended
	if err := f.svc.Endorse(ctx, f.ravi, f.asha.Hex(), "Electrician"); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("suspended owner: %v", err)
	}
}

func TestEndorseCountsOnceAndNotifiesOnce(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	// Case and spacing don't make a different skill
	for _, s := range []string{"electrician", "  ELECTRICIAN "} {
		if err := f.svc.Endorse(ctx, f.ravi, f.asha.Hex(), s); err != nil {
			t.Fatal(err)
		}
	}
	got := f.skill(t, &f.ravi, "Electrician")
	if got.Endorsements != 1 || !got.EndorsedByMe || len(got.Endorsers) != 1 || got.Endorsers[0].Name != "Ravi" {
		t.Fatalf("after endorsing: %+v", got)
	}
	if f.repo.endorsements[0].Skill != "Electrician" {
		t.Errorf("stored skill %q, want the owner's spelling", f.repo.endorsements[0].Skill)
	}
	select {
	case n := <-f.notify.sent:
		if n.UserID != f.asha || n.Type != notification.TypeSkillEndorsement || n.Message != "Ravi endorsed you for Electrician" {
			t.Errorf("notification %+v", n)
		}
	case <-time.After(time.Second):
		t.Fatal("no notification")
	}
	select {
	case n := <-f.notify.sent:
		t.Fatalf("second notification for a repeat endorsement: %+v", n)
	case <-time.After(50 * time.Millisecond):
	}

	// Taking it back
	if err := f.svc.Unendorse(ctx, f.ravi, f.asha.Hex(), "Electrician"); err != nil {
		t.Fatal(err)
	}
	if got := f.skill(t, &f.ravi, "Electrician"); got.Endorsements != 0 || got.EndorsedByMe {
		t.Fatalf("after taking back: %+v", got)
	}
}

func TestEndorsementsFromClosedAccountsDontCount(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	if err := f.svc.Endorse(ctx, f.ravi, f.asha.Hex(), "Electrician"); err != nil {
		t.Fatal(err)
	}
	f.users[f.ravi].AccountStatus = user.AccountDeactivated
	if got := f.skill(t, nil, "Electrician"); got.Endorsements != 0 || len(got.Endorsers) != 0 {
		t.Fatalf("closed endorser still counted: %+v", got)
	}
}

func TestEndorseDailyLimit(t *testing.T) {
	f := newFixture()
	for i := 0; i < MaxEndorsementsPerDay; i++ {
		f.repo.endorsements = append(f.repo.endorsements, Endorsement{UserID: primitive.NewObjectID(), SkillKey: "x", EndorserID: f.ravi, CreatedAt: f.now})
	}
	if err := f.svc.Endorse(context.Background(), f.ravi, f.asha.Hex(), "Electrician"); !errors.Is(err, ErrEndorseLimit) {
		t.Fatalf("over the daily limit: %v", err)
	}
}

func TestProfileCanEndorseAndPrivacy(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	for _, c := range []struct {
		name   string
		viewer *primitive.ObjectID
		want   bool
	}{{"connection", &f.ravi, true}, {"stranger", &f.meena, false}, {"guest", nil, false}, {"owner", &f.asha, false}} {
		p, err := f.svc.Profile(ctx, c.viewer, false, f.asha.Hex())
		if err != nil || p.CanEndorse != c.want {
			t.Errorf("%s: can_endorse %v err %v, want %v", c.name, p != nil && p.CanEndorse, err, c.want)
		}
	}
	f.users[f.asha].Settings.ProfileVisibility = "private"
	if _, err := f.svc.Profile(ctx, &f.meena, false, f.asha.Hex()); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("private profile shown to a stranger: %v", err)
	}
	if _, err := f.svc.Profile(ctx, &f.asha, false, f.asha.Hex()); err != nil {
		t.Fatalf("owner can't see own private profile: %v", err)
	}
}

// ─── Certificates ───────────────────────────────────────────────────────────────

func validCert() CertificationRequest {
	return CertificationRequest{Name: "Wireman Licence", Issuer: "Maharashtra Electrical Board", IssuedOn: "2024-05", CredentialID: "WL-12345",
		Skills: []string{"electrician"}}
}

func TestCertificationValidation(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.files["6a0000000000000000000001"] = &file.File{UploadedBy: f.ravi, Kind: FileKindCertificate, URL: "/api/files/x"}
	f.files["6a0000000000000000000002"] = &file.File{UploadedBy: f.asha, Kind: "avatar", URL: "https://cdn/x.jpg"}
	mod := func(fn func(*CertificationRequest)) CertificationRequest { r := validCert(); fn(&r); return r }
	cases := []struct {
		name string
		req  CertificationRequest
		want error
	}{
		{"no name", mod(func(r *CertificationRequest) { r.Name = " " }), ErrCertName},
		{"no issuer", mod(func(r *CertificationRequest) { r.Issuer = "" }), ErrCertIssuer},
		{"bad month", mod(func(r *CertificationRequest) { r.IssuedOn = "2024-13" }), ErrCertDate},
		{"future", mod(func(r *CertificationRequest) { r.IssuedOn = "2027-01" }), ErrCertDate},
		{"expires before issued", mod(func(r *CertificationRequest) { r.ExpiresOn = "2023-01" }), ErrCertDate},
		{"script link", mod(func(r *CertificationRequest) { r.CredentialURL = "javascript:alert(1)" }), ErrCertURL},
		{"someone else's file", mod(func(r *CertificationRequest) { r.FileID = "6a0000000000000000000001" }), ErrCertFile},
		{"wrong file kind", mod(func(r *CertificationRequest) { r.FileID = "6a0000000000000000000002" }), ErrCertFile},
		{"skill not on profile", mod(func(r *CertificationRequest) { r.Skills = []string{"Plumbing"} }), ErrCertSkills},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := f.svc.AddCertification(ctx, f.asha, c.req); !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
	if len(f.repo.certs) != 0 {
		t.Fatalf("%d invalid certificates were saved", len(f.repo.certs))
	}

	// Without anything to check it can't be verified; with an ID it waits for review
	bare, err := f.svc.AddCertification(ctx, f.asha, mod(func(r *CertificationRequest) { r.CredentialID = "" }))
	if err != nil || bare.Status != StatusUnverified {
		t.Fatalf("bare certificate: %+v %v", bare, err)
	}
	withID, err := f.svc.AddCertification(ctx, f.asha, validCert())
	if err != nil || withID.Status != StatusPending || withID.Skills[0] != "Electrician" {
		t.Fatalf("certificate with an ID: %+v %v", withID, err)
	}
}

func TestReviewGivesCertifiedBadge(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.files["6a0000000000000000000003"] = &file.File{UploadedBy: f.asha, Kind: FileKindCertificate, URL: "/api/files/6a0000000000000000000003"}
	req := validCert()
	req.FileID = "6a0000000000000000000003"
	c, err := f.svc.AddCertification(ctx, f.asha, req)
	if err != nil {
		t.Fatal(err)
	}
	if f.skill(t, nil, "Electrician").Certified {
		t.Fatal("certified before review")
	}

	if _, err := f.svc.Review(ctx, f.admin, c.ID, ReviewRequest{Decision: "reject"}); !errors.Is(err, ErrReviewDecision) {
		t.Fatalf("rejection without a reason: %v", err)
	}
	if _, err := f.svc.Review(ctx, f.admin, c.ID, ReviewRequest{Decision: "verify"}); err != nil {
		t.Fatal(err)
	}
	if !f.skill(t, nil, "Electrician").Certified || f.skill(t, nil, "CCTV Technician").Certified {
		t.Fatal("badge on the wrong skills")
	}
	if _, err := f.svc.Review(ctx, f.admin, c.ID, ReviewRequest{Decision: "verify"}); !errors.Is(err, ErrReviewState) {
		t.Fatalf("reviewed twice: %v", err)
	}

	// Visitors don't get the private proof file; the owner does
	p, _ := f.svc.Profile(ctx, &f.ravi, false, f.asha.Hex())
	if p.Certifications[0].FileURL != "" {
		t.Error("proof file shown to a visitor")
	}
	p, _ = f.svc.Profile(ctx, &f.asha, false, f.asha.Hex())
	if p.Certifications[0].FileURL == "" {
		t.Error("owner can't see their proof file")
	}

	// Renaming keeps nothing a reviewer saw, so it goes back for review and loses the badge
	req.Name = "Wireman Licence Grade A"
	upd, err := f.svc.UpdateCertification(ctx, f.asha, c.ID, req)
	if err != nil || upd.Status != StatusPending || f.skill(t, nil, "Electrician").Certified {
		t.Fatalf("after changing evidence: %+v %v", upd, err)
	}

	// Expired certificates stop counting
	if _, err := f.svc.Review(ctx, f.admin, c.ID, ReviewRequest{Decision: "verify"}); err != nil {
		t.Fatal(err)
	}
	req.ExpiresOn = "2025-01"
	f.repo.certs[mustID(t, c.ID)].ExpiresOn = "2025-01"
	if f.skill(t, nil, "Electrician").Certified {
		t.Fatal("expired certificate still gives the badge")
	}
}

func TestRejectedLooksUnverifiedToVisitors(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	c, _ := f.svc.AddCertification(ctx, f.asha, validCert())
	if _, err := f.svc.Review(ctx, f.admin, c.ID, ReviewRequest{Decision: "reject", Note: "The ID doesn't match the issuer's records"}); err != nil {
		t.Fatal(err)
	}
	p, _ := f.svc.Profile(ctx, &f.ravi, false, f.asha.Hex())
	if p.Certifications[0].Status != StatusUnverified || p.Certifications[0].ReviewNote != "" {
		t.Errorf("visitor sees %+v", p.Certifications[0])
	}
	p, _ = f.svc.Profile(ctx, &f.asha, false, f.asha.Hex())
	if p.Certifications[0].Status != StatusRejected || p.Certifications[0].ReviewNote == "" {
		t.Errorf("owner sees %+v", p.Certifications[0])
	}
}

func TestOnlyOwnerChangesCertificates(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	c, _ := f.svc.AddCertification(ctx, f.asha, validCert())
	if _, err := f.svc.UpdateCertification(ctx, f.ravi, c.ID, validCert()); !errors.Is(err, ErrCertNotFound) {
		t.Fatalf("someone else edited it: %v", err)
	}
	if err := f.svc.DeleteCertification(ctx, f.ravi, c.ID); !errors.Is(err, ErrCertNotFound) {
		t.Fatalf("someone else deleted it: %v", err)
	}
	if err := f.svc.DeleteCertification(ctx, f.asha, c.ID); err != nil {
		t.Fatal(err)
	}
}

func mustID(t *testing.T, s string) primitive.ObjectID {
	t.Helper()
	id, err := primitive.ObjectIDFromHex(s)
	if err != nil {
		t.Fatal(err)
	}
	return id
}
