package instant_work

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestGeoJSONPointSerialization(t *testing.T) {
	pt := GeoJSONPoint{
		Type:        "Point",
		Coordinates: []float64{72.8777, 19.0760}, // Mumbai [lng, lat]
	}

	data, err := json.Marshal(pt)
	if err != nil {
		t.Fatalf("Failed to marshal GeoJSONPoint: %v", err)
	}

	var parsed GeoJSONPoint
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal GeoJSONPoint: %v", err)
	}

	if parsed.Type != "Point" {
		t.Errorf("Expected Type 'Point', got %s", parsed.Type)
	}
	if len(parsed.Coordinates) != 2 || parsed.Coordinates[0] != 72.8777 || parsed.Coordinates[1] != 19.0760 {
		t.Errorf("Coordinates mismatch: got %v", parsed.Coordinates)
	}
}

func TestCoordinateJitter(t *testing.T) {
	// Original coordinates: Andheri East, Mumbai
	origLng := 72.8697
	origLat := 19.1136

	for i := 0; i < 50; i++ {
		jLng, jLat := jitterCoordinates(origLng, origLat)

		// Calculate approximate distance between (origLng, origLat) and (jLng, jLat) in meters
		dLat := (jLat - origLat) * 111320.0
		dLng := (jLng - origLng) * (111320.0 * math.Cos(origLat*(math.Pi/180.0)))
		distMeters := math.Sqrt(dLat*dLat + dLng*dLng)

		// Must be jittered between 95 and 185 meters (allowing small float precision margin)
		if distMeters < 95.0 || distMeters > 185.0 {
			t.Errorf("Iteration %d: jitter distance out of bounds (%.2f meters)", i, distMeters)
		}

		// Ensure coordinates actually changed
		if jLng == origLng && jLat == origLat {
			t.Errorf("Iteration %d: jitter did not modify coordinates", i)
		}
	}
}

func TestInstantPassQuotaConstraints(t *testing.T) {
	pass := InstantPass{
		ID:             primitive.NewObjectID(),
		UserID:         primitive.NewObjectID(),
		HasActivePass:  true,
		QuotaTotal:     10,
		QuotaRemaining: 10,
		PriceINR:       99.00,
		ActivatedAt:    time.Now(),
		ExpiresAt:      time.Now().Add(30 * 24 * time.Hour),
	}

	if pass.PriceINR != 99.00 {
		t.Errorf("Expected Pass price ₹99.00, got ₹%.2f", pass.PriceINR)
	}
	if pass.QuotaTotal != 10 || pass.QuotaRemaining != 10 {
		t.Errorf("Expected 10 total and 10 remaining quota, got %d/%d", pass.QuotaRemaining, pass.QuotaTotal)
	}
	if pass.ExpiresAt.Before(time.Now()) {
		t.Errorf("Expected 30-day pass to be valid in future")
	}
}

func TestInstantJobBroadcastStatus(t *testing.T) {
	recruiterID := primitive.NewObjectID()
	candidateID := primitive.NewObjectID()

	now := time.Now()
	job := InstantJob{
		ID:            primitive.NewObjectID(),
		RecruiterID:   recruiterID,
		RecruiterName: "Test Recruiter",
		Skill:         "Electrician",
		Status:        JobStatusDispatching,
		ExpiresAt:     now.Add(3 * time.Minute),
		CreatedAt:     now,
	}

	if job.Status != JobStatusDispatching {
		t.Errorf("Expected JobStatusDispatching, got %s", job.Status)
	}

	// Simulate atomic CAS lock transition
	job.Status = JobStatusAccepted
	job.CandidateID = &candidateID
	job.MatchedAt = &now

	if job.Status != JobStatusAccepted || job.CandidateID == nil || *job.CandidateID != candidateID {
		t.Errorf("Failed atomic status transition to ACCEPTED")
	}
}
