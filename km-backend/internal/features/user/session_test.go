package user

import "testing"

func TestIsSignupComplete(t *testing.T) {
	cases := []struct {
		registered bool
		name       string
		want       bool
	}{
		{false, "", false},   // verified the mobile, closed the name step
		{false, "  ", false}, // a blank name is no name
		{true, "", true},
		{false, "Asha Patil", true}, // made before the is_registered flag existed
	}
	for _, c := range cases {
		if got := IsSignupComplete(c.registered, c.name); got != c.want {
			t.Errorf("IsSignupComplete(%v, %q) = %v, want %v", c.registered, c.name, got, c.want)
		}
	}
}
