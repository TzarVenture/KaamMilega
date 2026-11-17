# Atlas versioned migrations for the Postgres (Supabase) database.
# The connection string comes from the environment, never from this file:
#   atlas migrate apply --env supabase      (with DATABASE_URI set)
# After adding or editing a file in migrations/, run: atlas migrate hash

env "supabase" {
  url = getenv("DATABASE_URI")
  migration {
    dir = "file://migrations"
    # Atlas keeps its bookkeeping table in its own schema, next to "app"
    revisions_schema = "atlas_schema_revisions"
  }
}
