package money

import "testing"

func TestToPaiseRoundsToTheNearestPaisa(t *testing.T) {
	cases := map[float64]int64{19.99: 1999, 0.1 + 0.2: 30, 99: 9900, 1234.5: 123450, 0.29: 29}
	for rupees, want := range cases {
		if got := ToPaise(rupees); got != want {
			t.Errorf("ToPaise(%v) = %d, want %d", rupees, got, want)
		}
	}
}

func TestHasAtMostTwoDecimals(t *testing.T) {
	for _, ok := range []float64{1, 19.99, 100.5} {
		if !HasAtMostTwoDecimals(ok) {
			t.Errorf("%v should be accepted", ok)
		}
	}
	for _, bad := range []float64{1.999, 0.001} {
		if HasAtMostTwoDecimals(bad) {
			t.Errorf("%v should be refused", bad)
		}
	}
}

func TestINRUsesIndianGrouping(t *testing.T) {
	cases := map[int64]string{
		9900:      "₹99",
		9950:      "₹99.50",
		123456789: "₹12,34,567.89",
		10000000:  "₹1,00,000",
		-5000:     "-₹50",
	}
	for paise, want := range cases {
		if got := INR(paise); got != want {
			t.Errorf("INR(%d) = %q, want %q", paise, got, want)
		}
	}
}
