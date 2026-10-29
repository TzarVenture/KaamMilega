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
	// JobAlertsEnabled turns on the daily job-alert emails (JOB_ALERTS_ENABLED=true). Off by
	// default so a dev or staging server never emails real users by accident.
	JobAlertsEnabled bool
	FSURL         string // URL path prefix for file access
	// Media storage: STORAGE_DRIVER=r2 keeps uploads on Cloudflare R2, anything else on local disk
	StorageDriver     string
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2PublicBucket    string
	R2PrivateBucket   string
	R2PublicBaseURL   string
	SMTPHost      string
	SMTPPort      string
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string
	RazorpayKeyID     string
	RazorpayKeySecret string
	// Push notifications (Firebase Cloud Messaging). The service-account key is a server secret:
	// give it as a file path (FIREBASE_CREDENTIALS_FILE) or the JSON itself, raw or base64
	// (FIREBASE_CREDENTIALS_JSON). Without either, push is off and everything else works as before.
	FirebaseProjectID       string
	FirebaseCredentialsFile string
	FirebaseCredentialsJSON string
	// FrontendURL is the website origin used for links inside push notifications
	FrontendURL string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	} else {
		log.Println("Loaded .env file successfully")
	}

	return &Config{
		Port:              getEnv("PORT", "8080"),
		JWTSecret:         getEnv("JWT_SECRET", "secret"),
		MongoURI:          getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:            getEnv("DB_NAME", "km-backend"),
		Environment:       getEnv("ENVIRONMENT", "development"),
		JobAlertsEnabled:  getEnv("JOB_ALERTS_ENABLED", "false") == "true",
		FSPath:            getEnv("FS_PATH", "./static/uploads"),
		FSURL:             getEnv("FS_URL", "/api/files/uploads"),
		Host:              getEnv("HOST", ""),
		StorageDriver:     getEnv("STORAGE_DRIVER", "local"),
		R2AccountID:       getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:     getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey: getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2PublicBucket:    getEnv("R2_PUBLIC_BUCKET", ""),
		R2PrivateBucket:   getEnv("R2_PRIVATE_BUCKET", ""),
		R2PublicBaseURL:   getEnv("R2_PUBLIC_BASE_URL", ""),
		SMTPHost:          getEnv("SMTP_HOST", "smtp-relay.brevo.com"),
		SMTPPort:          getEnv("SMTP_PORT", "587"),
		SMTPUsername:      getEnv("SMTP_USERNAME", getEnv("SMTP_USER", "")),
		SMTPPassword:      getEnv("SMTP_PASSWORD", getEnv("SMTP_PASS", "")),
		SMTPFromEmail:     getEnv("SMTP_FROM_EMAIL", "no-reply@kaammilega.com"),
		SMTPFromName:      getEnv("SMTP_FROM_NAME", "KaamMilega Verification"),
		RazorpayKeyID:     getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret: getEnv("RAZORPAY_KEY_SECRET", ""),
		FirebaseProjectID:       getEnv("FIREBASE_PROJECT_ID", "kaammilega-7a667"),
		FirebaseCredentialsFile: getEnv("FIREBASE_CREDENTIALS_FILE", ""),
		FirebaseCredentialsJSON: getEnv("FIREBASE_CREDENTIALS_JSON", ""),
		FrontendURL:             getEnv("FRONTEND_URL", "https://kaammilega.com"),
	}, nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
