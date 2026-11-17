package user

import (
	"strings"
	"testing"

	"km-backend/internal/common/apperr"
)

func validRequest() ApplyExpertRequest {
	return ApplyExpertRequest{
		ExpertCategory:       "Career Guidance",
		ExpertBio:            strings.Repeat("I help freshers plan their first job search. ", 2),
		ExpertPricing:        499,
		PANNumber:            "abcde1234f",
		PANDocURL:            "/api/files/6ae31639093b7b26c909c17e",
		PayoutMethod:         "bank",
		AccountHolder:        "Ravi Kumar",
		AccountNumber:        "1234 5678 9012",
		ConfirmAccountNumber: "123456789012",
		IFSC:                 "sbin0001234",
	}
}

func TestNormaliseMasksIdentity(t *testing.T) {
	req := validRequest()
	kyc, err := req.normalise()
	if err != nil {
		t.Fatal(err)
	}
	if kyc.AadhaarLast4 != "" || kyc.AadhaarDocURL != "" || kyc.PANMasked != "XXXXX1234X" {
		t.Errorf("identity: aadhaar %q, pan %q (no Aadhaar is collected; the PAN is masked)", kyc.AadhaarLast4, kyc.PANMasked)
	}
	if kyc.AccountNumber != "123456789012" || kyc.AccountLast4 != "9012" || kyc.IFSC != "SBIN0001234" {
		t.Errorf("bank: %q %q %q", kyc.AccountNumber, kyc.AccountLast4, kyc.IFSC)
	}
}

func TestNormaliseRejects(t *testing.T) {
	cases := map[string]func(r *ApplyExpertRequest){
		"EXPERT_CATEGORY_INVALID": func(r *ApplyExpertRequest) { r.ExpertCategory = "Plumbing" },
		"EXPERT_BIO_LENGTH":       func(r *ApplyExpertRequest) { r.ExpertBio = "Short bio" },
		"EXPERT_PRICE_INVALID":    func(r *ApplyExpertRequest) { r.ExpertPricing = 10 },
		"PAN_INVALID":             func(r *ApplyExpertRequest) { r.PANNumber = "ABCD1234F" },
		"KYC_DOCUMENT_REQUIRED":   func(r *ApplyExpertRequest) { r.PANDocURL = "" },
		"BANK_ACCOUNT_MISMATCH":   func(r *ApplyExpertRequest) { r.ConfirmAccountNumber = "123456789013" },
		"IFSC_INVALID":            func(r *ApplyExpertRequest) { r.IFSC = "SBIN1234" },
		"PAYOUT_METHOD_INVALID":   func(r *ApplyExpertRequest) { r.PayoutMethod = "cash" },
		"UPI_INVALID":             func(r *ApplyExpertRequest) { r.PayoutMethod = "upi"; r.UPIID = "not-an-upi" },
		"ACCOUNT_HOLDER_REQUIRED": func(r *ApplyExpertRequest) { r.AccountHolder = " " },
	}
	for code, mutate := range cases {
		req := validRequest()
		mutate(&req)
		if _, err := req.normalise(); apperr.CodeOf(err) != code {
			t.Errorf("%s: got %v", code, err)
		}
	}
}
