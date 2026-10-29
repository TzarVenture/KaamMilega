package file

import (
	"path/filepath"

	"km-backend/internal/config"
	"km-backend/internal/middleware"
	"km-backend/internal/storage"

	"github.com/gofiber/fiber/v2"
)

type FileApi struct {
	controller *FileController
	config     *config.Config
}

func NewFileApi(controller *FileController, config *config.Config) *FileApi {
	return &FileApi{
		controller: controller,
		config:     config,
	}
}

func (h *FileApi) Setup(app *fiber.App) {
	safeHeaders := fiber.Static{
		ModifyResponse: func(c *fiber.Ctx) error {
			setSafeFileHeaders(c)
			return nil
		},
	}

	// Files saved on the server's disk before cloud storage (from .env FS_URL)
	app.Static(h.config.FSURL, h.config.FSPath, safeHeaders)
	app.Get("/api/files/download/:id", h.controller.DownloadFile)

	// Local storage driver (development): public media, and private files behind signed links
	if _, ok := storage.AsLocal(h.controller.Storage); ok {
		root := filepath.Join(filepath.Dir(h.config.FSPath), "media")
		app.Static(storage.LocalPublicPrefix, filepath.Join(root, string(storage.Public)), safeHeaders)
		app.Get(storage.LocalPrivatePrefix+"/*", h.controller.ServeLocalPrivate)
	}

	// Authenticated routes
	auth := middleware.AuthMiddleware(h.config.JWTSecret)
	app.Post("/api/files/upload", auth, h.controller.UploadFile)
	app.Get("/api/files/:id/link", auth, h.controller.FileLink)
}
