// Package money holds the one conversion between rupees (what the API speaks) and paise (what
// the database stores). Money is never added up as a decimal: ₹19.99 is not exact in a float.
package money

import (
	"fmt"
	"math"
	"strconv"
)

// ToPaise converts rupees to paise, rounding to the nearest paisa.
func ToPaise(rupees float64) int64 {
	return int64(math.Round(rupees * 100))
}

// ToRupees converts paise to rupees for API responses.
func ToRupees(paise int64) float64 {
	return float64(paise) / 100
}

// HasAtMostTwoDecimals reports whether an amount typed in rupees is a whole number of paise.
func HasAtMostTwoDecimals(rupees float64) bool {
	return math.Abs(rupees*100-math.Round(rupees*100)) < 1e-6
}

// INR formats paise for messages using Indian digit grouping: ₹1,25,000 or ₹99.50.
func INR(paise int64) string {
	sign := ""
	if paise < 0 {
		sign = "-"
		paise = -paise
	}
	whole := strconv.FormatInt(paise/100, 10)
	if len(whole) > 3 {
		head, tail := whole[:len(whole)-3], whole[len(whole)-3:]
		grouped := ""
		for len(head) > 2 {
			grouped = "," + head[len(head)-2:] + grouped
			head = head[:len(head)-2]
		}
		whole = head + grouped + "," + tail
	}
	if rest := paise % 100; rest != 0 {
		return fmt.Sprintf("%s₹%s.%02d", sign, whole, rest)
	}
	return sign + "₹" + whole
}
