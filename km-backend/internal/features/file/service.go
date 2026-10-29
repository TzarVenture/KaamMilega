package file

import (
	"context"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FileService interface {
	GetFile(ctx context.Context, fileID string) (*File, error)
	SaveFile(ctx context.Context, file *File) error
	// CanRead decides who may open a private file
	CanRead(ctx context.Context, file *File, userID string, isAdmin bool) (bool, error)
}

type FileServiceImpl struct {
	FileRepo FileRepository
}

func NewFileService(fileRepo FileRepository) FileService {
	return &FileServiceImpl{
		FileRepo: fileRepo,
	}
}

func (s *FileServiceImpl) GetFile(ctx context.Context, fileID string) (*File, error) {
	return s.FileRepo.Get(ctx, fileID)
}

func (s *FileServiceImpl) SaveFile(ctx context.Context, file *File) error {
	return s.FileRepo.Save(ctx, file)
}

// CanRead: the uploader and admins always; chat files by the conversation's participants; a
// resume by the recruiter it was sent to. KYC and company documents stay owner and admin only.
func (s *FileServiceImpl) CanRead(ctx context.Context, file *File, userID string, isAdmin bool) (bool, error) {
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return false, nil
	}
	if isAdmin || file.UploadedBy == uid {
		return true, nil
	}
	switch file.Kind {
	case "chat":
		return s.FileRepo.IsConversationParticipant(ctx, file.RecordID, uid)
	case "resume":
		return s.FileRepo.IsResumeRecipient(ctx, file.URL, uid)
	}
	return false, nil
}
