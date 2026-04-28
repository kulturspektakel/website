---
name: spotify-preview
description: Given a Spotify track link and a band name (or slug), resolves the 30-second preview URL and updates the BandPlaying row in the Neon database. Trigger when the user provides a Spotify URL together with a band identifier.
---

# Spotify Preview URL Resolver

Resolves a Spotify track URL to its preview MP3 and writes both the track ID and preview URL to the matching `BandPlaying` row.

## Inputs

The user provides:
- A **band identifier** — name or slug
- A **Spotify track URL**, e.g. `https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=xyz`

Both can come in any order or format. Common shapes:
- `<band name>: <url>`
- `<url> for <band name>`
- Two consecutive lines

If only one of the two is present, ask the user for the other before doing anything.

## Constants

- Neon project ID: `bitter-brook-37135608`
- Database: `kultursp` (default)
- Target table: `BandPlaying`

## Steps

### 1. Extract the Spotify track ID

The URL pattern is `https://open.spotify.com/track/{ID}` (optionally followed by `?si=...` or other query params). The ID is 22 base62 characters.

Regex: `/track/([a-zA-Z0-9]+)`

If the URL is for an album, artist, or playlist (`/album/`, `/artist/`, `/playlist/`), reject — preview resolution only works for tracks. Tell the user.

### 2. Fetch the preview URL

Use Bash:

```bash
curl -sL "https://open.spotify.com/embed/track/{TRACK_ID}" | grep -oE '"audioPreview":\{"url":"[^"]+"' | head -1 | sed 's/.*"url":"//;s/"$//'
```

If empty: the track has no preview (rare — happens for some podcast episodes or unavailable regional tracks). Tell the user and stop.

### 3. Find the band row

Use the Neon MCP tool `mcp__neon__run_sql` against project `bitter-brook-37135608`:

```sql
SELECT id, name, slug, "eventId", "startTime"
FROM "BandPlaying"
WHERE name ILIKE '<band identifier>' OR slug = '<band identifier>'
ORDER BY "startTime" DESC;
```

Resolution:
- **0 rows** → tell the user no match was found, suggest checking the spelling.
- **1 row** → proceed.
- **>1 rows** → list each with `name`, `eventId`, and `startTime` formatted as a date, then ask the user which one to update. Don't guess.

### 4. Update the row

Use `mcp__neon__run_sql`:

```sql
UPDATE "BandPlaying"
SET "spotifyTrackId" = '{TRACK_ID}',
    "spotifyPreviewUrl" = '{PREVIEW_URL}'
WHERE id = '{ROW_ID}';
```

Both columns get written so the data stays internally consistent (track ID + URL derived from it).

### 5. Confirm

Report back:
- The band name and event/year
- The track ID
- The preview URL (linkified so the user can click to verify)

Keep the confirmation under 4 lines. No prose narration of the steps.

## Errors and edge cases

- **Network failure** fetching the embed page: report the curl exit code or empty body, don't retry silently.
- **Multiple bands with the same name in the same year**: extremely unlikely; if it happens, ask the user to disambiguate by `id` or `slug`.
- **Existing values overwritten without warning**: that's intended — the user is explicitly providing a new link, so we replace whatever was there. If the user wants to compare first, they'll ask.

## What this skill does NOT do

- Does not run `prisma generate` or schema migrations — the columns are assumed to exist.
- Does not update the local `prisma/schema.prisma` — only the database.
- Does not handle artist URLs or playlist URLs.
