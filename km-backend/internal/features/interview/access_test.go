package interview

import (
	"context"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeInterviews struct {
	InterviewRepository
	iv     *Interview
	writes int
}

func (f *fakeInterviews) FindByID(_ context.Context, id string) (*Interview, error) {
	if f.iv.ID.Hex() == id {
		c := *f.iv
		return &c, nil
	}
	return nil, nil
}

func (f *fakeInterviews) UpdateStatus(_ context.Context, _ string, status string) (*Interview, error) {
	f.writes++
	f.iv.Status = status
	c := *f.iv
	return &c, nil
}

func TestInterviewStatusRules(t *testing.T) {
	owner := primitive.NewObjectID()
	repo := &fakeInterviews{iv: &Interview{ID: primitive.NewObjectID(), RecruiterID: owner, Status: "Scheduled"}}
	svc := &InterviewService{repo: repo}
	ctx, id := context.Background(), repo.iv.ID.Hex()

	if _, err := svc.UpdateInterviewStatus(ctx, id, "Cancelled", primitive.NewObjectID().Hex(), false); err != ErrInterviewForbidden {
		t.Fatalf("stranger: got %v", err)
	}
	if _, err := svc.UpdateInterviewStatus(ctx, id, "Gone", owner.Hex(), false); err != ErrInvalidStatus {
		t.Fatalf("bad status: got %v", err)
	}
	if _, err := svc.UpdateInterviewStatus(ctx, "nope", "Completed", owner.Hex(), false); err != ErrInterviewNotFound {
		t.Fatalf("bad id: got %v", err)
	}
	if repo.writes != 0 {
		t.Fatalf("refused requests wrote %d times", repo.writes)
	}
	if got, err := svc.UpdateInterviewStatus(ctx, id, "completed", owner.Hex(), false); err != nil || got.Status != "Completed" {
		t.Fatalf("owner: %v %+v", err, got)
	}
	if _, err := svc.UpdateInterviewStatus(ctx, id, "Scheduled", primitive.NewObjectID().Hex(), true); err != nil {
		t.Fatalf("admin: %v", err)
	}
}
