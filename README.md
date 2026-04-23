# MultiSocial Studio

MultiSocial Studio is a TypeScript full-stack social media workspace platform with role-aware admin controls, Stripe billing, and OpenRouter BYOK AI integration.

## Core Capabilities

- Multi-platform social posting workflow
- Access-request onboarding with super-admin approval
- Trial + Stripe Advance billing flow
- RBAC model:
  - global roles: `super_admin`, `client`
  - company roles: `owner`, `moderator`
- AI generation gated by user-provided OpenRouter API key (BYOK)
- Agent channel mapping for Telegram/WhatsApp with admin deactivation control

## AI Agent (Telegram / WhatsApp)

- Users can link Telegram chat identity via `/connect` flow and attach endpoint.
- Linked chat identities are managed through `agent_channel_users`.
- Company admin UI supports connected user visibility and active/inactive kill switch.
- Moderators can be constrained via per-member AI toggle and platform allowlist.

## Tech Stack

- Frontend: React, Wouter, TanStack Query, Tailwind/shadcn
- Backend: Express, TypeScript, Passport sessions
- Database: PostgreSQL + Drizzle ORM
- Billing: Stripe

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Set required environment variables for:

- Database connection
- Session/auth secrets
- Stripe (if billing enabled)
- OpenRouter integration
- SMTP (optional, for approval notifications)

### 3) Run migrations

```bash
npm run db:migrate
```

### 4) Optional demo seed

```bash
npm run seed:demo-accounts
```

### 5) Start development server

```bash
npm run dev
```

## Useful Scripts

- `npm run dev`
- `npm run check`
- `npm run db:migrate`
- `npm run seed:demo-accounts`
- `npm run create-superuser`
- `npm run set-super-admin`
- `npm run test:deploy`

## Project Documentation

- Platform review: `PLATFORM_REVIEW_2026-04-22.md`
- Admin system: `ADMIN_SYSTEM.md`
- Feature flags: `FEATURE_FLAGS.md`
- API reference: `docs/API.md`
- Environment/deployment: `docs/ENVIRONMENT.md`
- Production deployment checklist: `docs/DEPLOYMENT_CHECKLIST.md`
- Production runbook: `docs/PRODUCTION_RUNBOOK.md`
- Ops templates: `deploy/multisocial.service`, `ecosystem.config.example.js`
- Archived 2025 report: `docs/archive/PROJECT_REPORT_2025.md`
- Privacy policy: `PRIVACY_POLICY.md`

## Notes

- The latest implementation details and QA findings are documented in `PLATFORM_REVIEW_2026-04-22.md`.
- Some docs may still contain historical notes; prioritize `PLATFORM_REVIEW_2026-04-22.md`, `docs/API.md`, and `docs/ENVIRONMENT.md` for current implementation details.
