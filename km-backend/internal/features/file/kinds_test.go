package file

import (
	"testing"

	"km-backend/internal/storage"
)

func TestKindFor(t *testing.T) {
	cases := []struct {
		kind, module, ext string
		want              string
		vis               storage.Visibility
	}{
		{"avatar", "", ".png", "avatar", storage.Public},
		{"resume", "", ".pdf", "resume", storage.Private},
		{"expert_document", "", ".jpg", "expert_document", storage.Private},
		// Older app versions send no kind: documents must never become public
		{"", "chat", ".png", "chat", storage.Private},
		{"", "", ".jpg", "avatar", storage.Public},
		{"", "", ".pdf", "company_document", storage.Private},
	}
	for _, tc := range cases {
		k, err := kindFor(tc.kind, tc.module, tc.ext)
		if err != nil {
			t.Fatalf("kindFor(%q, %q, %q): %v", tc.kind, tc.module, tc.ext, err)
		}
		if k.Name != tc.want || k.Visibility != tc.vis {
			t.Errorf("kindFor(%q, %q, %q) = %s/%s, want %s/%s", tc.kind, tc.module, tc.ext, k.Name, k.Visibility, tc.want, tc.vis)
		}
	}
	if _, err := kindFor("passport", "", ".pdf"); err != errUnknownKind {
		t.Errorf("unknown kind: got %v", err)
	}
}

func TestKindCheck(t *testing.T) {
	avatar, _ := kindFor("avatar", "", ".png")
	if err := avatar.check(".pdf", 1000); err != errKindFileType {
		t.Errorf("PDF as avatar: got %v", err)
	}
	if err := avatar.check(".png", 6<<20); err != errKindTooLarge {
		t.Errorf("6 MB avatar: got %v", err)
	}
	resume, _ := kindFor("resume", "", ".pdf")
	if err := resume.check(".png", 1000); err != errKindFileType {
		t.Errorf("image as resume: got %v", err)
	}
	if err := resume.check(".docx", 1000); err != nil {
		t.Errorf("DOCX resume: got %v", err)
	}
}
