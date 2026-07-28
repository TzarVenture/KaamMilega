package main

import (
	"context"
	"fmt"
	common_api "km-backend/internal/common/api"
	"km-backend/internal/config"
	"km-backend/internal/database"
	"km-backend/internal/features/application"
	"km-backend/internal/features/chat"
	"km-backend/internal/features/city"
	"km-backend/internal/features/interview"
	"km-backend/internal/features/mentorship"
	"km-backend/internal/features/network"

	"km-backend/internal/features/company"
	"km-backend/internal/features/event"
	"km-backend/internal/features/file"
	"km-backend/internal/features/job"
	"km-backend/internal/features/question"
	"km-backend/internal/features/setting"
	"km-backend/internal/features/skill"
	"km-backend/internal/features/sms"
	"km-backend/internal/features/system"
	"km-backend/internal/features/user"

	"km-backend/internal/logger"
	"km-backend/internal/middleware"
	"log"

	"km-backend/docs" // Import swagger docs

	"github.com/gofiber/fiber/v2"
	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
	"go.uber.org/zap"
)

// NewFiberServer creates a new Fiber app instance
func NewFiberServer() *fiber.App {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// Use custom CORS middleware
	app.Use(middleware.CORSMiddleware())

	return app
}

// AsRoute is a helper function to reduce boilerplate.
// It tags the constructor so Fx knows to add it to the "routes" group.
func AsRoute(f any) any {
	return fx.Annotate(
		f,
		fx.As(new(common_api.Route)),    // Cast to Interface
		fx.ResultTags(`group:"routes"`), // Add to Group
	)
}

// RegisterAllRoutes takes the group "routes" (slice of interfaces)
// and calls Setup() on each one.
func RegisterAllRoutes(app *fiber.App, routes []common_api.Route) {
	log.Printf("Registering %d routes...\n", len(routes))
	for i, route := range routes {
		log.Printf("Setting up route %d: %T\n", i+1, route)
		route.Setup(app)
	}
	log.Println("All routes registered successfully")
}

// RegisterAllRoutesWithAnnotation wraps RegisterAllRoutes with fx annotations
var RegisterAllRoutesWithAnnotation = fx.Annotate(
	RegisterAllRoutes,
	fx.ParamTags(``, `group:"routes"`),
)

// StartServer creates a lifecycle hook to start Fiber in a goroutine
// and shut it down when the app exits.
// StartServer now needs Config to know which port to listen on
func StartServer(lc fx.Lifecycle, app *fiber.App, cfg *config.Config) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go func() {
				port := fmt.Sprintf(":%s", cfg.Port)
				if err := app.Listen(port); err != nil {
					log.Fatalf("Server failed to start: %v", err)
				}
			}()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			return app.Shutdown()
		},
	})
}

// @title           Microservice Demo API
// @version         1.0
// @description     This is a sample server using Fiber, Uber Fx, and GORM.
// @termsOfService  http://swagger.io/terms/

// @contact.name    API Support
// @contact.email   support@swagger.io

// @license.name    Apache 2.0
// @license.url     http://www.apache.org/licenses/LICENSE-2.0.html

// @BasePath        /
func main() {
	app := fx.New(
		fx.Provide(
			// Load Config
			config.LoadConfig,

			// Initialize Logger
			logger.NewLogger,

			// Initialize Fiber Server
			NewFiberServer,

			// Initialize Database
			database.NewDatabase,

			// repositories
			setting.NewSettingRepository,
			file.NewFileRepository,
			user.NewUserRepository,
			skill.NewSkillRepository,
			job.NewJobRepository,
			fx.Annotate(
				application.NewApplicationRepository,
				fx.As(new(application.ApplicationRepository)),
				fx.As(new(job.ApplicationCounter)),
			),
			interview.NewInterviewRepository,
			city.NewCityRepository,
			question.NewQuestionRepository,
			chat.NewRepository,
			network.NewNetworkRepository,
			event.NewEventRepository,
			mentorship.NewMentorshipRepository,

			// Services
			setting.NewSettingService,
			file.NewFileService,
			sms.NewSMSService,
			user.NewUserService,
			skill.NewSkillService,
			job.NewJobService,
			application.NewApplicationService,
			interview.NewInterviewService,
			city.NewCityService,
			company.NewCompanyService,
			chat.NewService,
			network.NewNetworkService,
			event.NewEventService,
			question.NewQuestionService,
			mentorship.NewMentorshipService,

			// controllers
			file.NewFileController,
			sms.NewSMSController,
			setting.NewSettingController,
			user.NewUserController,
			skill.NewSkillController,
			job.NewJobController,
			application.NewApplicationController,
			interview.NewInterviewController,
			city.NewCityController,
			company.NewCompanyController,
			question.NewQuestionController,
			chat.NewController,
			network.NewNetworkController,
			event.NewEventController,
			mentorship.NewMentorshipController,

			// routes
			AsRoute(file.NewFileApi),
			AsRoute(system.NewSwaggerApi),
			AsRoute(sms.NewSMSApi),
			AsRoute(setting.NewSettingApi),
			AsRoute(user.NewUserApi),
			AsRoute(skill.NewSkillApi),
			AsRoute(job.NewJobApi),
			AsRoute(application.NewApplicationApi),
			AsRoute(interview.NewInterviewApi),
			AsRoute(city.NewCityApi),
			AsRoute(company.NewCompanyApi),
			AsRoute(question.NewQuestionApi),
			AsRoute(chat.NewChatApi),
			AsRoute(network.NewNetworkApi),
			AsRoute(event.NewEventApi),
			AsRoute(mentorship.NewMentorshipApi),
		),
		fx.WithLogger(func(log *zap.Logger) fxevent.Logger {
			return &fxevent.ZapLogger{Logger: log}
		}),
		fx.Invoke(
			// Register Routes & Start
			RegisterAllRoutesWithAnnotation,
			StartServer,
			func(cfg *config.Config) {
				log.Printf("[HOST]=%s", cfg.Host)
				docs.SwaggerInfo.Host = cfg.Host
			},
		),
	)

	app.Run()
}
