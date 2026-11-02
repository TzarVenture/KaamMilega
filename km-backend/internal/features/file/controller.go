package file

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"km-backend/internal/common/apperr"
	"km-backend/internal/config"
	"km-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var (
	errFileNotFound = apperr.New("FILE_NOT_FOUND", "File not found.")
	errFileDenied   = apperr.New("FILE_ACCESS_DENIED", "You don't have access to this file.")
	errStoreFailed  = apperr.New("FILE_STORE_FAILED", "Could not save the file. Please try again.")
)

type FileController struct {
	UploadDir   string
	FileService FileService
	Config      *config.Config
	Storage     storage.Storage
}

func NewFileController(fileService FileService, cfg *config.Config, store storage.Storage) *FileController {
	return &FileController{
		UploadDir:   cfg.FSPath,
		FileService: fileService,
		Config:      cfg,
		Storage:     store,
	}
}

// UploadFile godoc
// @Summary Upload file
// @Description Upload a file for a given purpose (kind). Public kinds (avatar, cover, company_logo, event_image) return a permanent CDN URL; private kinds (resume, company_document, expert_document, chat) return /api/files/{id}, opened through GET /api/files/{id}/link. Requires sign-in.
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "File to upload"
// @Param kind formData string false "avatar | cover | company_logo | event_image | resume | company_document | expert_document | chat"
// @Param module_name formData string false "Module Name"
// @Param record_id formData string false "Record ID (the conversation ID for chat)"
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
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(apperr.Body(err))
	case errFileType, errFileMismatch:
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(apperr.Body(err))
	default:
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}

	moduleName := strings.TrimSpace(c.FormValue("module_name"))
	kind, err := kindFor(c.FormValue("kind"), moduleName, ext)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(err))
	}
	if err := kind.check(ext, fh.Size); err != nil {
		status := fiber.StatusUnsupportedMediaType
		if err == errKindTooLarge {
			status = fiber.StatusRequestEntityTooLarge
		}
		return c.Status(status).JSON(apperr.Body(err))
	}

	body, err := fh.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(apperr.Body(errUnreadableFile))
	}
	defer body.Close()

	// Random keys: nothing guessable, and no personal file names in public URLs
	originalName := filepath.Base(fh.Filename)
	now := time.Now()
	key := fmt.Sprintf("%s/%s/%s/%s%s", kind.Name, uploader.Hex(), now.Format("2006/01"), randomID(), ext)
	downloadName := safeName(originalName) + ext

	if err := ctrl.Storage.Put(c.UserContext(), kind.Visibility, storage.Object{
		Key:          key,
		Body:         body,
		Size:         fh.Size,
		ContentType:  mimeType,
		DownloadName: downloadName,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(errStoreFailed))
	}

	fileRecord := &File{
		ID:               primitive.NewObjectID(),
		OriginalFilename: originalName,
		Kind:             kind.Name,
		Visibility:       string(kind.Visibility),
		Key:              key,
		Size:             fh.Size,
		MimeType:         mimeType,
		ModuleName:       moduleName,
		RecordID:         strings.TrimSpace(c.FormValue("record_id")),
		UploadedBy:       uploader,
		CreatedAt:        now,
	}
	if kind.Visibility == storage.Public {
		fileRecord.URL = ctrl.Storage.PublicURL(key)
	} else {
		fileRecord.URL = PrivateRef(fileRecord.ID)
	}

	if err := ctrl.FileService.SaveFile(c.UserContext(), fileRecord); err != nil {
		ctrl.Storage.Delete(c.UserContext(), kind.Visibility, key)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error saving file metadata",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fileRecord)
}

// FileLink godoc
// @Summary Get a temporary link to a file
// @Description Returns a link to open or download a file. Private files get a signed link valid for 10 minutes, and only for the uploader, admins and the people the file was shared with (chat participants, the recruiter a resume was sent to).
// @Tags files
// @Produce json
// @Param id path string true "File ID"
// @Param download query string false "1 to save the file under its original name instead of opening it"
// @Success 200 {object} map[string]any
// @Failure 403 {object} map[string]any
// @Failure 404 {object} map[string]any
// @Router /api/files/{id}/link [get]
func (ctrl *FileController) FileLink(c *fiber.Ctx) error {
	f, err := ctrl.FileService.GetFile(c.UserContext(), c.Params("id"))
	if err != nil || f == nil || f.Key == "" {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errFileNotFound))
	}

	if f.Visibility == string(storage.Public) {
		return c.JSON(fiber.Map{"url": f.URL})
	}

	userID := fmt.Sprint(c.Locals("user_id"))
	allowed, err := ctrl.FileService.CanRead(c.UserContext(), f, userID, hasRole(c, "admin"))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(errStoreFailed))
	}
	if !allowed {
		return c.Status(fiber.StatusForbidden).JSON(apperr.Body(errFileDenied))
	}

	url, err := ctrl.Storage.SignedURL(c.UserContext(), f.Key, f.OriginalFilename, c.Query("download") == "1", storage.SignedLinkTTL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(apperr.Body(errStoreFailed))
	}
	c.Set("Cache-Control", "no-store")
	return c.JSON(fiber.Map{"url": url, "expires_at": time.Now().Add(storage.SignedLinkTTL)})
}

// DownloadFile godoc
// @Summary Download a file uploaded before cloud storage
// @Description Serves files saved on the API server's disk by older versions (public access, by unique file name). New files use their CDN URL or GET /api/files/{id}/link.
// @Tags files
// @Param id path string true "Unique file name"
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

	return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errFileNotFound))
}

// ServeLocalPrivate serves a private file in development, only with a valid signed link
func (ctrl *FileController) ServeLocalPrivate(c *fiber.Ctx) error {
	local, ok := storage.AsLocal(ctrl.Storage)
	key := c.Params("*")
	if !ok || !local.Verify(key, c.Query("exp"), c.Query("sig")) {
		return c.Status(fiber.StatusForbidden).JSON(apperr.Body(errFileDenied))
	}
	p, err := local.Path(storage.Private, key)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(apperr.Body(errFileNotFound))
	}
	setSafeFileHeaders(c)
	c.Set("Cache-Control", "private, no-store")
	if name := c.Query("name"); name != "" {
		kind := "inline"
		if c.Query("dl") == "1" {
			kind = "attachment"
		}
		c.Set(fiber.HeaderContentDisposition, mime.FormatMediaType(kind, map[string]string{"filename": name}))
	}
	return c.SendFile(p)
}

// setSafeFileHeaders stops an uploaded file from running as a page on the API origin: the
// browser must not guess another type, and a sandboxed CSP blocks scripts in SVG or HTML.
func setSafeFileHeaders(c *fiber.Ctx) {
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox")
	c.Set("Cross-Origin-Resource-Policy", "cross-origin")
}

// PrivateRef is what records store for a private file: the frontend swaps it for a signed link
func PrivateRef(id primitive.ObjectID) string {
	return "/api/files/" + id.Hex()
}

func randomID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hasRole(c *fiber.Ctx, role string) bool {
	switch v := c.Locals("roles").(type) {
	case []string:
		for _, r := range v {
			if r == role {
				return true
			}
		}
	case []interface{}:
		for _, r := range v {
			if s, ok := r.(string); ok && s == role {
				return true
			}
		}
	}
	return false
}
