---
title: "07 — Error Mapping (XML-RPC → REST)"
aliases: [error-mapping, error-codes]
tags: [uploader/errors, phase-2]
created: 2026-04-15
status: locked
---

# 07 — Error Mapping (XML-RPC → REST)

> [!INFO] Purpose
> XML-RPC returned errors as `{ status: "413 Invalid token" }` — a space-separated code+message string parsed by substring matching. REST returns a structured JSON envelope: `{ error_code, message, details? }` + an HTTP status code. This doc is the translation table used by [[05-upload-flow]] error branches + UI text.

## 1. Canonical REST error envelope

From the Rails backend (`api/v1/subtitles/upload/base_controller.rb`):
```json
{
  "error_code": "quota_exceeded",
  "message": "Daily upload limit reached",
  "details": { "quota": { "limit": 50, "remaining": 0, "resets_at": "..." } }
}
```

HTTP status matches the error semantics (401, 403, 404, 409, 422, 429). `error_code` is the stable machine-readable key; `message` is human text that can be localized; `details` carries structured context when useful.

## 2. Mapping table

### 2.1 Auth (all endpoints)

| XML-RPC `status` | HTTP | `error_code` | UI action |
|---|---|---|---|
| `401 Unauthorized` | 401 | `unauthorized` | Clear auth, show LoginDialog |
| `403 Invalid subtitle language` | 400 | `invalid_language` | Highlight language dropdown |
| `406 No session` | 401 | `unauthorized` | Clear auth, show LoginDialog |
| `414 Unknown User Agent` | 403 | `banned` | "Your client version is not supported — please update" |

### 2.2 `/subtitles/upload/check` (replaces `TryUploadSubtitles` + `CheckSubHash`)

| XML-RPC / Legacy condition | HTTP | `error_code` | UI action |
|---|---|---|---|
| `alreadyindb: 1` | 200 OK | — (not an error — look at `already_in_db: true` in response) | Show "already in DB" with link to duplicate |
| `403 Empty moviehash` | 400 | `validation_error` | Highlight moviehash |
| `403 Missing subtitle content` | 400 | `validation_error` | "File could not be read" |
| `415 Invalid subtitle content` | 400 | `invalid_content` | "Subtitle file is corrupt or not a supported format" |
| `429 Too Many Requests` | 429 | `quota_exceeded` | Show quota panel with `resets_at` |
| (new) banned UA/IP/consumer | 403 | `banned` | "Uploads are currently not permitted from this setup" + `details.reason` |
| (new) anon + duplicate language | 403 | `anon_duplicate_language` | "Anonymous uploads cannot duplicate existing language — log in or choose different" |
| (new) filename spam (reject severity) | 403 | `spam_filename` | "Filename is not permitted — try renaming" |
| (new) feature not found for IMDb | 422 | `feature_not_found` | "Title not in database — [Create new entry]" (triggers stub flow) |
| (new) no title identified at all (no feature_id / idmovieimdb / tmdbid) | 422 | `feature_required` | "Pick a movie or episode" |
| (new 2026-10-08) show found, that season/episode not found | 422 | `episode_not_found` | "Episode not found" + server message (names the S/E). Fix: check numbering, or upload against the episode's own IMDb id. Before 2026-10-08 the server silently attached the subtitle to the show instead. |
| (new) no language sent | 400 | `language_required` | "Pick a language" |
| (new 2026-10-12) series id with no season+episode | 422 | `episode_required` | "Pick an episode". A subtitle never attaches to a whole series. |
| (new 2026-10-12, from_id) TMDb id is both a movie and a series, no type | 422 | `ambiguous_tmdb_id` | Ask for the full themoviedb.org link or the IMDb id. The dialog sends `tmdb_type` from a pasted URL. |
| (new 2026-10-12, from_id) TMDb not answering | 503 | `lookup_unavailable` | "Try again". Do NOT steer to manual entry; the title may exist. |

### 2.3 `/subtitles/upload` (commit — replaces `UploadSubtitles`)

| XML-RPC / Legacy condition | HTTP | `error_code` | UI action |
|---|---|---|---|
| All check errors above (if somehow skipped check) | — | (same) | (same) |
| `422 Subhash mismatch` | 422 | `subhash_mismatch` | "File changed during upload — please restart" |
| Subtitle content under the format floor (30 B SRT/VTT/ASS/SSA, 8 B compact; since 2026-11, was < 100 B → `spam_content`) | 400 | `too_small` | "The file contains no subtitle" |
| Duplicate exists (race vs check) | 409 | `duplicate` | "Someone else just uploaded this — here's the link" |
| Internal error | 500 | `error` | Generic "Unexpected error — please try again" + support CTA |

### 2.4 `/subtitles/upload/guess`

| Condition | HTTP | `error_code` | UI action |
|---|---|---|---|
| Missing `filename` AND `moviehash` | 400 | `validation_error` | "We need at least a filename or a video file" |
| No candidates | 200 (empty array) | — | Show "No match — [Create new entry]" |
| Network error | — | `network_error` (client-side synthesized) | Retry button |

### 2.5 `/subtitles/upload/features/stub`

| Condition | HTTP | `error_code` | UI action |
|---|---|---|---|
| Not logged in | 401 | `unauthorized` | LoginDialog |
| Missing title | 400 | `missing_title` | Highlight title field |
| Invalid type | 400 | `invalid_type` | "Type must be movie / tvshow / episode" |
| Validation error | 422 | `validation_error` | Show `message` field in form |

### 2.6 `/my/uploads` (GET/PATCH/DELETE)

| Condition | HTTP | `error_code` | UI action |
|---|---|---|---|
| Not logged in | 401 | `unauthorized` | LoginDialog |
| Not your subtitle | 404 | `not_found` | "Upload not found or not yours" |
| PATCH validation | 422 | `validation_error` | Inline form error under the relevant field |

### 2.7 Network / transport

| Condition | Detection | `error_code` (client synth) | UI action |
|---|---|---|---|
| Offline | `TypeError` + "fetch" msg OR `navigator.onLine === false` | `offline` | Offline banner + queue upload for retry |
| DNS fail | `fetch` rejects before response | `network_error` | Retry button |
| Request timeout | AbortController 30s | `timeout` | Retry button |
| 5xx | status ≥ 500 | `server_error` | "OpenSubtitles is having issues — try again shortly" + status page link |

## 3. Client-side synthesis helper

```js
// src/services/api/restClient.js (extension)
function synthesizeNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new RestError('offline', 'You appear to be offline', 0);
  }
  if (err.name === 'AbortError') {
    return new RestError('timeout', 'Request timed out', 0);
  }
  if (err.name === 'TypeError' && /fetch/i.test(err.message)) {
    return new RestError('network_error', 'Could not reach the server', 0);
  }
  return new RestError('unknown', err.message ?? 'Unknown error', 0, { original: err });
}
```

Wrap every `fetch` call in `restClient.request()`:
```js
try {
  const res = await fetch(...);
  // handle HTTP errors above
} catch (e) {
  if (e instanceof RestError) throw e;
  throw synthesizeNetworkError(e);
}
```

## 4. UI error components

Single shared component `<ErrorBanner error={err} onRetry={...} />`. It routes by `error_code`:

```jsx
const COPY = {
  offline:               { icon: '📡', title: "You're offline",        body: 'Re-connect and try again.' },
  unauthorized:          { icon: '🔒', title: 'Please log in',          body: null, action: 'login' },
  quota_exceeded:        { icon: '⏳', title: 'Daily limit reached',    body: null, action: 'quota' },
  banned:                { icon: '🚫', title: 'Uploads not permitted',  body: null },
  spam_filename:         { icon: '⚠️', title: 'Filename not allowed',   body: 'Try renaming the file.' },
  anon_duplicate_language:{ icon: '👤', title: 'Not allowed for guests', body: 'Log in, or choose a different language.' },
  feature_not_found:     { icon: '🎬', title: 'Movie not in database',  body: null, action: 'stub' },
  duplicate:             { icon: '♻️', title: 'Already in database',    body: null, action: 'open-existing' },
  subhash_mismatch:      { icon: '🔄', title: 'File changed — restart', body: null },
  invalid_content:       { icon: '❌', title: 'Corrupt subtitle',       body: null },
  spam_content:          { icon: '🗑️', title: 'Content not permitted', body: null },
  too_small:             { icon: '📄', title: 'File is empty',         body: null },
  validation_error:      { icon: '✏️', title: 'Please check the fields',body: null },
  invalid_language:      { icon: '🌐', title: 'Unknown language',       body: null },
  missing_title:         { icon: '📝', title: 'Title is required',      body: null },
  invalid_type:          { icon: '📂', title: 'Type must be movie / tvshow / episode', body: null },
  not_found:             { icon: '🔍', title: 'Not found',              body: null },
  timeout:               { icon: '⏲️', title: 'Request timed out',      body: 'Retry in a moment.' },
  network_error:         { icon: '🌐', title: 'Connection issue',       body: null },
  server_error:          { icon: '🔧', title: 'OpenSubtitles is busy',  body: 'Try again shortly.' },
  unknown:               { icon: '❓', title: 'Something went wrong',   body: null },
};
```

Fallback: if `error_code` isn't in the map, display the server's `message` field verbatim.

## 5. Localization readiness

Error copy currently English-only. Each `error_code` becomes a stable translation key:

```yaml
# config/locales/upload.en.yml (Rails side — existing)
upload_errors:
  quota_exceeded:
    title: "Daily limit reached"
    body: "You have reached your daily upload quota."
  # ...
```

Uploader reads `item.error_code` + passes to i18n: `t(`upload_errors.${code}.title`)`. For Phase 2 we ship hardcoded English; i18n wiring is a Phase 2 follow-up.

## 6. Retry vs no-retry classification

For the REST client's `retryAsync` wrapper:

**Retry:**
- `network_error`
- `timeout`
- `server_error` (5xx)
- `offline` only after `online` event fires

**Do NOT retry:**
- Any 4xx — user must take action
- `unauthorized` — user must re-login
- `quota_exceeded` — would just re-fail

## 7. Debug logging

Every error flows through a single client-side sink:
```js
function logError(phase, err) {
  console.error(`[${phase}]`, err.code, err.status, err.message, err.details);
  // securityUtils if any token/payload might leak:
  logSensitiveData(`[${phase}] raw`, JSON.stringify(err.details), 'generic');
}
```

No PII in `details` by construction (server never includes user data in error responses — verified).

## 8. Server-side error contract sync

> [!NOTE] Cross-repo guarantee
> The Rails backend's `upload_error()` helper in `base_controller.rb` wraps all error responses in the canonical envelope. Both repos MUST agree on `error_code` keys forever (they're a public API). Updating them requires coordinated commits on both sides.

List of error codes currently in Rails (for verification):
- `quota_exceeded` · `banned` · `spam_filename` · `duplicate` · `invalid_language`
- `feature_not_found` · `anon_duplicate_language` · `invalid_content` · `subhash_mismatch`
- `spam_content` · `validation_error` · `unauthorized` · `missing_title` · `invalid_type` · `not_found`

Codes added client-side (network layer):
- `offline` · `timeout` · `network_error` · `server_error` · `unknown`

Total contract: 20 distinct codes.

## 9. Checklist

- [ ] `RestError` + `AuthError` classes in `restClient.js`
- [ ] `synthesizeNetworkError()` helper
- [ ] `COPY` table in `ErrorBanner` component
- [ ] Retry classification wired into `retryAsync` call sites
- [ ] Test coverage for every code in §2 (see [[08-testing-strategy#Error mapping tests]])
- [ ] Align with Rails' error_code set on every server-side change
