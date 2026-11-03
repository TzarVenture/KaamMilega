// Package policies holds the site's legal and community pages (terms, privacy and so on).
// Admins write them in the admin panel; each save publishes a new version, and every version is
// kept, so what someone agreed to on a given day can always be looked up.
package policies

import (
	"strings"
	"time"
	"unicode/utf8"

	"km-backend/internal/common/apperr"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	PoliciesCollection = "policies"
	VersionsCollection = "policy_versions"
)

// Kind is one policy the site publishes, at /policies/{Slug}
type Kind struct {
	Slug  string `json:"slug"`
	Title string `json:"title"` // used until the first version is published
	// Audience says who the policy is for, as a hint in the admin panel
	Audience string `json:"audience"`
}

// Kinds are the policies the site links to (sign-up and the footer). The list is fixed so a
// link can never point at a page nobody can create.
var Kinds = []Kind{
	{Slug: "terms", Title: "User terms and conditions", Audience: "Jobseekers and experts"},
	{Slug: "employer-terms", Title: "Employer terms of service", Audience: "Recruiters and companies"},
	{Slug: "privacy", Title: "Privacy policy", Audience: "Everyone"},
	{Slug: "community-guidelines", Title: "Community guidelines", Audience: "Everyone who posts, comments or messages"},
}

func kindOf(slug string) (Kind, bool) {
	for _, k := range Kinds {
		if k.Slug == slug {
			return k, true
		}
	}
	return Kind{}, false
}

const (
	MaxTitleLength   = 120
	MaxContentLength = 100_000
)

var (
	ErrNotFound        = apperr.New("POLICY_NOT_FOUND", "This policy isn't published yet.")
	ErrTitleInvalid    = apperr.New("POLICY_TITLE_INVALID", "Give the policy a title of up to 120 characters.")
	ErrContentEmpty    = apperr.New("POLICY_CONTENT_EMPTY", "Write the policy before publishing it.")
	ErrContentTooLong  = apperr.New("POLICY_CONTENT_TOO_LONG", "A policy can be up to 100,000 characters.")
	ErrUnchanged       = apperr.New("POLICY_UNCHANGED", "Nothing has changed since the published version.")
	errVersionConflict = apperr.New("POLICY_VERSION_CONFLICT", "Someone published this policy while you were editing. Reload it and make your changes again.")
)

// Policy is the published version of a policy. Content is Markdown: headings, lists, bold and
// links (see the site's PolicyContent renderer).
type Policy struct {
	Slug        string             `bson:"_id" json:"slug"`
	Title       string             `bson:"title" json:"title"`
	Content     string             `bson:"content" json:"content"`
	Version     int                `bson:"version" json:"version"`
	PublishedAt time.Time          `bson:"published_at" json:"published_at"`
	PublishedBy primitive.ObjectID `bson:"published_by" json:"-"`
}

// Version is a past or current version, kept for the record
type Version struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"-"`
	Slug        string             `bson:"slug" json:"slug"`
	Version     int                `bson:"version" json:"version"`
	Title       string             `bson:"title" json:"title"`
	Content     string             `bson:"content" json:"content,omitempty"`
	PublishedAt time.Time          `bson:"published_at" json:"published_at"`
	PublishedBy primitive.ObjectID `bson:"published_by" json:"-"`
}

// PublishInput is an admin's edit. BaseVersion is the version they started from, so two admins
// editing at once can't silently overwrite each other.
type PublishInput struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	BaseVersion int    `json:"base_version"`
}

// clean trims the edit and checks it; line endings are normalised so a Windows paste doesn't
// count as a change
func (in PublishInput) clean() (title, content string, err error) {
	title = strings.Join(strings.Fields(in.Title), " ")
	content = strings.TrimSpace(strings.ReplaceAll(in.Content, "\r\n", "\n"))
	switch {
	case title == "" || utf8.RuneCountInString(title) > MaxTitleLength:
		return "", "", ErrTitleInvalid
	case content == "":
		return "", "", ErrContentEmpty
	case utf8.RuneCountInString(content) > MaxContentLength:
		return "", "", ErrContentTooLong
	}
	return title, content, nil
}

// AdminPolicy is a policy as the admin list shows it: published or not yet
type AdminPolicy struct {
	Kind
	Published   bool       `json:"published"`
	Version     int        `json:"version"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
}
