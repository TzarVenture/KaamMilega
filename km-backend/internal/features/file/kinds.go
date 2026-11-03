package file

import (
	"strings"

	"km-backend/internal/common/apperr"
	"km-backend/internal/storage"
)

// Kind says what an upload is for. It decides the bucket (public CDN or private), the file
// types accepted and the size limit, so a resume can never land on the public CDN.
type Kind struct {
	Name       string
	Visibility storage.Visibility
	Extensions []string
	MaxSize    int64
}

var (
	imageExts    = []string{".jpg", ".jpeg", ".png", ".webp"}
	documentExts = []string{".pdf", ".doc", ".docx"}
	idProofExts  = []string{".pdf", ".jpg", ".jpeg", ".png"}
)

var kinds = map[string]Kind{
	// Public: shown to everyone, served from the CDN
	"avatar":       {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"cover":        {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"company_logo": {Visibility: storage.Public, Extensions: append([]string{".svg"}, imageExts...), MaxSize: 2 << 20},
	"event_image":  {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"feed_image":   {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},

	// Private: owner, admins and the people the file was shared with, through signed links
	"resume":           {Visibility: storage.Private, Extensions: documentExts, MaxSize: 5 << 20},
	"company_document": {Visibility: storage.Private, Extensions: idProofExts, MaxSize: MaxUploadSize},
	"expert_document":  {Visibility: storage.Private, Extensions: idProofExts, MaxSize: MaxUploadSize},
	"chat": {Visibility: storage.Private, Extensions: []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx", ".txt"},
		MaxSize: MaxUploadSize},
}

var (
	errUnknownKind  = apperr.New("FILE_KIND_INVALID", "Unknown upload type.")
	errKindFileType = apperr.New("FILE_TYPE_NOT_ALLOWED_HERE", "This file type isn't allowed here.")
	errKindTooLarge = apperr.New("FILE_TOO_LARGE_HERE", "This file is over the size limit for this upload.")
)

func init() {
	for name, k := range kinds {
		k.Name = name
		kinds[name] = k
	}
}

// kindFor resolves the form's kind. Older app versions send no kind: chat keeps its meaning,
// images become public and documents private, so nothing sensitive is ever made public.
func kindFor(kind, moduleName, ext string) (Kind, error) {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		switch {
		case moduleName == "chat":
			kind = "chat"
		case contains(imageExts, ext):
			kind = "avatar"
		default:
			kind = "company_document"
		}
	}
	k, ok := kinds[kind]
	if !ok {
		return Kind{}, errUnknownKind
	}
	return k, nil
}

func (k Kind) check(ext string, size int64) error {
	if !contains(k.Extensions, ext) {
		return errKindFileType
	}
	if size > k.MaxSize {
		return errKindTooLarge
	}
	return nil
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
