package user

import (
	"context"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/database"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Saved candidates: an employer's private shortlist of job seekers to come back to. Only people
// talent search can show are saved or listed, so a profile that goes private or closes drops
// out of the list by itself.

// SavedCandidatesMax is how many people one employer can keep saved
const SavedCandidatesMax = 1000

var (
	ErrCandidateNotFound = apperr.New("CANDIDATE_NOT_FOUND", "this person can't be saved: the profile is private, closed or not a job seeker")
	ErrSavedListFull     = apperr.New("SAVED_LIST_FULL", "you can save up to 1000 people; remove some first")
)

// savedCandidate is one saved person
type savedCandidate struct {
	RecruiterID primitive.ObjectID `bson:"recruiter_id"`
	CandidateID primitive.ObjectID `bson:"candidate_id"`
	CreatedAt   time.Time          `bson:"created_at"`
}

func savedIndexes() []mongo.IndexModel {
	return []mongo.IndexModel{
		{Keys: bson.D{{Key: "recruiter_id", Value: 1}, {Key: "candidate_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "recruiter_id", Value: 1}, {Key: "created_at", Value: -1}}},
	}
}

func (a *TalentApi) setupSaved(app *fiber.App, guard ...fiber.Handler) {
	at := func(h fiber.Handler) []fiber.Handler { return append(append([]fiber.Handler{}, guard...), h) }
	database.SyncIndexesInBackground(a.saved, savedIndexes())
	app.Get("/api/recruiter/saved", at(a.listSaved)...)
	app.Get("/api/recruiter/saved/ids", at(a.savedIDs)...)
	app.Put("/api/recruiter/saved/:id", at(a.save)...)
	app.Delete("/api/recruiter/saved/:id", at(a.unsave)...)
}

// eligible keeps the ids talent search could show to this employer
func (a *TalentApi) eligible(ctx context.Context, me primitive.ObjectID, ids []primitive.ObjectID, withCards bool) (map[primitive.ObjectID]*User, error) {
	out := make(map[primitive.ObjectID]*User, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	filter := talentQuery(TalentFilter{}, me)
	filter["$and"] = append(filter["$and"].([]bson.M), bson.M{"_id": bson.M{"$in": ids}})
	proj := bson.M{"_id": 1}
	if withCards {
		proj = bson.M{
			"name": 1, "username": 1, "headline": 1, "profile_image": 1, "city": 1, "skills": 1,
			"experience": 1, "open_to_work": 1, "resume_shared": 1, "verification_status": 1,
		}
	}
	cur, err := a.coll.Find(ctx, filter, options.Find().SetProjection(proj))
	if err != nil {
		return nil, err
	}
	var users []User
	if err := cur.All(ctx, &users); err != nil {
		return nil, err
	}
	for i := range users {
		out[users[i].ID] = &users[i]
	}
	return out, nil
}

// savedList is the employer's saved people, newest first, that can still be shown
func (a *TalentApi) savedList(ctx context.Context, me primitive.ObjectID, withCards bool) ([]primitive.ObjectID, map[primitive.ObjectID]*User, error) {
	cur, err := a.saved.Find(ctx, bson.M{"recruiter_id": me},
		options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(SavedCandidatesMax).SetProjection(bson.M{"candidate_id": 1}))
	if err != nil {
		return nil, nil, err
	}
	var rows []savedCandidate
	if err := cur.All(ctx, &rows); err != nil {
		return nil, nil, err
	}
	ids := make([]primitive.ObjectID, len(rows))
	for i, r := range rows {
		ids[i] = r.CandidateID
	}
	found, err := a.eligible(ctx, me, ids, withCards)
	if err != nil {
		return nil, nil, err
	}
	kept := ids[:0]
	for _, id := range ids {
		if found[id] != nil {
			kept = append(kept, id)
		}
	}
	return kept, found, nil
}

func savedOwner(c *fiber.Ctx) primitive.ObjectID {
	s, _ := c.Locals("user_id").(string)
	id, _ := primitive.ObjectIDFromHex(s)
	return id
}

// GET /api/recruiter/saved: one page of saved people, as talent cards
func (a *TalentApi) listSaved(c *fiber.Ctx) error {
	page, limit := c.QueryInt("page", 1), c.QueryInt("limit", 20)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	ids, users, err := a.savedList(ctx, savedOwner(c), true)
	if err != nil {
		return apperr.Respond(c, err)
	}
	out := &TalentPage{Items: []TalentCard{}, Total: int64(len(ids)), Page: page, Limit: limit}
	for i := (page - 1) * limit; i < len(ids) && i < page*limit; i++ {
		out.Items = append(out.Items, talentCard(users[ids[i]]))
	}
	return c.JSON(out)
}

// GET /api/recruiter/saved/ids: who is saved, so search results can show it
func (a *TalentApi) savedIDs(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	ids, _, err := a.savedList(ctx, savedOwner(c), false)
	if err != nil {
		return apperr.Respond(c, err)
	}
	hex := make([]string, len(ids))
	for i, id := range ids {
		hex[i] = id.Hex()
	}
	return c.JSON(fiber.Map{"ids": hex})
}

// PUT /api/recruiter/saved/:id saves a job seeker (saving twice is fine)
func (a *TalentApi) save(c *fiber.Ctx) error {
	cand, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return apperr.Respond(c, ErrCandidateNotFound)
	}
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	mine := savedOwner(c)
	ok, err := a.eligible(ctx, mine, []primitive.ObjectID{cand}, false)
	if err != nil {
		return apperr.Respond(c, err)
	}
	if ok[cand] == nil {
		return apperr.Respond(c, ErrCandidateNotFound)
	}
	n, err := a.saved.CountDocuments(ctx, bson.M{"recruiter_id": mine})
	if err != nil {
		return apperr.Respond(c, err)
	}
	filter := bson.M{"recruiter_id": mine, "candidate_id": cand}
	if n >= SavedCandidatesMax {
		// Already saved is still fine when the list is full
		if have, _ := a.saved.CountDocuments(ctx, filter); have == 0 {
			return apperr.Respond(c, ErrSavedListFull)
		}
		return c.JSON(fiber.Map{"saved": true})
	}
	_, err = a.saved.UpdateOne(ctx, filter, bson.M{"$setOnInsert": bson.M{"created_at": time.Now()}}, options.Update().SetUpsert(true))
	if err != nil && !mongo.IsDuplicateKeyError(err) {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"saved": true})
}

// DELETE /api/recruiter/saved/:id removes someone from the list
func (a *TalentApi) unsave(c *fiber.Ctx) error {
	cand, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return apperr.Respond(c, ErrCandidateNotFound)
	}
	if _, err := a.saved.DeleteOne(c.Context(), bson.M{"recruiter_id": savedOwner(c), "candidate_id": cand}); err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(fiber.Map{"saved": false})
}
