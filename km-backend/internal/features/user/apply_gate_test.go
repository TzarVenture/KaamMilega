package user

import "testing"

// A new account (name, mobile, city) is Basic; the four details the apply form asks for
// (role, skills, experience, education) reach Professional, which unlocks applying.
func TestApplyingUnlocksAtProfessionalTier(t *testing.T) {
	u := &User{Name: "Rahul Sharma", Mobile: "9876543210", City: "Pune"}
	if got := CalculateProfileCompletion(u).Score; got != BasicTierScore {
		t.Fatalf("new account score = %d, want %d", got, BasicTierScore)
	}
	if CanApplyForJobs(u) {
		t.Fatal("a new account should not be able to apply yet")
	}

	u.Headline = "Electrician"
	u.Skills = []string{"Wiring", "Panel fitting"}
	u.WorkExperience = "Fresher"
	if CanApplyForJobs(u) {
		t.Fatal("role, skills and experience alone are 60%, below the apply tier")
	}

	u.EducationLevel = "12th pass"
	if got := CalculateProfileCompletion(u).Score; got != ProfessionalTierScore {
		t.Fatalf("score after the apply form = %d, want %d", got, ProfessionalTierScore)
	}
	if !CanApplyForJobs(u) {
		t.Fatal("the apply form's details should unlock applying")
	}

	if CanApplyForJobs(nil) {
		t.Fatal("no user cannot apply")
	}
}
