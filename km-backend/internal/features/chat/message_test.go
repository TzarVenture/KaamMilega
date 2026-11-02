package chat

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAttachmentRefs(t *testing.T) {
	album := CreateMessageRequest{Attachments: []AttachmentRef{{URL: "/api/files/a"}, {URL: ""}, {URL: "/api/files/b"}}}
	if got := attachmentRefs(album); len(got) != 2 || got[1] != "/api/files/b" {
		t.Fatalf("album refs = %v", got)
	}
	legacy := CreateMessageRequest{AttachmentURL: "/api/files/c"}
	if got := attachmentRefs(legacy); len(got) != 1 || got[0] != "/api/files/c" {
		t.Fatalf("legacy refs = %v", got)
	}
	if got := attachmentRefs(CreateMessageRequest{Content: "hi"}); len(got) != 0 {
		t.Fatalf("text refs = %v", got)
	}
}

func TestLastMessagePreview(t *testing.T) {
	img := Attachment{Type: "image/png", Name: "a.png"}
	pdf := Attachment{Type: "application/pdf", Name: "cv.pdf"}
	cases := []struct {
		content string
		atts    []Attachment
		want    string
	}{
		{"hello", []Attachment{img}, "hello"},
		{"", []Attachment{img}, "Photo"},
		{"", []Attachment{pdf}, "Attachment: cv.pdf"},
		{"", []Attachment{img, img, img}, "3 photos"},
		{"", []Attachment{img, pdf}, "2 files"},
	}
	for _, c := range cases {
		if got := lastMessagePreview(c.content, c.atts); got != c.want {
			t.Errorf("preview(%q, %d files) = %q, want %q", c.content, len(c.atts), got, c.want)
		}
	}
}

func TestReplyPreview(t *testing.T) {
	long := strings.Repeat("क", 250)
	orig := &Message{
		ID:          primitive.NewObjectID(),
		SenderID:    primitive.NewObjectID(),
		Content:     long,
		Attachments: []Attachment{{URL: "/api/files/x", Type: "image/jpeg", Name: "x.jpg"}, {URL: "/api/files/y", Type: "image/jpeg"}},
	}
	p := replyPreview(orig)
	if n := len([]rune(p.Content)); n != 201 {
		t.Errorf("quote length = %d runes, want 200 plus ellipsis", n)
	}
	if p.ThumbURL != "/api/files/x" || p.AttachmentCount != 2 {
		t.Errorf("thumb %q count %d", p.ThumbURL, p.AttachmentCount)
	}

	orig.IsDeleted = true
	if d := replyPreview(orig); !d.IsDeleted || d.Content != "" || d.ThumbURL != "" {
		t.Errorf("deleted quote leaks content: %+v", d)
	}

	legacy := &Message{ID: primitive.NewObjectID(), AttachmentURL: "/api/files/z", AttachmentType: "application/pdf", AttachmentName: "z.pdf"}
	if l := replyPreview(legacy); l.AttachmentName != "z.pdf" || l.ThumbURL != "" || l.AttachmentCount != 1 {
		t.Errorf("legacy quote: %+v", l)
	}
}
