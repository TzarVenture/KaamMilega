package file

import (
	"context"
)

type FileService interface {
	GetFile(ctx context.Context, fileID string) (*File, error)
	SaveFile(ctx context.Context, file *File) error
}

type FileServiceImpl struct {
	FileRepo     FileRepository
}

func NewFileService(fileRepo FileRepository) FileService {
	return &FileServiceImpl{
		FileRepo:     fileRepo,
	}
}


func (s *FileServiceImpl) GetFile(ctx context.Context, fileID string) (*File, error) {
	return s.FileRepo.Get(ctx, fileID)
}

func (s *FileServiceImpl) SaveFile(ctx context.Context, file *File) error {
	return s.FileRepo.Save(ctx, file)
}