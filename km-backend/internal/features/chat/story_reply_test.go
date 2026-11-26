package chat

import (
	"context"
	"errors"
	"testing"

	"km-backend/internal/features/user"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// fakeQuoter quotes the stories it knows, as the story service would for this viewer
type fakeQuoter map[primitive.ObjectID]*StoryQuote

func (f fakeQuoter) QuoteStory(_ context.Context, _, id primitive.ObjectID) (*StoryQuote, error) {
	if q, ok := f[id]; ok {
		return q, nil
	}
	return nil, errors.New("story not found")
}

func TestStoryReply(t *testing.T) {
	recruiter, owner, other := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	users := limitUsers{roles: map[string][]string{
		recruiter.Hex(): {"user", user.RoleRecruiter},
		owner.Hex():     {"user"},
	}}
	ownersStory, othersStory := primitive.NewObjectID(), primitive.NewObjectID()
	quoter := fakeQuoter{
		ownersStory: {ID: ownersStory, OwnerID: owner, MediaType: "image"},
		othersStory: {ID: othersStory, OwnerID: other, MediaType: "image"},
	}
	for _, c := range []struct {
		name    string
		storyID string
		quoter  StoryQuoter
		want    error
	}{
		{"reply to the receiver's story", ownersStory.Hex(), quoter, errGatePassed},
		{"someone else's story", othersStory.Hex(), quoter, ErrStoryUnavailable},
		{"ended or hidden story", primitive.NewObjectID().Hex(), quoter, ErrStoryUnavailable},
		{"not an id", "nope", quoter, ErrStoryUnavailable},
		{"stories not wired", ownersStory.Hex(), nil, ErrStoryUnavailable},
	} {
		t.Run(c.name, func(t *testing.T) {
			svc := NewService(&limitRepo{}, users, nil, &countingQuota{}, c.quoter)
			_, err := svc.SendMessage(context.Background(), recruiter, CreateMessageRequest{ReceiverID: owner, Content: "nice", StoryID: c.storyID})
			if !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
			if c.want == ErrStoryUnavailable && !IsBadRequest(err) {
				t.Fatal("an unavailable story should be a bad request")
			}
		})
	}
}
