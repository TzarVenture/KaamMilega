package course

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"km-backend/internal/config"
)

type CourseController struct {
	service CourseService
	cfg     *config.Config
}

func NewCourseController(service CourseService, cfg *config.Config) *CourseController {
	return &CourseController{
		service: service,
		cfg:     cfg,
	}
}

func (ctrl *CourseController) CreateCourse(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateCourseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	created, err := ctrl.service.CreateCourse(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

func (ctrl *CourseController) GetCourses(c *fiber.Ctx) error {
	search := c.Query("search", "")
	category := c.Query("category", "")
	expertID := c.Query("expert_id", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	filter := CourseFilter{
		Search:   search,
		Category: category,
		ExpertID: expertID,
		Page:     page,
		Limit:    limit,
	}

	resp, err := ctrl.service.GetCourses(c.Context(), filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (ctrl *CourseController) GetMyCourses(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	resp, err := ctrl.service.GetMyCourses(c.Context(), userID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (ctrl *CourseController) GetCourse(c *fiber.Ctx) error {
	id := c.Params("id")
	course, err := ctrl.service.GetCourse(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(course)
}

func (ctrl *CourseController) RecordView(c *fiber.Ctx) error {
	id := c.Params("id")

	// Determine viewer ID if user is logged in
	viewerID := ""
	if uid, ok := c.Locals("user_id").(string); ok && uid != "" {
		viewerID = uid
	} else {
		// Optional: parse token from Authorization header or cookie without hard failing
		tokenString := ""
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if tokenString == "" {
			tokenString = c.Cookies("km_auth_token")
		}
		if tokenString != "" {
			token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
				return []byte(ctrl.cfg.JWTSecret), nil
			})
			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					if sub, ok := claims["sub"].(string); ok {
						viewerID = sub
					}
				}
			}
		}
	}

	views, err := ctrl.service.RecordView(c.Context(), id, viewerID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "View recorded",
		"views":   views,
	})
}

func (ctrl *CourseController) UpdateCourse(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	var req UpdateCourseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updated, err := ctrl.service.UpdateCourse(c.Context(), id, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updated)
}

func (ctrl *CourseController) DeleteCourse(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	if err := ctrl.service.DeleteCourse(c.Context(), id, userID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Course deleted successfully"})
}
