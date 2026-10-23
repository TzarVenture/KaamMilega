package file

import (
	"km-backend/internal/config"
	"km-backend/internal/middleware"

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
	// Register more specific routes first to avoid conflicts
	// Public static file access (from .env FS_URL), with headers that stop uploads running as pages
	app.Static(h.config.FSURL, h.config.FSPath, fiber.Static{
		ModifyResponse: func(c *fiber.Ctx) error {
			setSafeFileHeaders(c)
			return nil
		},
	})

	// Download route (also public)
	app.Get("/api/files/download/:id", h.controller.DownloadFile)

	// Authenticated routes
	app.Post("/api/files/upload", middleware.AuthMiddleware(h.config.JWTSecret), h.controller.UploadFile)
}
