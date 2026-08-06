package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	JWTSecret     string
	MongoURI      string
	DBName        string
	Host          string
	Environment   string
	FSPath        string // Physical directory for file uploads
	FSURL         string // URL path prefix for file access
	SMTPHost      string
	SMTPPort      string
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	} else {
		log.Println("Loaded .env file successfully")
	}

	return &Config{
		Port:          getEnv("PORT", "8080"),
		JWTSecret:     getEnv("JWT_SECRET", "secret"),
		MongoURI:      getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:        getEnv("DB_NAME", "km-backend"),
		Environment:   getEnv("ENVIRONMENT", "development"),
		FSPath:        getEnv("FS_PATH", "./static/uploads"),
		FSURL:         getEnv("FS_URL", "/api/files/uploads"),
		Host:          getEnv("HOST", ""),
		SMTPHost:      getEnv("SMTP_HOST", "smtp-relay.brevo.com"),
		SMTPPort:      getEnv("SMTP_PORT", "587"),
		SMTPUsername:  getEnv("SMTP_USERNAME", getEnv("SMTP_USER", "")),
		SMTPPassword:  getEnv("SMTP_PASSWORD", getEnv("SMTP_PASS", "")),
		SMTPFromEmail: getEnv("SMTP_FROM_EMAIL", "no-reply@kaammilega.com"),
		SMTPFromName:  getEnv("SMTP_FROM_NAME", "KaamMilega Verification"),
	}, nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
