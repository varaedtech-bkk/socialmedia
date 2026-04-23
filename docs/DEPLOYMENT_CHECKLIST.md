# Production Deployment Checklist

This checklist is tailored to the current MultiSocial Studio implementation and recent RBAC/agent updates.

## 0) Scope and Precision Notes

- `POST /api/whatsapp/attach` is implemented and auth-guarded.
- Full WhatsApp Business posting is **pending live-number verification**.
- The `TS2802` TypeScript issue is pre-existing and out of this delivery scope.

---

## 1) Pre-Deployment Preparation

### 1.1 Backup and Branch Safety

- [ ] Backup production database.
- [ ] Confirm current commit hash/tag to deploy.
- [ ] Confirm rollback target tag/commit is known.

### 1.2 Environment Variables (Required)

Set these before deploy:

### Core

- [ ] `DATABASE_URL`
- [ ] `SESSION_SECRET`
- [ ] `CLIENT_URL` and/or `BASE_URL`
- [ ] `NODE_ENV=production`

### Stripe (if billing enabled)

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_ADVANCE_PRICE_ID`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_ACCESS_REQUEST_ADVANCE_PRICE_ID` (optional)
- [ ] `STRIPE_ACCESS_REQUEST_BASIC_PRICE_ID` (optional)
- [ ] `STRIPE_REQUIRE_SUPER_ADMIN_APPROVAL` (optional)

### Trial and AI

- [ ] `TRIAL_DAYS` (optional; defaults to 7)
- [ ] `OPENROUTER_MODEL` (optional)
- [ ] `OPENROUTER_APP_TITLE` (optional)
- [ ] `OPENROUTER_API_KEY` (optional platform-level reference; runtime AI remains BYOK user-key gated)

### Admin/Email

- [ ] `SUPER_ADMIN_EMAIL` (recommended)
- [ ] `DEFAULT_COMPANY_SLUG` (optional)
- [ ] SMTP or Resend credentials configured:
  - SMTP route: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`/`MAIL_FROM`
  - Resend route (if used): `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`

### OAuth / Platform Integrations

- [ ] `META_PAGE_APP_ID`, `META_PAGE_APP_SECRET`, `META_REDIRECT_URI`
- [ ] `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_REDIRECT_URI`
- [ ] `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`
- [ ] `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### Telegram

- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `TELEGRAM_WEBHOOK_SECRET`
- [ ] `TELEGRAM_LINK_SECRET` (or fallback to `SESSION_SECRET`)
- [ ] `TELEGRAM_DEFAULT_USER_ID` (optional fallback)

### WhatsApp Verification Status

- [ ] WhatsApp Cloud/app credentials present
- [ ] Live verified business number connected
- [ ] Webhook verification path validated
- [ ] Mark deployment status:
  - [ ] Verified in sandbox only
  - [ ] Verified in production with live number

---

## 2) Deployment Command Order

From project root:

1) Install dependencies

```bash
npm install
```

2) Run database migrations (mandatory)

```bash
npm run db:migrate
```

3) Optional seed (non-production only)

```bash
npm run seed:demo-accounts
```

4) Build

```bash
npm run build
```

5) Start/restart app

```bash
npm run start
```

---

## 3) Post-Deploy Smoke Test (Critical)

### 3.1 Auth and Routing

- [ ] `/auth` loads
- [ ] login works
- [ ] `/app` loads for authenticated users
- [ ] `/dashboard` alias works
- [ ] unauthenticated protected route redirects to `/auth`

### 3.2 RBAC

- [ ] super admin sees platform admin tabs at `/admin`
- [ ] company owner sees company admin controls
- [ ] moderator receives forbidden state on restricted admin surface

### 3.3 Billing and Trial

- [ ] `/billing` loads role-appropriate controls
- [ ] checkout disabled/enabled based on Stripe config + role
- [ ] trial fields present in subscription payload and UI messaging

### 3.4 AI / BYOK

- [ ] `/api/integrations/openrouter` reflects user key state
- [ ] AI generation blocked without user key
- [ ] AI generation blocked where per-member AI toggle disables access

### 3.5 Agent Mapping and Kill Switch

- [ ] `/api/telegram/attach` works with valid bind token
- [ ] `/api/whatsapp/attach` works with valid bind token
- [ ] `GET /api/admin/company/channel-users` lists mappings
- [ ] `PATCH /api/admin/company/channel-users/:id` can deactivate mapping
- [ ] deactivated mapping is blocked at runtime

---

## 4) Rollback Plan

If deployment fails:

1) Stop new app instance/process.
2) Re-deploy previous known-good artifact/tag.
3) Revert environment changes if they caused regression.
4) If migration introduced an issue, restore DB from backup/snapshot.
5) Re-run smoke checks on rolled-back version.

Important:

- Never run destructive DB operations without backup confirmation.
- Keep a changelog of env var edits for rapid rollback.

---

## 5) Operational Handoff Notes

- Canonical implementation docs:
  - `PLATFORM_REVIEW_2026-04-22.md`
  - `ADMIN_SYSTEM.md`
  - `docs/API.md`
  - `docs/ENVIRONMENT.md`
- Agent behavior and connect flow details:
  - `TELEGRAM_MULTI_ACCOUNT_GUIDE.md`
- Archived historical report:
  - `docs/archive/PROJECT_REPORT_2025.md`

