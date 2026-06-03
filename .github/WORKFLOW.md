# SiteSnap AI — Product Workflow

SiteSnap AI is a construction site management platform. Workers log daily site activity on mobile; AI generates professional site diaries from those logs. Supervisors review and approve reports from the web dashboard.

---

## Core User Journeys

### 1. Onboard a Company

1. Supervisor creates account (email must be in `SUPERVISOR_SIGNUP_EMAILS` env var, or admin promotes later)
2. Admin invites workers via the **Bulk Invite** screen (Settings → Team → Invite Workers) — accepts a list of emails/names
3. Each worker receives an email with a sign-up link and joins the company

### 2. Create a Site (worker or supervisor)

1. Open the mobile app → Sites tab → **+ New Site**
2. Fill in: Site Name, Client, Address, Start Date, **Job Number** (used for timesheets), Status
3. Site appears in the worker's site list and the supervisor's dashboard

### 3. Log a Daily Entry (worker)

1. Select a site → tap **Log Entry**
2. Fill in: Date, Address/Location (auto-complete), Weather (tap chip or auto-fill via GPS), Crew Count, **Time Code** (payroll code e.g. `ST`, `OT`, `DT`), Hours Worked, Notes
3. Add photos — tap **Camera** or **Gallery**; tap any photo to **Draw / Annotate** on it before saving
4. Tap **Save Entry** — the entry is uploaded immediately (queued offline if no connection)

### 4. Generate an AI Site Diary

1. Open a site → tap **Generate Diary**
2. Choose period: Daily / Weekly / Monthly
3. AI (via OpenAI) reads all entries and photos for the period and produces:
   - Executive summary
   - Per-day work-completed sections with photo analysis
   - Safety checklist
4. Draft diary appears in the **Diary** tab with status `draft`

### 5. Approve & Sign a Diary (supervisor)

1. Supervisor opens the web dashboard or mobile supervisor view
2. Reviews the diary, edits any section if needed
3. Taps **Approve & Sign** — diary status changes to `approved`, signed-by and signed-at are recorded
4. Diary is available for PDF export and sharing

### 6. Export

1. Open a site → **Export Diaries**
2. Choose date range and diaries
3. App generates a PDF (via expo-print) and opens the system share sheet

### 7. Timesheet Reporting

1. Entries carry a **Job Number** (inherited from the site) and a **Time Code** + **Hours Worked**
2. Supervisor opens the web dashboard → **Timesheets** tab
3. Filter by site, date range, worker; export as CSV

---

## AI Flow (Backend)

```
POST /api/entries          ← worker logs entry (notes + photos)
        │
        ▼
POST /api/diaries/generate ← worker or supervisor triggers generation
        │
        ▼
aiService.generateDiary()
  ├── collects entries + photos for the requested period
  ├── calls OpenAI GPT-4o with structured prompt
  ├── parses JSON response into DiaryRecord sections
  └── saves draft diary to DB
        │
        ▼
PATCH /api/diaries/:id/approve  ← supervisor approves
```

---

## Role Matrix

| Action | Worker | Supervisor | Admin |
|---|---|---|---|
| Create/edit own sites & entries | ✓ | ✓ | ✓ |
| View all sites & entries | — | ✓ | ✓ |
| Generate diary | ✓ | ✓ | ✓ |
| Approve diary | — | ✓ | ✓ |
| Invite workers (bulk) | — | ✓ | ✓ |
| Change user roles | — | — | ✓ |
| Access supervisor dashboard | — | ✓ | ✓ |

---

## Data Flow Diagram

```
Mobile App                    API Server                    Database
──────────                    ──────────                    ────────
[New Entry Form]
  ↓ POST /api/entries         → validate + store            project_entries
  ↓ Photos (base64)           → upload to storage           /storage/photos/

[Generate Diary button]
  ↓ POST /api/diaries/gen     → aiService.generateDiary()   project_diaries
                                  ↓ OpenAI API

[Supervisor Approve]
  ↓ PATCH /api/diaries/:id    → update status + signed_by   project_diaries
```

---

## Environment Variables (required)

| Variable | Purpose |
|---|---|
| `AUTH_TOKEN_SECRET` | JWT signing secret (min 32 chars) |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | AI diary generation |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `SUPERVISOR_SIGNUP_EMAILS` | Comma-separated emails that auto-get supervisor role |
| `SMTP_HOST / SMTP_USER / SMTP_PASS` | Email verification & invites |
| `TWILIO_*` | SMS verification |

---

## Development Quick-Start

```bash
cd Projects
pnpm install
pnpm run dev:api          # start API on :4000
pnpm run dev:mobile       # start Expo dev server
```

Tests run automatically on `git commit` via the pre-commit hook.
To run manually: `pnpm run test`
