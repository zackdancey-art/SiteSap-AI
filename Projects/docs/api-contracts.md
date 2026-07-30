# API Contracts — SiteSnap AI

**Generated from commit:** `cc63dc2`

Base URL: `/api`

**Auth model:** Mobile clients use `Authorization: Bearer <token>`. Web portal uses httpOnly `sitesnap.session` cookie. The `requireAuth` middleware accepts either.

**Role hierarchy:** `owner > manager > viewer > crew` (legacy `admin > supervisor > worker` deprecated but coexistent).

---

## Health & Debug

| Endpoint | Method | Auth | Request | Response | Notes |
|----------|--------|------|---------|----------|-------|
| `/health` | GET | None | — | `{ status: "ok" }` | Always returns 200 |
| `/debug-sentry` | GET | None | — | `{ ok: true, message: string }` | Non-production only; fires a test exception to Sentry |

---

## Authentication

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/auth/register` | POST | None | `{ email, password, phone, fullName?, companyName? }` | `{ ok: true, message: string, warnings?: string[], devCodes?: {emailCode, smsCode}, expiresInSeconds: number }` | 400: missing email/password/phone; 400: invalid email format; 400: phone < 8 digits; 400: password < 8 chars; 409: email already exists; 429: rate limited by IP; 502: provider unavailable (production) |
| `/auth/register/initiate` | POST | None | Same as `/auth/register` | Same as `/auth/register` | Alias for `/auth/register` |
| `/auth/register/verify` | POST | None | `{ email, emailCode, smsCode, inviteToken? }` | `{ ok: true, token: string, user: {email, name, role, companyId, companyRole} }` | 400: expired codes; 401: codes incorrect; 404: no pending signup; 409: email already exists; 429: too many attempts |
| `/auth/login` | POST | None | `{ email, password }` | `{ ok: true, token: string, user: {email, name, role, companyId, companyRole} }` | 404: user not found; 401: password incorrect; 429: rate limited by account or IP |
| `/auth/me` | GET | `requireAuth` | — | `{ user: {email, name, role, companyId, companyRole} }` | 404: user not found (with database) |
| `/auth/profile` | PATCH | `requireAuth` | `{ name?: string, role?: "worker"|"supervisor"|"admin" }` | `{ token: string, user: {email, name, role, companyId, companyRole} }` | 403: only admins can change role; 404: user not found (with database) |
| `/auth/account` | DELETE | `requireAuth` | — | `{ ok: true, message: string }` | 429: rate limited (3 per hour); 500: deletion failed |
| `/auth/refresh` | POST | `requireAuth` | — | `{ token: string, user: {email, name, role, companyId, companyRole} }` | None typically |
| `/auth/change-password` | POST | `requireAuth` | `{ currentPassword: string, newPassword: string }` | `{ ok: true }` | 400: missing fields; 400: password < 8 chars; 401: current password incorrect; 404: user not found; 429: rate limited (5 per 15 min) |
| `/auth/revoke-all` | POST | `requireAuth` | — | `{ token: string }` | None typically |
| `/auth/logout` | POST | None | — | `{ ok: true }` | Clears session cookie |
| `/auth/forgot-password` | POST | None | `{ identifier: string (email or phone), channel?: "email"|"sms" }` | `{ ok: true, message: string, devResetToken?: string, devResetLink?: string }` | 400: missing identifier; 400: invalid email (if channel=email); 429: rate limited by IP; 500: provider unavailable (production) |
| `/auth/reset-password` | POST | None | `{ token: string, newPassword: string }` | `{ ok: true, message: string }` | 400: missing token/password; 400: password < 8 chars; 400: token invalid or expired; 404: user not found; 429: rate limited by IP |

---

## Company Management

All company endpoints require `requireAuth`.

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/company/profile` | GET | `viewer+` | — | `{ company: {id, name, country?, ownerEmail} }` | 404: company not found |
| `/company/profile` | PATCH | `owner` | `{ name?: string, country?: string }` | `{ company: {id, name, country?, ownerEmail} }` | 400: invalid payload; 500: update failed |
| `/company/members` | GET | `manager+` | — | `{ members: [{email, name, companyRole}] }` | 500: list failed |
| `/company/members/invite` | POST | `owner` | `{ emails: string[], companyRole: "manager"|"viewer"|"crew" }` | `{ results: [{email, status: "sent"|"error", token?: string}] }` | 400: invalid payload; 400: owner role not assignable via invite; 500: invite failed |
| `/company/members/:email/role` | PATCH | `owner` | `{ companyRole: "manager"|"viewer"|"crew" }` | `{ member: {email, name, companyRole} }` | 400: invalid payload; 404: member not found; 409: cannot demote last owner; 500: change failed |
| `/company/members/:email` | DELETE | `owner` | — | `{ ok: true }` | 400: cannot remove self; 404: member not found; 409: cannot remove last owner; 500: removal failed |

---

## Projects (Sites, Entries, Diaries)

All project endpoints require `requireAuth` and `viewer+` role. Crew are blocked from the entire router.

### Sites

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/projects/bootstrap` | GET | `viewer+` | — | Single-fetch payload: sites, entries, diaries, timecards, incidents, inspections, deliveries, templates, locations, invites | 500: retrieval failed |
| `/projects/summary` | GET | `viewer+` | — | `{ sites: number, entries: number, diaries: number, approvedDiaries: number, draftDiaries: number, actorRole: string }` | 500: retrieval failed |
| `/projects/sites` | GET | `viewer+` | `?limit=<1-500,default 200>&offset=<≥0,default 0>` | `{ sites: [...], limit, offset }` | 500: retrieval failed |
| `/projects/sites` | POST | `manager+` | `{ name, address, client, startDate, status: "active"|"completed"|"on-hold" }` | `{ site: {id, name, address, client, startDate, status, progressPercent, createdAt, companyId} }` | 400: invalid payload; 500: creation failed |
| `/projects/sites/:id` | DELETE | `manager+` | — | `{ ok: true }` | 404: site not found; 500: deletion failed |
| `/projects/sites/:id/progress` | PATCH | `viewer+` | `{ progressPercent: number (0-100) }` | `{ site: {...} }` | 400: invalid percent; 404: site not found; 500: update failed |

### Entries (site diary records)

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/projects/entries` | GET | `viewer+` | `?siteId=<string>&limit=<1-500>&offset=<≥0>` | `{ entries: [...], limit, offset }` | 500: retrieval failed |
| `/projects/entries` | POST | `viewer+` | `{ siteId, date, locationAddress?, weather?, crewCount?, notes?, photos?, swmsRef?, hazardNotes?, toolboxTalk? }` | `{ entry: {id, siteId, date, locationAddress, weather, crewCount, notes, photos, createdAt} }` | 400: invalid payload; 500: creation failed |
| `/projects/entries/:id` | PATCH | `viewer+` | Same fields as POST (siteId omitted) | `{ entry: {...} }` | 400: invalid payload; 404: entry not found; 500: update failed |
| `/projects/entries/:id` | DELETE | `viewer+` | — | `{ ok: true }` | 404: entry not found; 500: deletion failed |

### Diaries (generated or manual reports)

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/projects/diaries` | GET | `viewer+` | `?siteId=<string>&limit=<1-500>&offset=<≥0>` | `{ diaries: [{id, siteId, status, summary, reportPeriod, fullReport, safetyChecklist, sections, createdAt}], limit, offset }` | 500: retrieval failed |
| `/projects/diaries` | POST | `viewer+` | `{ siteId, status: "draft"|"approved", summary?, reportPeriod: "daily"|"weekly"|"monthly", fullReport?, safetyChecklist?, sections? }` | `{ diary: {id, siteId, status, summary, reportPeriod, fullReport, safetyChecklist, sections, createdAt} }` | 400: invalid payload; 500: creation failed |
| `/projects/diaries/:id` | PATCH | `viewer+` | `{ status?, summary?, reportPeriod?, fullReport?, safetyChecklist?, sections?, note? }` | `{ diary: {...} }` | 400: invalid payload; 404: diary not found; 500: update failed |
| `/projects/reports/supervisor` | GET | `viewer+` | — | `{ generatedAt: ISO string, perSite: [{siteId, siteName, entries: number, approvedDiaries: number, draftDiaries: number}] }` | 500: retrieval failed |

### Templates (entry & project templates)

*Note: There are two template systems — project templates and inspection templates. These are project templates.*

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/projects/templates` | GET | `viewer+` | `?siteId=<string>` | `{ templates: [...] }` | 500: retrieval failed |
| `/projects/templates` | POST | `viewer+` | `{ siteId, name?, weather?, crewCount?, notesTemplate? }` | `{ template: {id, siteId, name, weather, crewCount, notesTemplate, createdAt} }` | 400: invalid payload; 500: creation failed |
| `/projects/templates/:id` | PATCH | `viewer+` | `{ name?, weather?, crewCount?, notesTemplate? }` | `{ template: {...} }` | 400: invalid payload; 404: template not found; 500: update failed |
| `/projects/templates/:id` | DELETE | `viewer+` | — | `{ ok: true }` | 404: template not found; 500: deletion failed |

### Site Invites & Members

| Endpoint | Method | Role | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/projects/sites/:siteId/invites` | POST | `viewer+` | `{ emails: string[], role: "worker"|"supervisor"(default) }` | `{ results: [{email, status: "sent"|"already_member"|"error", token?: string}] }` | 400: invalid payload; 403: insufficient permissions; 429: rate limited; 500: failed |
| `/projects/sites/:siteId/invites` | GET | `viewer+` | — | `{ invites: [{id, invitedEmail, role, token, expiresAt, createdAt}] }` | 403: insufficient permissions; 500: retrieval failed |
| `/projects/sites/:siteId/invites/:inviteId` | DELETE | `viewer+` | — | `{ ok: true }` | 404: invite not found; 500: deletion failed |
| `/projects/sites/:siteId/members` | GET | `viewer+` | — | `{ members: [{email, name, role, siteRole}] }` | 403: insufficient permissions; 500: retrieval failed |
| `/projects/sites/:siteId/members/:email` | DELETE | `viewer+` | — | `{ ok: true }` | 404: member not found; 500: removal failed |
| `/projects/invites/accept` | POST | `requireAuth` | `{ token: string }` | `{ token: string, siteId: string, siteName: string, role: string, companyId: string, companyRole: string }` | 404: invite not found/expired; 403: wrong email; 409: already in different company; 400: cannot accept own invite |

---

## AI & Diary Generation

| Endpoint | Method | Auth | Request | Response | Rate Limit | Error Cases |
|----------|--------|------|---------|----------|------------|-------------|
| `/generate-diary` | POST | `requireAuth` | `{ siteId?, site?: {name?, client?, address?, startDate?}, period?: "daily"|"weekly"|"monthly", entries?: [{date?, locationAddress?, weather?, crewCount?, notes?, photos?: [{uri?, caption?, timestamp?, base64?, mimeType?, storagePath?, storageKey?}]}] }` | `{ success: true, diary: {summary, fullReport, safetyChecklist, reportPeriod, sections}, warning?: string }` | 10 per hour per account | 400: invalid payload; 400: no entries in period; 500: generation failed (returns fallback with warning) |

**Diary schema details:**
- Request: up to 50 entries; up to 12 images processed
- Response sections: `{date, weather, crewCount, workCompleted, safetyObservations, materialsUsed, issues, photoAnalysis}`
- Fallback generator used if OPENAI_API_KEY missing or API fails; returned response is identical except `warning` field populated

---

## Crew & Timecards

All crew endpoints require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/crew/timecards` | GET | `requireAuth` | `?siteId=<string>` | `{ timecards: [{id, siteId, entryId?, workerName, date, startTime?, endTime?, breakMinutes, hoursRegular, hoursOvertime, trade, notes, createdAt}] }` | 500: retrieval failed |
| `/crew/timecards` | POST | `requireAuth` | `{ siteId, entryId?, workerName, date, startTime?, endTime?, breakMinutes (0-480), hoursRegular (0-24), hoursOvertime (0-24)?, trade?, notes? }` | `{ timecard: {...} }` | 400: invalid payload; 500: creation failed |
| `/crew/timecards/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | 404: timecard not found; 500: deletion failed |

---

## Incidents & Safety

All incident endpoints require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/incidents` | GET | `requireAuth` | `?siteId=<string>` | `{ incidents: [{id, siteId, date, severity, description, injuredParty?, correctiveAction?, status, createdAt}] }` | 500: retrieval failed |
| `/incidents` | POST | `requireAuth` | `{ siteId, date, severity: "near-miss"|"minor"|"major"|"critical", description, injuredParty?, correctiveAction?, status?: "open" }` | `{ incident: {...} }` | 400: invalid payload; 500: creation failed; may trigger push notifications for major/critical |
| `/incidents/:id` | PATCH | `requireAuth` | `{ status?: "open"|"closed", correctiveAction?, severity? }` | `{ incident: {...} }` | 400: invalid payload; 404: incident not found; 500: update failed |
| `/incidents/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | 404: incident not found; 500: deletion failed |

---

## Inspections

All inspection endpoints require `requireAuth`.

### Inspection Templates

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/inspection-templates` | GET | `requireAuth` | — | `{ templates: [{id, name, items: string[], createdAt}] }` | 500: retrieval failed |
| `/inspection-templates` | POST | `requireAuth` | `{ name, items: string[] (min 1) }` | `{ template: {...} }` | 400: invalid payload; 500: creation failed |
| `/inspection-templates/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | 404: template not found; 500: deletion failed |

### Inspections

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/inspections` | GET | `requireAuth` | `?siteId=<string>` | `{ inspections: [{id, siteId, templateId?, name, date, results: [{item: string, passed: boolean|null, notes: string}], status, createdAt}] }` | 500: retrieval failed |
| `/inspections` | POST | `requireAuth` | `{ siteId, templateId?, name, date, results?: [{item, passed: boolean|null, notes?}], status?: "pending" }` | `{ inspection: {...} }` | 400: invalid payload; 500: creation failed |
| `/inspections/:id` | PATCH | `requireAuth` | `{ results?: [...], status?: "pending"|"complete" }` | `{ inspection: {...} }` | 400: invalid payload; 404: inspection not found; 500: update failed |
| `/inspections/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | 404: inspection not found; 500: deletion failed |

---

## Deliveries

All delivery endpoints require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Rate Limit | Error Cases |
|----------|--------|------|---------|----------|------------|-------------|
| `/deliveries` | GET | `requireAuth` | `?siteId=<string>` | `{ deliveries: [{id, siteId, date, supplier?, items: string[], quantity?, notes?, createdAt}] }` | — | 500: retrieval failed |
| `/deliveries` | POST | `requireAuth` | `{ siteId, date, supplier?, items?, quantity?, notes? }` | `{ delivery: {...} }` | 60 per hour per account | 400: invalid payload; 500: creation failed |
| `/deliveries/:id` | PATCH | `requireAuth` | `{ date?, supplier?, items?, quantity?, notes? }` | `{ delivery: {...} }` | — | 400: invalid payload; 404: delivery not found; 500: update failed |
| `/deliveries/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | — | 404: delivery not found; 500: deletion failed |

---

## Templates (WHS Checklists & Entry Templates)

No auth required for WHS checklists. Entry templates require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/whs-checklists` | GET | None | — | `{ checklists: [{id, name, category, items: string[]}] }` | Always succeeds (5 built-in checklists) |
| `/whs-checklists/:id` | GET | None | — | `{ checklist: {id, name, category, items: string[]} }` | 404: checklist not found |
| `/entry-templates` | GET | `requireAuth` | — | `{ templates: [{id, name, notes?, crewCount?, weather?, createdAt}] }` | 500: retrieval failed |
| `/entry-templates` | POST | `requireAuth` | `{ name, notes?, crewCount?, weather? }` | `{ template: {...} }` | 400: invalid payload; 500: creation failed |
| `/entry-templates/:id` | DELETE | `requireAuth` | — | `{ ok: true }` | 404: template not found; 500: deletion failed |

---

## Location Tracking

All location endpoints require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Error Cases |
|----------|--------|------|---------|----------|-------------|
| `/location/update` | POST | `requireAuth` | `{ latitude (−90 to 90), longitude (−180 to 180), accuracy?, siteId?, userName? }` | `{ ok: true, location: {email, latitude, longitude, accuracy?, siteId?, userName?, updatedAt} }` | 400: invalid coordinates; 500: update failed |
| `/location/workers` | GET | `requireAuth` | — | `{ locations: [{email, latitude, longitude, accuracy?, siteId?, userName?, updatedAt}] }` | 500: retrieval failed |

---

## Push Notifications

All push token endpoints require `requireAuth`.

| Endpoint | Method | Auth | Request | Response | Rate Limit | Error Cases |
|----------|--------|------|---------|----------|------------|-------------|
| `/push/tokens` | POST | `requireAuth` | `{ token: string (min 1), platform?: "expo"|"apns"|"fcm" }` | `{ token: {email, token, platform, createdAt} }` | 10 per hour per account | 400: invalid payload; 500: registration failed |
| `/push/tokens/:token` | DELETE | `requireAuth` | — | `{ ok: true }` | — | 404: token not found; 500: deletion failed |
| `/push/tokens` | GET | `requireAuth` | — | `{ tokens: [{email, token, platform, createdAt}] }` | — | 500: retrieval failed |

---

## Media Uploads

| Endpoint | Method | Auth | Request | Response | Rate Limit | Error Cases |
|----------|--------|------|---------|----------|------------|-------------|
| `/uploads` | POST | `requireAuth` | multipart form-data: `file` (image, ≤10MB) | `{ id, filename, mimetype, size, url: "/api/uploads/:id/:filename", storageKey?, storagePath? }` | 30 per hour per account | 400: missing file; 400: unsupported MIME type (only JPEG, PNG, WebP, GIF, HEIC, HEIF); 500: storage failed |
| `/uploads/sign` | POST | `requireAuth` | `{ paths: string[] (max 50, each "/api/uploads/:id/:filename") }` | `{ signed: [{path, url: signed URL with ?sig=... &exp=..., error?}] }` | — | 400: invalid paths; 400: >50 paths; 500: signing failed |
| `/uploads/:id/:filename` | GET | Bearer token OR signed query params (`?sig=...&exp=...`) | — | Binary image data | — | 401: not authenticated; 404: upload not found; 400: invalid path |

---

## Common Error Response Format

All endpoints return errors in the format:
```json
{
  "error": "Human-readable error message",
  "details": {
    "fieldErrors": {
      "fieldName": ["validation error 1", "validation error 2"]
    }
  }
}
```

The `details` field is only present for 400 validation errors (Zod parse failures).

---

## TODO: unverified

- **Account profile display name vs fullName field consistency:** The auth schema uses `fullName`, but some responses return `name`. Verify field name consistency across all responses.
- **Company profile fields:** `country` field is optional in update but unknown if it's persisted or returned in profile GET.
- **Site invite role assignment:** Site invites reference legacy roles (`worker`, `supervisor`) while company invites use new roles (`manager`, `viewer`, `crew`). Verify whether this is intentional bridging or a schema drift.
- **Diary `generation` metadata:** The DiarySchema does not include a `generation` field with `{generator, model, promptVersion, warning, tokenUsage}`. This is documented in audit finding C1 as a needed addition.
- **Inspection results schema:** The `ResultItemSchema` shape in request vs response may differ; verify that response includes all fields.
- **Entry photos schema:** Photos are typed as `z.array(z.record(z.unknown()))`, which accepts arbitrary objects. The actual shape (with `id`, `uri`, `caption`, etc.) is validated at usage time in ai.ts, not at the schema level.
