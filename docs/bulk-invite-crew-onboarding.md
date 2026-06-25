# Bulk Invite / Crew Onboarding — Implementation Plan

## Problem

Today, project sites are owned by a single `owner_email`. Workers can only see their own records; supervisors and admins see everything globally. There is no way to:

- Grant a worker access to a specific site without making them a supervisor/admin
- Invite multiple workers to a site in one action
- Track who has been invited vs. who has accepted

---

## Proposed Model

Add two new tables and extend the access control check in `projectsStore.ts`.

### New tables

```sql
-- Pending invitations (not yet accepted)
CREATE TABLE IF NOT EXISTS site_invites (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',  -- role to assign on accept
  token TEXT NOT NULL UNIQUE,           -- single-use accept token
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_invites_site_email
  ON site_invites(site_id, invited_email);

-- Accepted memberships
CREATE TABLE IF NOT EXISTS site_members (
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  invited_by TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, member_email)
);
CREATE INDEX IF NOT EXISTS idx_site_members_email
  ON site_members(member_email);
```

### Access control change

In `projectsStore.ts`, the helper `canAccessOwner` currently returns `true` only for the owner or an elevated role (supervisor/admin). Extend it to also return `true` when a `site_members` row exists for the actor:

```typescript
// New function — checked per-site, not per-record owner
async function isSiteMember(actorEmail: string, siteId: string): Promise<boolean> {
  if (!useDatabase()) {
    return memory.siteMembers.has(`${siteId}:${actorEmail}`);
  }
  const r = await getPgPool().query(
    `SELECT 1 FROM site_members WHERE site_id=$1 AND member_email=$2 LIMIT 1`,
    [siteId, actorEmail]
  );
  return (r.rowCount ?? 0) > 0;
}
```

`listEntries`, `createEntry`, `listDiaries`, etc. already filter by `owner_email`. A simpler approach that avoids rewriting all queries: when a worker creates an entry on an invited site, set `owner_email` to their own email (unchanged). Access queries add a sub-select join against `site_members` so a member can read entries from all members of that site.

---

## API Endpoints

Mount under `projectsRouter` (`requireAuth` already applied).

| Method | Path | Who | Action |
|--------|------|-----|--------|
| `POST` | `/projects/sites/:siteId/invites` | supervisor/admin or site owner | Create one or more invitations |
| `GET` | `/projects/sites/:siteId/invites` | supervisor/admin or site owner | List pending invitations |
| `DELETE` | `/projects/sites/:siteId/invites/:inviteId` | supervisor/admin or site owner | Revoke an invitation |
| `GET` | `/projects/sites/:siteId/members` | supervisor/admin or site owner | List accepted members |
| `DELETE` | `/projects/sites/:siteId/members/:email` | supervisor/admin or site owner | Remove a member |
| `POST` | `/projects/invites/accept` | any authenticated user | Accept an invite by token |

### POST `/projects/sites/:siteId/invites`

Request body:
```json
{
  "emails": ["alice@site.com", "bob@site.com"],
  "role": "worker"
}
```

- Validate caller is owner or elevated role.
- For each email: upsert `site_invites` row; generate a 32-byte random token; set `expires_at = NOW() + 7 days`.
- Send invitation email via Resend with a deep-link: `sitesnap://invite?token=<token>` (or a web fallback URL).
- Return `{ invited: [{email, status: "sent"|"already_member"|"resent"}] }`.
- Rate-limited: max 20 invites per 10 minutes per account (`LIMITS.bulkInvitePerAccount`).

### POST `/projects/invites/accept`

Request body:
```json
{ "token": "<32-byte hex>" }
```

- Look up `site_invites` by token; reject if expired or not found.
- Verify `req.auth.email === invited_email` (invites are non-transferable).
- Insert `site_members` row; delete the `site_invites` row.
- Return `{ siteId, siteName, role }`.

---

## Email Template

```
Subject: You've been invited to join [Site Name] on SiteSnap

Hi [name],

[InviterName] has invited you to collaborate on [Site Name] as a [role].

Tap the button below in the SiteSnap app to accept:

[Accept Invitation →]   (deep link: sitesnap://invite?token=<token>)

This invitation expires in 7 days.
```

Reuse the existing Resend client (`src/utils/email.ts`).

---

## In-Memory Fallback

Add to `MemoryState` and `MemoryJson`:
```typescript
siteMembers: Map<string, SiteMemberRecord>   // key = `${siteId}:${email}`
siteInvites: Map<string, SiteInviteRecord>   // key = token
```

Persist via `FileBackedStore` (same pattern as templates).

---

## Mobile Changes

### Accept flow (deep-link)
- Register `sitesnap://invite` scheme in `app.config.ts`.
- `app/invite.tsx` (new screen): reads `?token=` from the URL, calls `POST /api/projects/invites/accept`, then navigates to the newly accessible site.
- `expo-linking` is already a dependency.

### Invite-from-app UI
- `app/(tabs)/sites/[id]/invite.tsx` (new screen): text area for pasting/typing emails (one per line), role selector (Worker / Supervisor), Submit button.
- Only rendered/linked for owners and elevated roles.
- Calls `POST /api/projects/sites/:id/invites`.
- Shows per-email result: sent / already a member / resent.

### Members list
- Add a "Team" tab or section on the site detail screen.
- Fetches `GET /api/projects/sites/:id/members`.
- Shows each member's name, email, role, and join date.
- Owner/supervisor can tap a member to remove them.

---

## Data-Context Changes

```typescript
// New functions on DataContextType
inviteCrewMembers: (siteId: string, emails: string[], role: string) => Promise<InviteResult[]>;
acceptInvite: (token: string) => Promise<{ siteId: string; siteName: string }>;
getSiteMembers: (siteId: string) => Promise<SiteMember[]>;
removeSiteMember: (siteId: string, email: string) => Promise<void>;
```

No local cache needed for invites (they're low-frequency and server-authoritative). Members list is fetched on-demand.

---

## Migration File

`Projects/services/api/src/storage/migrations/004_add_site_membership.sql`

---

## Estimated Implementation Scope

| Area | Files | Complexity |
|------|-------|------------|
| DB migration | 1 new file | Low |
| Store functions | `projectsStore.ts` | Medium — 6 new functions + access control |
| API routes | `projects.ts` | Medium — 6 new routes + validation |
| Email template | `email.ts` or inline | Low |
| Rate limit config | `rateLimit.ts` | Low — 1 new LIMITS key |
| Mobile deep-link | `app/invite.tsx` | Low |
| Mobile invite UI | `app/(tabs)/sites/[id]/invite.tsx` | Medium |
| Mobile members list | existing site detail screen | Low |
| Data context | `data-context.tsx` | Low |

Total: ~600–800 lines of new code across ~8 files. Recommend splitting into two PRs:
1. **API-only** (migration + store + routes + email) — testable with Postman/curl
2. **Mobile** (deep-link + invite screen + members list) — after API is merged and deployed

---

## Out of Scope (for later)

- Per-site role granularity (e.g., a user is "supervisor" on site A but "worker" on site B) — current global role in JWT is sufficient for V1
- Invite acceptance without creating an account (anonymous claim flow)
- Push notifications for invite delivery
