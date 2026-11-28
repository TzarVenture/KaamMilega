package interview

import (
	"context"
	"testing"
	"time"
)

func TestSaveFeedbackRejectsBadInputBeforeLookup(t *testing.T) {
	s := &InterviewService{} // no repo: bad input must fail before any lookup
	for _, outcome := range []string{"", "great", "NO SHOW"} {
		if _, err := s.SaveFeedback(context.Background(), "000000000000000000000001", "u", outcome, "", time.Now()); err != ErrFeedbackInvalid {
			t.Errorf("outcome %q: got %v, want ErrFeedbackInvalid", outcome, err)
		}
	}
	long := make([]rune, 501)
	for i := range long {
		long[i] = 'a'
	}
	if _, err := s.SaveFeedback(context.Background(), "x", "u", "good", string(long), time.Now()); err != ErrFeedbackInvalid {
		t.Errorf("long note: got %v", err)
	}
	if _, err := s.SaveFeedback(context.Background(), "not-an-id", "u", "No_Show", "", time.Now()); err != ErrInterviewNotFound {
		t.Errorf("bad id: got %v", err)
	}
}
