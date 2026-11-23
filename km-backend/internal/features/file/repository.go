package file

import (
	"context"

	"km-backend/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type FileRepository interface {
	Save(ctx context.Context, file *File) error
	Get(ctx context.Context, id string) (*File, error)
	CountByRecord(ctx context.Context, moduleName, recordID string) (int64, error)
	IsConversationParticipant(ctx context.Context, conversationID string, userID primitive.ObjectID) (bool, error)
	IsResumeRecipient(ctx context.Context, fileURL string, recruiterID primitive.ObjectID) (bool, error)
}

type FileRepositoryImpl struct {
	db *database.MongodbDB
}

func NewFileRepository(mongodb *database.MongodbDB) FileRepository {
	database.SyncIndexesInBackground(mongodb.DB.Collection("files"), []mongo.IndexModel{
		{Keys: bson.D{{Key: "module_name", Value: 1}, {Key: "record_id", Value: 1}}}, // files attached to a record
		{Keys: bson.D{{Key: "url", Value: 1}}},                                          // account deletion finds files by link
	})
	return &FileRepositoryImpl{
		db: mongodb,
	}
}

func (r *FileRepositoryImpl) getCollection(ctx context.Context) (*mongo.Collection, error) {
	return r.db.DB.Collection("files"), nil
}

func (r *FileRepositoryImpl) Save(ctx context.Context, file *File) error {
	coll, err := r.getCollection(ctx)
	if err != nil {
		return err
	}

	if file.ID.IsZero() {
		file.ID = primitive.NewObjectID()
	}

	_, err = coll.InsertOne(ctx, file)
	return err
}

func (r *FileRepositoryImpl) Get(ctx context.Context, id string) (*File, error) {
	coll, err := r.getCollection(ctx)
	if err != nil {
		return nil, err
	}

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var file File
	err = coll.FindOne(ctx, bson.M{"_id": oid}).Decode(&file)
	return &file, err
}


func (r *FileRepositoryImpl) CountByRecord(ctx context.Context, moduleName, recordID string) (int64, error) {
	coll, err := r.getCollection(ctx)
	if err != nil {
		return 0, err
	}

	filter := bson.M{
		"module_name": moduleName,
		"record_id":   recordID,
	}
	return coll.CountDocuments(ctx, filter)
}

// IsConversationParticipant reports whether the user is in the chat a file was sent to
func (r *FileRepositoryImpl) IsConversationParticipant(ctx context.Context, conversationID string, userID primitive.ObjectID) (bool, error) {
	oid, err := primitive.ObjectIDFromHex(conversationID)
	if err != nil {
		return false, nil
	}
	n, err := r.db.DB.Collection("conversations").CountDocuments(ctx, bson.M{"_id": oid, "participants": userID})
	return n > 0, err
}

// IsResumeRecipient reports whether the recruiter received this resume with an application, or
// downloaded it from the candidate's profile while the candidate shares it
func (r *FileRepositoryImpl) IsResumeRecipient(ctx context.Context, fileURL string, recruiterID primitive.ObjectID) (bool, error) {
	n, err := r.db.DB.Collection("applications").CountDocuments(ctx, bson.M{"resume_url": fileURL, "recruiter_id": recruiterID})
	if err != nil || n > 0 {
		return n > 0, err
	}
	n, err = r.db.DB.Collection("resume_unlocks").CountDocuments(ctx, bson.M{"resume_url": fileURL, "recruiter_id": recruiterID})
	if err != nil || n == 0 {
		return false, err
	}
	n, err = r.db.DB.Collection("users").CountDocuments(ctx, bson.M{"resume.url": fileURL, "resume_shared": true})
	return n > 0, err
}
