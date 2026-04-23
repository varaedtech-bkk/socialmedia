# Platform Review and Technical Details

Date: 2026-04-22  
Project: MultiSocial Studio (`socialmedia`)

> Post-review updates:
> - Channel mapping deactivation toggle is implemented via company admin API/UI.
> - WhatsApp/Telegram linked user resolution uses `agent_channel_users`.
> - Global admin routes are hardened with super-admin vs company-admin separation.

## 1) Executive Overview

MultiSocial Studio is a full-stack social media workspace platform with:

- Session-based authentication
- Multi-platform social account linking/posting
- Role-aware admin and company controls
- Stripe-based Advance billing flow
- 7-day trial policy for eligible client accounts
- BYOK AI policy (OpenRouter key must be user-provided)

This document reflects the current implementation state from code + live smoke testing.

## 2) Current Tech Stack

### Frontend

- React 18 + TypeScript
- Wouter routing
- TanStack Query (server state)
- Tailwind + shadcn/Radix UI

### Backend

- Node.js + Express + TypeScript
- Drizzle ORM + PostgreSQL
- Passport local auth + session cookies
- Stripe SDK/webhooks for billing

### Persistence/Schema

Core tables in `shared/schema.ts`:

- `users`
- `companies`
- `companyMemberships`
- `auditLogs`
- `agentChannelUsers`
- `accessRequests`
- `socialAccounts`
- `subscriptionTiers`
- `subscriptions`
- `posts`
- `platformRateLimits`
- `appSettings`

## 3) Frontend Route Map

Defined in `client/src/App.tsx`:

- Public
  - `/` landing
  - `/auth` login
  - `/request-access` access request
- Protected
  - `/app` dashboard
  - `/dashboard` dashboard alias (added to avoid direct-link 404s)
  - `/integrations`
  - `/billing`
  - `/billing/success`
  - `/analytics`
  - `/admin`

Route guard is handled by `client/src/lib/protected-route.tsx` and redirects unauthenticated users to `/auth`.

## 4) Role and Access Model (Current)

### Global roles

- `super_admin`
- `client`

### Company membership roles

- `owner`
- `moderator`

### Effective behavior

- `super_admin`: full platform admin
- `client + owner`: company admin scope (company tab, member controls, company settings)
- `client + moderator`: normal workspace user, restricted admin actions

Supporting files:

- `server/admin-config.ts`
- `server/routes-admin.ts`
- `client/src/lib/admin-access.ts`
- `client/src/pages/admin-page.tsx`

## 5) Access Request and Onboarding Flow

### Public access request

- User submits `/request-access` form
- Backend endpoint: `POST /api/access-request`
- Device identifier hash is captured for trial abuse controls

### Super admin approval

- Admin endpoint: `POST /api/admin/access-requests/:id/approve`
- Account is provisioned + default company membership is created
- Approval notification email is attempted (SMTP-config dependent)

### Trial policy

Centralized in `server/trial-policy.ts`:

- Default trial: 7 days (`TRIAL_DAYS` env override supported)
- Trial eligibility: non-super-admin + Advance package + no Stripe customer
- Trial expiration computed from account creation time

## 6) Billing and Stripe Model

### Billing endpoints (non-admin side)

- `GET /api/billing/config`
- `POST /api/billing/checkout-advance`
- `GET /api/billing/session-status`
- `POST /api/billing/portal-session`
- `GET /api/subscription` (subscription/trial state)

### Stripe behavior

- Stripe feature availability is dynamically exposed from server config checks
- Billing page displays missing-key warnings when checkout is unavailable
- Portal and checkout actions are role-gated (owner/super admin can manage)

### Webhook and sync

Stripe sync logic resides in `server/stripe-advance.ts` and is wired by API routes.

## 7) AI Access Policy (BYOK Enforced)

Policy is strict Bring-Your-Own-Key:

- AI features require a user-level OpenRouter key
- No company/platform key fallback for generation access
- Trial expiry blocks AI even on Advance if payment required state applies

Relevant files:

- `server/openrouter-headers.ts`
- `server/user-capabilities.ts`
- `server/routes.ts` (`/api/ai/generate-post`, `/api/integrations/openrouter`)
- `client/src/components/post-editor.tsx`

## 8) Admin API Surface (Current)

Major endpoints in `server/routes-admin.ts`:

- Company-scoped controls
  - `GET /api/admin/company/members`
  - `PATCH /api/admin/company/members/:userId`
  - `PUT /api/admin/company/openrouter-key`
  - `GET /api/admin/company/channel-users`
  - `PATCH /api/admin/company/channel-users/:id`
- Super-admin/global controls
  - `GET /api/admin/super/companies-overview`
  - `GET /api/admin/users`
  - `GET /api/admin/users/:id`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:id`
  - `DELETE /api/admin/users/:id` (soft delete)
  - `POST /api/admin/users/:id/restore`
  - `DELETE /api/admin/users/:id/permanent`
  - `GET /api/admin/features`
  - `POST /api/admin/features/:key`
  - `GET /api/admin/statistics`
  - `GET /api/admin/access-requests`
  - `POST /api/admin/access-requests/:id/approve`
  - `POST /api/admin/access-requests/:id/reject`
  - `GET /api/admin/notification-settings`
  - `POST /api/admin/notification-settings`
  - `GET /api/admin/config`

## 9) Migrations and Role Simplification Status

Recent role/billing related migrations include:

- `0005_company_tenants.sql`
- `0006_agent_channel_users.sql`
- `0007_access_request_payments.sql`
- `0008_access_request_device_hash.sql`
- `0009_fix_default_company_roles.sql`
- `0010_simplify_roles.sql`

Role simplification migration intent:

- Global: legacy `user/admin` => `client`
- Company: legacy `owner_admin/admin` => `owner/moderator`

## 10) QA Review Summary (Live Smoke Tests)

### Verified working

- Auth flows (login/logout)
- Protected route behavior for main routes
- `/dashboard` direct navigation now works
- Role-based admin visibility:
  - `owner` can access company admin controls
  - `moderator` receives forbidden admin view
- Billing page role messaging and disabled actions for non-managers

### Fixes applied during QA

- Added `/dashboard` protected alias route
- Updated company context selection to prioritize `owner` membership
- Updated stale UI copy still referencing old admin role wording

## 11) Known Gaps / Risks

- Existing legacy docs are stale relative to current RBAC model (`ADMIN_SYSTEM.md`, parts of `PROJECT_REPORT.md`, etc.)
- Existing TS project-level issue remains in codebase:
  - `TS2802` Set/Map iteration vs target/downlevel config
- Dev server behavior can become confusing with multiple terminals/processes; run one authoritative instance during QA.

## 12) Operational Commands

Common commands (from `package.json`):

- `npm run dev`
- `npm run check`
- `npm run db:migrate`
- `npm run seed:demo-accounts`
- `npm run create-superuser`
- `npm run set-super-admin`

## 13) Recommended Next Documentation Work

1. Replace `README.md` privacy-policy content with actual project setup/readme, and move policy to `PRIVACY_POLICY.md`.
2. Update `ADMIN_SYSTEM.md` to new roles (`super_admin/client`, `owner/moderator`).
3. Add API contract doc (`docs/API.md`) grouped by Auth, Admin, Billing, Integrations.
4. Add deployment/env reference (`docs/ENVIRONMENT.md`) including Stripe/OpenRouter/SMTP requirements.

---

If needed, this file can be split into:

- `docs/ARCHITECTURE.md`
- `docs/RBAC.md`
- `docs/BILLING_AND_TRIAL.md`
- `docs/OPERATIONS.md`

for easier long-term maintenance.

