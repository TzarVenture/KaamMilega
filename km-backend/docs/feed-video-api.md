# Videos on feed posts: API for the mobile app

All routes are under `/api` and need `Authorization: Bearer <token>`.
Errors look like `{"code": "UPLOAD_PART_SIZE", "error": "..."}`. Branch on `code`, never on the text.

A post has **one video or up to 4 photos**, never both. A video is up to **60 seconds** and **50 MB**,
in MP4, MOV (iPhone) or WebM. After upload the server checks every video itself (its real length
and size) and converts ones browsers can't play (HEVC, WebM) to H.264 MP4. A video can go on a post
only once that check is done (step 3b).
A member can finish up to 20 video uploads a day. A finished video that isn't put on a post
within 24 hours is deleted, so upload it while the member writes the post, and post soon after.

## 1. Check the video on the phone

- Length 60 seconds or less, size 50 MB or less. If it is too big, offer to trim it or compress it.
  The server checks the length again and refuses longer videos, so this only saves the member a
  wasted upload.
- H.264 video with AAC sound is used as it is. HEVC (some iPhones' default) and other formats are
  converted by the server, which takes a little longer; converting on the phone first is fine too.
- Take a still from early in the video (about 1 second in) as a JPEG, up to 1280 px on the long
  side. It shows before the video plays.

## 2. Upload the still (optional, but please send one)

`POST /files/upload` as multipart with `file` and `kind=feed_image`, as for any feed photo.
Keep the `id`.

## 3. Upload the video in parts

The API takes about 12 MB per request, so a video goes up in parts.

**Start:** `POST /files/multipart`

```json
{ "kind": "feed_video", "filename": "clip.mp4", "size": 18874368 }
```

`size` is the exact file size in bytes. The answer (201):

```json
{ "id": "6745...", "part_size": 8388608, "parts": 3 }
```

**Send each part, in order:** `PUT /files/multipart/{id}/parts/{n}` with `n` = 1, 2, 3 … and the raw
bytes as the body (`Content-Type: application/octet-stream`). Part `n` is bytes
`(n-1)*part_size` up to `n*part_size` of the file; the last part is whatever is left. Answer: 204.

- Send one part at a time, and the next only after the previous one returned 204.
- On a network error, send the same part again. If the answer is `UPLOAD_PART_OUT_OF_ORDER`
  on a retry, the earlier try did arrive: carry on with the next part.
- The first part is checked to be a real video. A file that isn't ends the upload with
  `FILE_CONTENT_MISMATCH`.

Videos can't go through `/files/upload` (code `UPLOAD_IN_PARTS`).

**Finish:** `POST /files/multipart/{id}/complete`. The answer (201) is the file, like
`/files/upload` returns. Keep its `id`.

The answer's `video.state` is `processing`: the server is now checking the video.

**Cancel** (the member removed the video or left the screen): `DELETE /files/multipart/{id}`.
An upload not finished within an hour is cleared by the server anyway.

| Code | Status | Meaning |
|---|---|---|
| `FILE_KIND_INVALID` | 400 | `kind` missing or unknown |
| `UPLOAD_KIND_NOT_CHUNKED` | 400 | This kind is uploaded in one go through `/files/upload` |
| `FILE_EMPTY` | 400 | `size` is 0 |
| `FILE_TYPE_NOT_ALLOWED_HERE` | 415 | Not an MP4, MOV, M4V or WebM file name |
| `FILE_TOO_LARGE_HERE` | 413 | Over 50 MB |
| `FILE_CONTENT_MISMATCH` | 415 | The file isn't the video it claims to be; start again with a real one |
| `UPLOAD_TOO_MANY` | 409 | Three uploads already in progress; finish or cancel one |
| `UPLOAD_DAILY_LIMIT` | 429 | 20 videos uploaded in the last 24 hours |
| `UPLOAD_NOT_FOUND` | 404 | The upload ended (finished, cancelled, expired); start again |
| `UPLOAD_PART_OUT_OF_ORDER` | 400 | Not the part the server expects next |
| `UPLOAD_PART_SIZE` | 400 | A part other than the last isn't `part_size` bytes, or the parts add up to more than `size` |
| `UPLOAD_BUSY` | 409 | An earlier try of this part is still being stored; wait about 10 seconds and send it again (it can take up to 2 minutes) |
| `UPLOAD_INCOMPLETE` | 400 | `complete` was called before every part arrived |
| `FILE_STORE_FAILED` | 502 or 500 | Storage or the server failed; try the same step again |

## 3b. Wait until the video is ready

`GET /files/videos/{id}` (your own videos only) every 2 seconds until `video.state` changes:

```json
{ "id": "…", "url": "https://cdn.../feed_video/....mp4", "mime_type": "video/mp4",
  "video": { "state": "ready", "duration": 41.6, "width": 720, "height": 1280 } }
```

- `processing`: keep waiting (show "Preparing video…"). Most videos take a few seconds; a long
  iPhone video being converted can take a minute.
- `ready`: the video can be posted. Its `url` may have changed (a converted video is a new MP4
  file), so use this one for any preview.
- `failed`: show `video.error` and let the member pick another video. `video.error_code` is
  `VIDEO_TOO_LONG` (over 60 seconds), `VIDEO_UNREADABLE` (not a video the server can read),
  `VIDEO_PROCESSING_FAILED` or `VIDEO_PROCESSING_UNAVAILABLE` (try again later). A failed video
  is deleted.

## 4. Create the post

`POST /feed`, as for photos, with the video as the only media item:

```json
{
  "content": "Our new workshop",
  "category": "general",
  "media": [
    { "file_id": "<video id>", "poster_file_id": "<still id>", "duration": 42, "width": 720, "height": 1280 }
  ]
}
```

`duration`, `width` and `height` may be sent but the server uses its own values from the check
(the length rounded to whole seconds, the size in pixels as the video plays).

| Code | Meaning |
|---|---|
| `FEED_VIDEO_WITH_PHOTOS` | A video and photos in one post |
| `FEED_VIDEO_NOT_READY` | The server is still checking the video; wait for `ready` (step 3b) |
| `FEED_INVALID_MEDIA` | A video the server refused, a file that isn't yours, is already on another post, was deleted for not being posted in time, or a still on a photo |

## 5. Showing posts

Every item in a post's `media` now has a `type`:

```json
{ "type": "video", "url": "https://cdn.../feed_video/....mp4", "poster_url": "https://cdn.../feed_image/....jpg",
  "duration": 42, "width": 720, "height": 1280 }
```

- `type` is `image` or `video`. Posts from before videos come back as `image`.
- `poster_url` may be missing; show a plain dark box with a play button then.
- Don't play with sound on its own. Start muted, or only when the member taps play.
- The video is served from the CDN and supports seeking (range requests).

Editing a post still changes only its text and category. Deleting a post deletes its video and
still too.
