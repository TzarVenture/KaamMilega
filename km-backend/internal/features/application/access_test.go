package application

import (
	"context"
	"testing"

	"km-backend/internal/features/job"
	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeApps struct {
	ApplicationRepository
	app     *Application
	updates int
}

func (f *fakeApps) FindByID(_ context.Context, id string) (*Application, error) {
	if f.app != nil && f.app.ID.Hex() == id {
		c := *f.app
		return &c, nil
	}
	return nil, nil
}

func (f *fakeApps) UpdateStatus(_ context.Context, _ string, status string) (*Application, error) {
	f.updates++
	f.app.Status = status
	c := *f.app
	return &c, nil
}

func (f *fakeApps) FindAll(context.Context, ApplicationFilter) ([]Application, error) { return nil, nil }

type fakeJobs struct {
	job.JobRepository
	j *job.Job
}

func (f *fakeJobs) FindByID(_ context.Context, id string) (*job.Job, error) {
	if f.j != nil && f.j.ID.Hex() == id {
		return f.j, nil
	}
	return nil, nil
}

type fakeUsers struct{ user.UserRepository }

func (fakeUsers) FindUserByID(context.Context, string) (*user.User, error) { return nil, nil }

func setup() (*ApplicationService, *fakeApps, string, string) {
	owner := primitive.NewObjectID()
	j := &job.Job{ID: primitive.NewObjectID(), RecruiterID: owner}
	apps := &fakeApps{app: &Application{ID: primitive.NewObjectID(), JobID: j.ID, RecruiterID: owner, Status: "Applied"}}
	svc := NewApplicationService(apps, &fakeJobs{j: j}, fakeUsers{}, nil, nil)
	return svc, apps, owner.Hex(), j.ID.Hex()
}

func TestOnlyJobOwnerSeesApplicants(t *testing.T) {
	svc, _, owner, jobID := setup()
	stranger := primitive.NewObjectID().Hex()
	if _, err := svc.GetJobApplicationsForOwner(context.Background(), jobID, stranger, false); err != ErrApplicationForbidden {
		t.Fatalf("stranger: got %v, want forbidden", err)
	}
	if _, err := svc.GetJobApplicationsForOwner(context.Background(), jobID, owner, false); err != nil {
		t.Fatalf("owner: %v", err)
	}
	if _, err := svc.GetJobApplicationsForOwner(context.Background(), jobID, stranger, true); err != nil {
		t.Fatalf("admin: %v", err)
	}
	if _, err := svc.GetJobApplicationsForOwner(context.Background(), "not-an-id", owner, false); err != ErrJobNotFound {
		t.Fatalf("bad id: got %v", err)
	}
}

func TestStatusChangeRules(t *testing.T) {
	svc, apps, owner, _ := setup()
	id := apps.app.ID.Hex()
	ctx := context.Background()

	if _, err := svc.UpdateApplicationStatus(ctx, id, "Hired", primitive.NewObjectID().Hex(), false); err != ErrApplicationForbidden {
		t.Fatalf("stranger: got %v", err)
	}
	if _, err := svc.UpdateApplicationStatus(ctx, id, "Promoted", owner, false); err != ErrInvalidStatus {
		t.Fatalf("bad status: got %v", err)
	}
	if apps.updates != 0 {
		t.Fatalf("refused requests wrote %d times", apps.updates)
	}
	got, err := svc.UpdateApplicationStatus(ctx, id, "shortlisted", owner, false)
	if err != nil || got.Status != "Shortlisted" {
		t.Fatalf("owner: %v %+v", err, got)
	}
	// Same stage again: no write, so no second email
	if _, err := svc.UpdateApplicationStatus(ctx, id, "Shortlisted", owner, false); err != nil || apps.updates != 1 {
		t.Fatalf("same stage: err %v, writes %d", err, apps.updates)
	}
}
