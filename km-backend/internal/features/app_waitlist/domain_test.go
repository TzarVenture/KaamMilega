package app_waitlist

import "testing"

func TestNormalize(t *testing.T) {
	cases := []struct {
		name     string
		req      JoinRequest
		mobile   string
		interest string
		err      error
	}{
		{"plain", JoinRequest{Mobile: "9876543210", Interest: "work"}, "9876543210", "work", nil},
		{"country code and spaces", JoinRequest{Mobile: "+91 98765 43210", Interest: "Hire"}, "9876543210", "hire", nil},
		{"too short", JoinRequest{Mobile: "98765", Interest: "work"}, "", "", ErrInvalidMobile},
		{"not a mobile prefix", JoinRequest{Mobile: "1234567890", Interest: "work"}, "", "", ErrInvalidMobile},
		{"missing interest", JoinRequest{Mobile: "9876543210"}, "", "", ErrInvalidInterest},
		{"unknown interest", JoinRequest{Mobile: "9876543210", Interest: "earn"}, "", "", ErrInvalidInterest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, err := tc.req.Normalize()
			if err != tc.err {
				t.Fatalf("err = %v, want %v", err, tc.err)
			}
			if err == nil && (e.Mobile != tc.mobile || e.Interest != tc.interest) {
				t.Fatalf("got %s/%s, want %s/%s", e.Mobile, e.Interest, tc.mobile, tc.interest)
			}
		})
	}
}

func TestNormalizeTrimsTrade(t *testing.T) {
	long := ""
	for i := 0; i < 100; i++ {
		long += "a"
	}
	e, err := JoinRequest{Mobile: "9876543210", Interest: "work", Trade: "  " + long}.Normalize()
	if err != nil {
		t.Fatal(err)
	}
	if len(e.Trade) != maxTradeLength {
		t.Fatalf("trade length = %d, want %d", len(e.Trade), maxTradeLength)
	}
}
