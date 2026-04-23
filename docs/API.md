# API Reference (High-Level)

This is a grouped API reference for the current platform implementation.

## Auth and Session

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/user`
- `GET /api/public-config`

## Health

- `GET /health` and `GET /api/health` (liveness)
- `GET /health/ready` and `GET /api/health/ready` (readiness, includes DB connectivity check)

## Access Requests and Onboarding

- `POST /api/access-request`  
  Public access request endpoint (includes device hash handling for abuse controls).

## Billing and Subscription

- `GET /api/billing/config`
- `POST /api/billing/checkout-advance`
- `GET /api/billing/session-status`
- `POST /api/billing/portal-session`
- `GET /api/subscription`
- `POST /api/webhooks/stripe` (registered webhook path)

## Integrations and AI

- `GET /api/integrations/openrouter`
- `PUT /api/integrations/openrouter`
- `GET /api/integrations/n8n/status`
- `POST /api/integrations/n8n/test`
- `POST /api/ai/generate-post`

## Social Accounts

- `GET /api/social-accounts`
- `DELETE /api/social-accounts/:id`
- `POST /api/social-accounts/:id/default`

## Posts

- `POST /api/posts`
- `GET /api/posts`
- `PATCH /api/posts/:id/status`
- `DELETE /api/posts/:postId`

## OAuth/Platform Connect Flows

- `GET /api/auth/:platform`
- `GET /api/facebook/auth/callback`
- `GET /api/auth/linkedin/callback`
- `GET /api/auth/instagram/callback`
- `GET /api/auth/whatsapp/callback`
- `GET /api/auth/callback/google`

## Telegram/Agent

- `POST /api/telegram/attach`
- `POST /api/whatsapp/attach`
- Additional Telegram webhook/chat routes live in `server/routes-telegram.ts`.

## Admin API

### Company-scoped admin

- `GET /api/admin/company/members`
- `PATCH /api/admin/company/members/:userId`
- `PUT /api/admin/company/openrouter-key`
- `GET /api/admin/company/channel-users`
- `PATCH /api/admin/company/channel-users/:id`  
  Toggle active status of a Telegram/WhatsApp mapping (`isActive` kill switch).  
  Enforced by company-admin context in `server/routes-admin.ts`.

### Super-admin/platform admin

- `GET /api/admin/super/companies-overview`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
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

---

For payload/response specifics, see the route handlers in:

- `server/routes.ts`
- `server/routes-admin.ts`
- `server/routes-telegram.ts`

