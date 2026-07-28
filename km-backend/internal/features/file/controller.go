package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

type FileController struct {
	UploadDir   string
	FileService FileService
	Config      *config.Config
}

func NewFileController(fileService FileService, cfg *config.Config) *FileController {
	if _, err := os.Stat(cfg.FSPath); os.IsNotExist(err) {
		os.MkdirAll(cfg.FSPath, 0755)
	}
	return &FileController{
		UploadDir:   cfg.FSPath,
		FileService: fileService,
		Config:      cfg,
	}
}

// UploadFile godoc
// @Summary Upload file
// @Description Upload a file associated with a module and record
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "File to upload"
// @Param module_name formData string true "Module Name"
// @Param record_id formData string true "Record ID"
// @Param description formData string false "File Description"
// @Param is_shared formData boolean false "Shared status"
// @Success 201 {object} File
// @Failure 400 {object} map[string]any
// @Failure 401 {object} map[string]any
// @Failure 500 {object} map[string]any
// @Router /api/files/upload [post]
func (ctrl *FileController) UploadFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Error retrieving file",
		})
	}

	originalName := filepath.Base(file.Filename)
	timestamp := time.Now().UnixNano()
	uniqueName := fmt.Sprintf("%d_%s", timestamp, originalName)
	uniqueName = strings.ReplaceAll(uniqueName, " ", "_")

	dstPath := filepath.Join(ctrl.UploadDir, uniqueName)

	if err := c.SaveFile(file, dstPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error saving file to disk",
		})
	}

	fileRecord := &File{
		OriginalFilename: originalName,
		Path:             dstPath,
		URL:              ctrl.Config.FSURL + "/" + uniqueName,
		Size:             file.Size,
		MimeType:         file.Header.Get("Content-Type"),
		CreatedAt:        time.Now(),
	}

	if err := ctrl.FileService.SaveFile(c.UserContext(), fileRecord); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error saving file metadata",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fileRecord)
}

// DownloadFile godoc
// @Summary Download file
// @Description Download a file by ID or unique filename (public access)
// @Tags files
// @Param id path string true "File ID or unique name"
// @Success 200 {file} file "File content"
// @Failure 404 {object} map[string]any
// @Router /api/files/download/{id} [get]
func (ctrl *FileController) DownloadFile(c *fiber.Ctx) error {
	fileID := c.Params("id")

	// Try to serve directly from disk first if it matches the pattern (unique name)
	// This allows public access without tenant context/auth
	filePath := filepath.Join(ctrl.UploadDir, fileID)
	if _, err := os.Stat(filePath); err == nil {
		// Extract original filename from unique name if possible
		// Unique name format: timestamp_originalName
		originalName := fileID
		if parts := strings.SplitN(fileID, "_", 2); len(parts) > 1 {
			originalName = parts[1]
		}
		return c.Download(filePath, originalName)
	}

	// Fallback to DB lookup if fileID is an ObjectID
	// Note: This will only work if tenant context is present (from Auth)
	// We wrap in a check to avoid panics if context is missing
	if ctx := c.UserContext(); ctx != nil {
		file, err := ctrl.FileService.GetFile(ctx, fileID)
		if err == nil {
			return c.Download(file.Path, file.OriginalFilename)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "File not found",
	})
}
