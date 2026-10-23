package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"km-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
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
// @Description Upload an image, PDF, Word document or text file (max 10 MB). Requires sign-in.
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "File to upload"
// @Param module_name formData string false "Module Name"
// @Param record_id formData string false "Record ID"
// @Success 201 {object} File
// @Failure 400 {object} map[string]any
// @Failure 401 {object} map[string]any
// @Failure 413 {object} map[string]any
// @Failure 415 {object} map[string]any
// @Failure 500 {object} map[string]any
// @Router /api/files/upload [post]
func (ctrl *FileController) UploadFile(c *fiber.Ctx) error {
	uploader, err := primitive.ObjectIDFromHex(fmt.Sprint(c.Locals("user_id")))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Error retrieving file",
		})
	}

	ext, mimeType, err := validateUpload(fh)
	switch err {
	case nil:
	case errFileTooLarge:
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": err.Error()})
	case errFileType, errFileMismatch:
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{"error": err.Error()})
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	originalName := filepath.Base(fh.Filename)
	uniqueName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), safeName(originalName), ext)
	dstPath := filepath.Join(ctrl.UploadDir, uniqueName)

	if err := c.SaveFile(fh, dstPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error saving file to disk",
		})
	}

	fileRecord := &File{
		OriginalFilename: originalName,
		Path:             dstPath,
		URL:              ctrl.Config.FSURL + "/" + uniqueName,
		Size:             fh.Size,
		MimeType:         mimeType,
		ModuleName:       strings.TrimSpace(c.FormValue("module_name")),
		RecordID:         strings.TrimSpace(c.FormValue("record_id")),
		UploadedBy:       uploader,
		CreatedAt:        time.Now(),
	}

	if err := ctrl.FileService.SaveFile(c.UserContext(), fileRecord); err != nil {
		os.Remove(dstPath)
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

	// Only a bare stored name: anything with a separator or ".." could escape the upload folder
	if fileID != "" && fileID == filepath.Base(fileID) && !strings.Contains(fileID, "..") && !strings.ContainsAny(fileID, `/\`) {
		filePath := filepath.Join(ctrl.UploadDir, fileID)
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			// Unique name format: timestamp_originalName
			originalName := fileID
			if parts := strings.SplitN(fileID, "_", 2); len(parts) > 1 {
				originalName = parts[1]
			}
			setSafeFileHeaders(c)
			return c.Download(filePath, originalName)
		}
	}

	if ctx := c.UserContext(); ctx != nil {
		file, err := ctrl.FileService.GetFile(ctx, fileID)
		if err == nil {
			setSafeFileHeaders(c)
			return c.Download(file.Path, file.OriginalFilename)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "File not found",
	})
}

// setSafeFileHeaders stops an uploaded file from running as a page on the API origin: the
// browser must not guess another type, and a sandboxed CSP blocks scripts in SVG or HTML.
func setSafeFileHeaders(c *fiber.Ctx) {
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox")
	c.Set("Cross-Origin-Resource-Policy", "cross-origin")
}
