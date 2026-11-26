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
	// AdminOnly kinds can only be uploaded by admins
	AdminOnly bool
	// Chunked kinds are too big for one request and come in parts (chunked.go)
	Chunked bool
	// ClearUnused: uploads of this kind still on nothing after a day are deleted (chunked kinds
	// always are)
	ClearUnused bool
}

var (
	imageExts    = []string{".jpg", ".jpeg", ".png", ".webp"}
	gifOrImage   = append([]string{".gif"}, imageExts...)
	documentExts = []string{".pdf", ".doc", ".docx"}
	idProofExts  = []string{".pdf", ".jpg", ".jpeg", ".png"}
)

var kinds = map[string]Kind{
	// Public: shown to everyone, served from the CDN
	"avatar":       {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"cover":        {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"company_logo": {Visibility: storage.Public, Extensions: append([]string{".svg"}, imageExts...), MaxSize: 2 << 20},
	"event_image":  {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	// Photos on posts and stories may also be animated GIFs (the composers offer them)
	"feed_image": {Visibility: storage.Public, Extensions: gifOrImage, MaxSize: 5 << 20},
	// A video on a post: up to 60 seconds (checked in the app) and 50 MB, uploaded in parts
	"feed_video": {Visibility: storage.Public, Extensions: []string{".mp4", ".mov", ".m4v", ".webm"}, MaxSize: 50 << 20, Chunked: true},
	// A story (24 hours): a photo, or a video with the same limits as a post's
	"story_image": {Visibility: storage.Public, Extensions: gifOrImage, MaxSize: 5 << 20, ClearUnused: true},
	"story_video": {Visibility: storage.Public, Extensions: []string{".mp4", ".mov", ".m4v", ".webm"}, MaxSize: 50 << 20, Chunked: true},
	// Ad creatives (admins only): an image, an animated GIF or a short muted video
	// A recruiter's paid ad (adsales): a still image only; an admin checks it before it runs
	"ad_image":    {Visibility: storage.Public, Extensions: imageExts, MaxSize: 5 << 20},
	"ad_creative": {Visibility: storage.Public, Extensions: append([]string{".gif", ".mp4", ".webm"}, imageExts...), MaxSize: MaxUploadSize, AdminOnly: true},

	// Private: owner, admins and the people the file was shared with, through signed links
	"resume":           {Visibility: storage.Private, Extensions: documentExts, MaxSize: 5 << 20},
	"company_document": {Visibility: storage.Private, Extensions: idProofExts, MaxSize: MaxUploadSize},
	"expert_document":  {Visibility: storage.Private, Extensions: idProofExts, MaxSize: MaxUploadSize},
	// Proof of a certificate on a profile; only the member and admins open it
	"certificate": {Visibility: storage.Private, Extensions: idProofExts, MaxSize: 5 << 20},
	// Police verification certificate for the Police checked badge; only the member and admins open it
	"police_certificate": {Visibility: storage.Private, Extensions: idProofExts, MaxSize: 5 << 20},
	"chat": {Visibility: storage.Private, Extensions: []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx", ".txt"},
		MaxSize: MaxUploadSize},
}

var (
	errUnknownKind   = apperr.New("FILE_KIND_INVALID", "Unknown upload type.")
	errKindFileType  = apperr.New("FILE_TYPE_NOT_ALLOWED_HERE", "This file type isn't allowed here.")
	errKindTooLarge  = apperr.New("FILE_TOO_LARGE_HERE", "This file is over the size limit for this upload.")
	errKindAdminOnly = apperr.New("FILE_KIND_ADMIN_ONLY", "Only admins can upload this.")
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
