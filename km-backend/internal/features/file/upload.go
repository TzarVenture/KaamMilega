package file

import (
	"bytes"
	"errors"
	"io"
	"km-backend/internal/common/apperr"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
)

// MaxUploadSize caps a single upload. The Fiber BodyLimit in cmd/main.go must stay above it.
const MaxUploadSize = 10 << 20

var (
	errFileTooLarge   = apperr.New("FILE_TOO_LARGE", "File is too large. The limit is 10 MB.")
	errFileType       = apperr.New("FILE_TYPE_NOT_ALLOWED", "This file type isn't supported. Use JPG, PNG, WebP, GIF, SVG, PDF, DOC, DOCX or TXT.")
	errFileMismatch   = apperr.New("FILE_CONTENT_MISMATCH", "The file's contents don't match its extension.")
	errFileEmpty      = apperr.New("FILE_EMPTY", "The file is empty.")
	errUnreadableFile = apperr.New("FILE_UNREADABLE", "Error reading the uploaded file.")
)

// allowedTypes maps each accepted extension to the MIME type stored and served for it. The
// client's Content-Type header is never trusted.
var allowedTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".gif":  "image/gif",
	".svg":  "image/svg+xml",
	".pdf":  "application/pdf",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".txt":  "text/plain; charset=utf-8",
}

// sniffMatches checks the first bytes against the claimed extension for formats with a
// reliable signature, so a renamed executable or HTML page can't pass as an image or PDF.
func sniffMatches(ext string, head []byte) bool {
	detected := http.DetectContentType(head)
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf":
		return detected == allowedTypes[ext]
	case ".docx":
		return detected == "application/zip"
	case ".doc":
		return bytes.HasPrefix(head, []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1})
	case ".svg":
		return bytes.Contains(bytes.ToLower(head), []byte("<svg"))
	case ".txt":
		return strings.HasPrefix(detected, "text/plain")
	}
	return false
}

// validateUpload returns the normalised extension and the MIME type to store.
func validateUpload(fh *multipart.FileHeader) (string, string, error) {
	if fh.Size <= 0 {
		return "", "", errFileEmpty
	}
	if fh.Size > MaxUploadSize {
		return "", "", errFileTooLarge
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	mimeType, ok := allowedTypes[ext]
	if !ok {
		return "", "", errFileType
	}

	f, err := fh.Open()
	if err != nil {
		return "", "", errUnreadableFile
	}
	defer f.Close()
	head := make([]byte, 512)
	n, err := io.ReadFull(f, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		return "", "", errUnreadableFile
	}
	if !sniffMatches(ext, head[:n]) {
		return "", "", errFileMismatch
	}
	return ext, mimeType, nil
}

// safeName keeps letters, digits, dot, dash and underscore from a client file name, so stored
// names never carry path separators, spaces or control characters.
func safeName(name string) string {
	base := strings.TrimSuffix(filepath.Base(name), filepath.Ext(name))
	var b strings.Builder
	for _, r := range base {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			b.WriteRune(r)
		case r == ' ' || r == '.':
			b.WriteRune('_')
		}
		if b.Len() >= 60 {
			break
		}
	}
	if b.Len() == 0 {
		return "file"
	}
	return b.String()
}
