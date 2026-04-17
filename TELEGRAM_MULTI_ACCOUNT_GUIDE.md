# Telegram + Multi-Account Social Guide

This guide explains the new multi-client posting flow using:

- Telegram bot commands
- Dashboard UI
- API endpoints
- Multi-account storage (`social_accounts`)

It is designed for SaaS usage where each client links their own account(s) and can post independently.

## What Was Added

### Core features

- Telegram chat to app-user linking via signed `/connect` link
- Per-user social account table (`social_accounts`) for multiple connected pages/accounts
- Default account selection per platform (currently used for Facebook Page posting)
- Dashboard account management UI:
  - list connected accounts
  - set default account
  - remove account
- Telegram commands for account control and posting

### Database changes

Migration: `migrations/0001_social_accounts_telegram.sql`

Adds:

- `users.telegram_chat_id` (nullable, unique when present)
- `social_accounts` table with:
  - `user_id`
  - `platform`
  - `display_name`
  - `external_id`
  - `access_token`
  - `refresh_token`
  - `metadata`
  - `is_default`

## Deployment Checklist

1. Apply migration:

```bash
npm run db:push
```

Or run SQL from `migrations/0001_social_accounts_telegram.sql`.

2. Ensure env vars are set:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_LINK_SECRET=...   # recommended, fallback SESSION_SECRET if missing
CLIENT_URL=https://yourdomain.com
# Optional fallback before chat linking:
TELEGRAM_DEFAULT_USER_ID=2
```

3. Register webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://yourdomain.com/api/integrations/telegram/webhook",
    "secret_token":"<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

4. Restart app server/PM2.

## Client Flow (Recommended)

### Step 1: Connect Telegram chat to account

In Telegram:

```text
/connect
```

Bot returns a signed link:

`https://yourdomain.com/auth?telegram_bind=<token>`

User opens link, logs in/registers in dashboard, then Telegram chat is attached to that user.

### Step 2: Connect Facebook Page in dashboard

Use existing social connection flow in UI to connect Facebook Page.
On callback, the page token is stored and synced to `social_accounts`.

### Step 3: Post from Telegram

In Telegram:

```text
/fb Hello from client account
```

Post is published using that user's default Facebook page account.

## Telegram Commands

- `/start` or `/help`  
  Show command list

- `/connect`  
  Generate secure link to bind current Telegram chat to logged-in dashboard user

- `/status`  
  Show link status + active app user + Facebook readiness

- `/accounts`  
  List connected Facebook page accounts (`social_accounts`) for linked user

- `/defaultfb <id>`  
  Set default Facebook account by social account ID

- `/fb <text>`  
  Publish immediately to default Facebook page

- `/fbdraft <text>`  
  Save Facebook draft without publishing

- `/myposts [count]`  
  List latest posts (default 5, max 10)

- `/deletepost <id>`  
  Delete owned post by ID

- `/ai <prompt>`  
  Generate a Facebook draft text via OpenRouter

## Dashboard Features

`ConnectedAccounts` UI card in dashboard includes:

- social account list
- default badge
- set default button
- remove account button

Notes:

- Default account is used by both dashboard posting and Telegram `/fb`.
- User can switch defaults any time without reconnecting.

## API Endpoints

### Telegram link and account management

- `POST /api/telegram/attach`
  - auth required
  - body: `{ "token": "<telegram_bind_token>" }`
  - verifies signed token and links `users.telegram_chat_id`

- `GET /api/social-accounts`
  - auth required
  - returns current user social accounts

- `DELETE /api/social-accounts/:id`
  - auth required
  - removes account owned by current user

- `POST /api/social-accounts/:id/default`
  - auth required
  - sets selected account as default for that platform

### Existing AI helper

- `POST /api/ai/generate-post`
  - auth required
  - body: `{ prompt, platforms?, tone? }`

## Security Notes

- Never commit `.env` secrets.
- Rotate exposed tokens immediately (`TELEGRAM_BOT_TOKEN`, FB/WA/OpenRouter, etc.).
- Keep webhook secret validation enabled (`TELEGRAM_WEBHOOK_SECRET`).
- Prefer per-chat linking (`/connect`) over global fallback user.

## Platform Support Clarification

- **Facebook Page posting** is supported and implemented in this flow.
- **Facebook personal profile posting** is generally not supported by standard public Graph API publishing flows.

## Quick Troubleshooting

- Bot not replying:
  - check `getWebhookInfo` (`url` must be set)
  - verify webhook secret matches env
  - ensure server route is reachable over HTTPS

- `/fb` fails with not connected:
  - user has no default Facebook social account
  - reconnect Facebook in dashboard or run `/accounts` then `/defaultfb <id>`

- Wrong account posting:
  - check Telegram chat linking with `/status`
  - set expected default with `/defaultfb <id>`
