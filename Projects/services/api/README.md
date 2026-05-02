# services/api

*formerly services/Api, renamed to lowercase for consistency*

Express API for SiteSnap AI. Contains routes and adapters.

Dev:

- cd services/api
- pnpm install
- pnpm dev

Endpoints:
- GET /api/health
- POST /api/uploads  (form field `file`)
- GET /api/uploads/:id/:filename?authToken=...
- POST /api/ai/generate
- POST /api/auth/register (alias of register/initiate)
- POST /api/auth/register/initiate
- POST /api/auth/register/verify
- POST /api/auth/login
- POST /api/auth/dev-login
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

Auth storage:
- Auth data is persisted in PostgreSQL (`DATABASE_URL`) and schema is auto-initialized on API startup.
- Passwords are stored as salted `scrypt` hashes.
- In non-production without PostgreSQL, auth falls back to a local JSON store under `services/api/data/`.

Password reset delivery providers:
- Email: configure either `RESEND_API_KEY` + `EMAIL_FROM` or `SENDGRID_API_KEY` + `EMAIL_FROM`
- SMS: configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Optional deep-link base for reset messages: `PASSWORD_RESET_URL` (default: `sitesnap://reset-password`)
- Signup verification code expiry: `ACCOUNT_VERIFICATION_TTL_MS` (default: 600000 / 10 minutes)

Production notes:
- In `NODE_ENV=production`, API startup fails fast unless both channels are configured:
  - PostgreSQL `DATABASE_URL`
  - one email provider (`RESEND_API_KEY` or `SENDGRID_API_KEY`) plus `EMAIL_FROM`
  - Twilio SMS (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
- In `NODE_ENV=production`, media storage must be S3-compatible:
  - `MEDIA_STORAGE_PROVIDER=s3`
  - `S3_BUCKET`
  - `S3_REGION`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - optional `S3_ENDPOINT` for R2/MinIO/other S3-compatible providers
- Supported provider env name sets:
  - Generic S3: `S3_*`
  - AWS S3: `MEDIA_STORAGE_PROVIDER=aws` with `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Cloudflare R2: `MEDIA_STORAGE_PROVIDER=r2` with `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- In non-production, missing provider config falls back to local dev codes/tokens returned by auth endpoints.
- In non-production, uploads default to local disk storage under `services/api/storage/uploads/`.

Provider setup links:
- Resend API keys + sending domain: https://resend.com/docs/dashboard/api-keys/introduction
- SendGrid mail send API: https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
- Twilio SMS quickstart: https://www.twilio.com/docs/messaging/quickstart
