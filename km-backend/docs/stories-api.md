# Stories API

24-hour stories: one photo or one video (up to 60 seconds, 50 MB) with an optional caption of up
to 200 characters. All routes need the usual `Authorization: Bearer` token.

## Who sees a story

- The owner.
- The owner's connections.
- For a recruiter: also everyone who follows their company. A job seeker's or expert's stories go
  to connections only, even if someone "follows" them.
- Never anyone blocked either way, and only while the owner's account is active.

## Sharing

1. Upload the media first:
   - Photo: `POST /api/files/upload` with `kind=story_image` (5 MB).
   - Video: `POST /api/files/multipart` with `kind=story_video`, then the parts and `complete`,
     exactly as for feed videos (see feed-video-api.md), then wait for `GET /api/files/videos/{id}`
     to say `ready` (step 3b there). Optionally upload a still from the video as a `story_image`
     to use as its poster.
2. `POST /api/stories`

```json
{
  "media": { "file_id": "…", "width": 1080, "height": 1920, "poster_file_id": "…", "duration": 24 },
  "caption": "First day at the new site"
}
```

For a video the server uses its own length and size from its check, whatever is sent
(`400 STORY_VIDEO_NOT_READY` while it is still checking). `poster_file_id` is only for a video.
Answers `201` with the story. A member can share 10 stories in any 24 hours
(`429 STORY_DAILY_LIMIT`).

## Showing

`GET /api/stories` returns the bar: one group per member.

```json
[
  {
    "owner": { "id": "…", "name": "…", "avatar": "…", "role": "recruiter" },
    "stories": [
      {
        "id": "…",
        "media": { "type": "video", "url": "…", "poster_url": "…", "duration": 24 },
        "caption": "…",
        "created_at": "…",
        "expires_at": "…",
        "seen": false,
        "views": 12
      }
    ],
    "all_seen": false,
    "is_own": true
  }
]
```

- Order: your own group first, then groups with something you haven't seen (newest first), then
  the rest.
- Stories in a group are oldest first. Start at the first one with `seen: false`.
- `views` is only on your own stories.

`POST /api/stories/{id}/view` when a story is shown (`204`). Counted once per member; your own
views don't count.

`GET /api/stories/{id}/viewers` (owner only): `[{ "viewer": {…}, "viewed_at": "…" }]`, newest first.

`DELETE /api/stories/{id}` (owner only, `204`).

## Replying

A reply is a normal chat message to the owner with `story_id`:

`POST /api/chats/messages` `{ "receiver_id": "<owner id>", "content": "…", "story_id": "…" }`

The usual chat rules apply (free daily limit, Chat Pass for people who aren't recruiters). If the
story has ended or can't be seen: `400 CHAT_STORY_UNAVAILABLE`. The message comes back with a
`story` copy:

```json
"story": { "id": "…", "owner_id": "…", "media_type": "image", "thumb_url": "…", "caption": "…", "expires_at": "…" }
```

After `expires_at` show "Story ended" instead of the still: the file is deleted by then.

## Reporting

`POST /api/stories/{id}/report` `{ "reason": "spam|harassment|misleading|inappropriate|other", "details": "…" }`
(`204`). One report per member per story; you can't report your own.

- 3 open reports hide the story until a moderator decides. Its files move to a new address, so a
  link someone saved earlier stops working; the moderator sees the new one.
- A reported story is kept (hidden from members once it ends) for up to 7 days past its 24 hours
  so it can be reviewed. After that it is deleted and its reports close as `expired`.
- If the owner deletes a reported story, it disappears for everyone straight away and is kept only
  for the moderator (at a new address, as above); it never comes back, whatever the decision.

## Moderation (admins)

- `GET /api/admin/stories/reports?page=1` → `{ "items": [...], "total": n }`
- `POST /api/admin/stories/{id}/decision` `{ "action": "keep" | "remove" }`

`remove` deletes the story and its files at once. `keep` puts a hidden story back on show (if its
24 hours aren't up) and closes the reports.

## Clean-up

Every 10 minutes the server deletes stories whose time is up, with their views and their files in
storage (and clears them from the CDN cache). When an account is deleted, its stories go the same
way within minutes.
