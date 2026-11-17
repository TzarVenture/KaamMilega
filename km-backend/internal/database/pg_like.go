package database

import "strings"

var likeEscaper = strings.NewReplacer(`\`, `\`, `%`, `\%`, `_`, `\_`)

// EscapeLike makes a search term match literally inside a LIKE or ILIKE pattern, so % and _
// typed by a user are not wildcards. Postgres uses backslash as the default LIKE escape.
func EscapeLike(s string) string { return likeEscaper.Replace(s) }

// LikeContains is a "contains this text" pattern for LIKE or ILIKE
func LikeContains(s string) string { return "%" + EscapeLike(s) + "%" }
