# API Contracts (v1)

Base URL: `/api`

## Auth

- `POST /auth/register/initiate`
- `POST /auth/register/verify`
- `POST /auth/login`
- `GET /auth/me` (Bearer token)
- `PATCH /auth/profile` (Bearer token)
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## Projects (Bearer token required)

- `GET /projects/bootstrap`
- `GET /projects/summary`
- `GET /projects/sites`
- `POST /projects/sites`
- `DELETE /projects/sites/:id`
- `GET /projects/entries?siteId=<id>`
- `POST /projects/entries`
- `PATCH /projects/entries/:id`
- `DELETE /projects/entries/:id`
- `GET /projects/diaries?siteId=<id>`
- `POST /projects/diaries`
- `PATCH /projects/diaries/:id`
- `GET /projects/reports/supervisor` (role: `supervisor|admin`)

## Role behavior

- Worker: can mutate only owned records; cannot approve diaries.
- Supervisor/Admin: can read all records and approve diaries.
