package user

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/apperr"
	"km-backend/internal/database"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Reply templates: an employer's saved messages ("Shortlisted, please come on Monday") that
// they send to applicants in one tap. {name} and {job} are filled in when the message is sent.
// Sending goes through the normal chat, so blocks, notifications and plan rules still apply.

const (
	ReplyTemplatesMax  = 30
	replyTitleMaxChars = 60
	replyBodyMaxChars  = 1000
)

var (
	ErrTemplateNotFound = apperr.New("TEMPLATE_NOT_FOUND", "this template doesn't exist")
	ErrTemplateInvalid  = apperr.New("TEMPLATE_INVALID", "give the template a title (up to 60 characters) and a message (up to 1000 characters)")
	ErrTemplatesFull    = apperr.New("TEMPLATES_FULL", "you can keep up to 30 templates; delete some first")
)

// ReplyTemplate is one saved message
type ReplyTemplate struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RecruiterID primitive.ObjectID `bson:"recruiter_id" json:"-"`
	Title       string             `bson:"title" json:"title"`
	Body        string             `bson:"body" json:"body"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type replyTemplateInput struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// clean trims the input and checks its length
func (in replyTemplateInput) clean() (replyTemplateInput, error) {
	in.Title, in.Body = strings.TrimSpace(in.Title), strings.TrimSpace(in.Body)
	if in.Title == "" || in.Body == "" ||
		utf8.RuneCountInString(in.Title) > replyTitleMaxChars || utf8.RuneCountInString(in.Body) > replyBodyMaxChars {
		return in, ErrTemplateInvalid
	}
	return in, nil
}

func (a *TalentApi) setupTemplates(app *fiber.App, guard ...fiber.Handler) {
	at := func(h fiber.Handler) []fiber.Handler { return append(append([]fiber.Handler{}, guard...), h) }
	database.SyncIndexesInBackground(a.templates, []mongo.IndexModel{
		{Keys: bson.D{{Key: "recruiter_id", Value: 1}, {Key: "updated_at", Value: -1}}},
	})
	app.Get("/api/recruiter/templates", at(a.listTemplates)...)
	app.Post("/api/recruiter/templates", at(a.createTemplate)...)
	app.Put("/api/recruiter/templates/:id", at(a.updateTemplate)...)
	app.Delete("/api/recruiter/templates/:id", at(a.deleteTemplate)...)
}

func (a *TalentApi) listTemplates(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	cur, err := a.templates.Find(ctx, bson.M{"recruiter_id": savedOwner(c)},
		options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}}).SetLimit(ReplyTemplatesMax))
	if err != nil {
		return apperr.Respond(c, err)
	}
	out := []ReplyTemplate{}
	if err := cur.All(ctx, &out); err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(out)
}

func (a *TalentApi) createTemplate(c *fiber.Ctx) error {
	var in replyTemplateInput
	if err := c.BodyParser(&in); err != nil {
		return apperr.Respond(c, ErrTemplateInvalid)
	}
	in, err := in.clean()
	if err != nil {
		return apperr.Respond(c, err)
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	me := savedOwner(c)
	n, err := a.templates.CountDocuments(ctx, bson.M{"recruiter_id": me})
	if err != nil {
		return apperr.Respond(c, err)
	}
	if n >= ReplyTemplatesMax {
		return apperr.Respond(c, ErrTemplatesFull)
	}
	now := time.Now()
	t := ReplyTemplate{RecruiterID: me, Title: in.Title, Body: in.Body, CreatedAt: now, UpdatedAt: now}
	res, err := a.templates.InsertOne(ctx, t)
	if err != nil {
		return apperr.Respond(c, err)
	}
	t.ID, _ = res.InsertedID.(primitive.ObjectID)
	return c.Status(fiber.StatusCreated).JSON(t)
}

func (a *TalentApi) updateTemplate(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return apperr.Respond(c, ErrTemplateNotFound)
	}
	var in replyTemplateInput
	if err := c.BodyParser(&in); err != nil {
		return apperr.Respond(c, ErrTemplateInvalid)
	}
	if in, err = in.clean(); err != nil {
		return apperr.Respond(c, err)
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	var t ReplyTemplate
	err = a.templates.FindOneAndUpdate(ctx,
		bson.M{"_id": id, "recruiter_id": savedOwner(c)},
		bson.M{"$set": bson.M{"title": in.Title, "body": in.Body, "updated_at": time.Now()}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&t)
	if err == mongo.ErrNoDocuments {
		return apperr.Respond(c, ErrTemplateNotFound)
	}
	if err != nil {
		return apperr.Respond(c, err)
	}
	return c.JSON(t)
}

func (a *TalentApi) deleteTemplate(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return apperr.Respond(c, ErrTemplateNotFound)
	}
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()
	res, err := a.templates.DeleteOne(ctx, bson.M{"_id": id, "recruiter_id": savedOwner(c)})
	if err != nil {
		return apperr.Respond(c, err)
	}
	if res.DeletedCount == 0 {
		return apperr.Respond(c, ErrTemplateNotFound)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
