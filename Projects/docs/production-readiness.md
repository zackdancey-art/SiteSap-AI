# Production Readiness Baseline

## Security controls

- Enforce signed auth tokens using `AUTH_TOKEN_SECRET`.
- Restrict CORS with `CORS_ALLOWED_ORIGINS`.
- Keep `DATABASE_URL` and provider credentials in secret management (not in source control).
- Rotate secrets every 90 days.

## Role model

- `worker`: create/update own sites, entries, diaries.
- `supervisor`: read all projects, approve diaries, access supervisor reports.
- `admin`: supervisor permissions plus role management.

## Data retention

- Keep operational site data for 7 years unless contract/policy requires longer.
- Keep uploaded photos with diary records under the same retention period.
- Keep auth reset tokens and pending verification records for max 30 minutes.
- Purge transient auth records on each auth flow request (already implemented).

## Backup policy

- Daily database backup with 35-day retention.
- Weekly immutable snapshot with 12-month retention.
- Quarterly restore drill and documented recovery checklist.

## Audit expectations

- Keep request logs for auth and project mutation endpoints.
- Tag logs with timestamp, actor email, role, route, status code.
- Monitor repeated 401/403/429 patterns.
