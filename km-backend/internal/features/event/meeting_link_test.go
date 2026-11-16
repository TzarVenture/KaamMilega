package event

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestHideMeetingLink(t *testing.T) {
	host := primitive.NewObjectID()
	cases := []struct {
		name   string
		viewer string
		want   string
	}{
		{"signed out", "", ""},
		{"someone else", primitive.NewObjectID().Hex(), ""},
		{"the host", host.Hex(), "https://meet.google.com/abc-defg-hij"},
	}
	for _, tc := range cases {
		e := &Event{OrganizerID: host, MeetingLink: "https://meet.google.com/abc-defg-hij"}
		hideMeetingLink(e, tc.viewer)
		if e.MeetingLink != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, e.MeetingLink, tc.want)
		}
	}
}

func TestValidateMeetingLink(t *testing.T) {
	ok := []string{"", "https://meet.google.com/abc-defg-hij", "https://us02web.zoom.us/j/123456"}
	bad := []string{"meet.google.com/abc", "http://zoom.us/j/1", "javascript:alert(1)", "https://"}
	for _, l := range ok {
		if err := validateMeetingLink(l); err != nil {
			t.Errorf("%q should be accepted: %v", l, err)
		}
	}
	for _, l := range bad {
		if err := validateMeetingLink(l); err == nil {
			t.Errorf("%q should be rejected", l)
		}
	}
}
