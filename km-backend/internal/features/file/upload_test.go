package file

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"
)

func header(t *testing.T, name string, body []byte) *multipart.FileHeader {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, _ := w.CreateFormFile("file", name)
	part.Write(body)
	w.Close()
	req := httptest.NewRequest("POST", "/", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if err := req.ParseMultipartForm(32 << 20); err != nil {
		t.Fatal(err)
	}
	return req.MultipartForm.File["file"][0]
}

func TestValidateUpload(t *testing.T) {
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
	pdf := []byte("%PDF-1.7\n1 0 obj\n")
	cases := []struct {
		name string
		body []byte
		want error
		mime string
	}{
		{"photo.PNG", png, nil, "image/png"},
		{"cv.pdf", pdf, nil, "application/pdf"},
		{"logo.svg", []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`), nil, "image/svg+xml"},
		{"notes.txt", []byte("hello"), nil, "text/plain; charset=utf-8"},
		{"page.html", []byte("<html><script>alert(1)</script>"), errFileType, ""},
		{"run.exe", []byte("MZ\x90\x00"), errFileType, ""},
		{"fake.png", []byte("<html><script>alert(1)</script>"), errFileMismatch, ""},
		{"fake.pdf", png, errFileMismatch, ""},
		{"empty.png", nil, errFileEmpty, ""},
	}
	for _, tc := range cases {
		_, mime, err := validateUpload(header(t, tc.name, tc.body))
		if err != tc.want || mime != tc.mime {
			t.Errorf("%s: got (%q, %v), want (%q, %v)", tc.name, mime, err, tc.mime, tc.want)
		}
	}
}

func TestValidateUploadTooLarge(t *testing.T) {
	fh := header(t, "big.png", []byte("\x89PNG\r\n\x1a\n"))
	fh.Size = MaxUploadSize + 1
	if _, _, err := validateUpload(fh); err != errFileTooLarge {
		t.Fatalf("got %v, want errFileTooLarge", err)
	}
}

func TestSafeName(t *testing.T) {
	cases := map[string]string{
		"My Resume (final).pdf":  "My_Resume_final",
		"../../etc/passwd.png":   "passwd",
		"résumé.pdf":             "rsum",
		strings.Repeat("a", 200): strings.Repeat("a", 60),
	}
	for in, want := range cases {
		if got := safeName(in); got != want {
			t.Errorf("safeName(%q) = %q, want %q", in, got, want)
		}
	}
}
