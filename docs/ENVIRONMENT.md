# Environment and Deployment Reference

This document lists runtime environment variables used by the current platform.

## Core Runtime

- `DATABASE_URL` - PostgreSQL connection string (required for DB mode)
- `SESSION_SECRET` - Session cookie/signing secret
- `NODE_ENV` - Typical values: `development`, `production`
- `CLIENT_URL` - Frontend base URL
- `BASE_URL` - Optional platform base URL fallback
- `ALLOW_PUBLIC_REGISTRATION` - Optional boolean toggle for registration

## Admin and Notification

- `SUPER_ADMIN_EMAIL` - Seed/reference super-admin notification email
- `DEFAULT_COMPANY_SLUG` - Default company slug fallback
- `NOTIFICATION_FROM_EMAIL` - Notification sender (Resend path)
- `RESEND_API_KEY` - Resend integration key (if using Resend path)

## SMTP (Approval emails, etc.)

- `SMTP_HOST`
- `SMTP_PORT` (default used in code when missing)
- `SMTP_SECURE` (`true/false`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `MAIL_FROM` (fallback)

## Billing (Stripe)

- `STRIPE_SECRET_KEY`
- `STRIPE_ADVANCE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ACCESS_REQUEST_ADVANCE_PRICE_ID` (optional)
- `STRIPE_ACCESS_REQUEST_BASIC_PRICE_ID` (optional)
- `STRIPE_REQUIRE_SUPER_ADMIN_APPROVAL` (optional behavior flag)

## Trial Policy

- `TRIAL_DAYS` - Integer days, defaults to 7 when missing/invalid

## OpenRouter / AI

- `OPENROUTER_API_KEY` (optional platform-level reference key; runtime AI generation is BYOK-gated by user key)
- `OPENROUTER_MODEL` (default model fallback)
- `OPENROUTER_APP_TITLE`

## Social Platform OAuth

### Meta / Facebook / WhatsApp

- `META_PAGE_APP_ID`
- `META_PAGE_APP_SECRET`
- `META_REDIRECT_URI`
- `WHATSAPP_APP_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_REDIRECT_URI`

### LinkedIn

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_PAGE_CLIENT_ID` (optional override)
- `LINKEDIN_PAGE_CLIENT_SECRET` (optional override)
- `LINKEDIN_PAGE_REDIRECT_URI` (optional override)

### Instagram

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI`

### Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Telegram

- `TELEGRAM_BOT_TOKEN` (required to register/operate Telegram webhook with Bot API)
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_DEFAULT_USER_ID`
- `TELEGRAM_LINK_SECRET`

## WhatsApp

- `WHATSAPP_APP_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_REDIRECT_URI`
- Note: variables such as `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, and
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are not currently referenced in server code.

## n8n Integration

- `N8N_ENABLED` (`true/false`)
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_AUTH_TOKEN`
- `N8N_WEBHOOK_AUTH_HEADER`
- `N8N_WEBHOOK_TIMEOUT_MS`

## Script Helpers (Optional)

### Superuser/User management scripts

- `SUPERUSER_USERNAME`
- `SUPERUSER_PASSWORD`
- `SUPERUSER_EMAIL`
- `NEW_USERNAME`
- `NEW_PASSWORD`
- `NEW_EMAIL`
- `REMOVE_OLD_USERS`

### Demo account seed

- `DEMO_SUPER_ADMIN_USERNAME`, `DEMO_SUPER_ADMIN_EMAIL`, `DEMO_SUPER_ADMIN_PASSWORD`
- `DEMO_OWNER_USERNAME`, `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`
- `DEMO_ADMIN_USERNAME`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`
- `DEMO_MODERATOR_USERNAME`, `DEMO_MODERATOR_EMAIL`, `DEMO_MODERATOR_PASSWORD`
- `DEMO_BASIC_USER_USERNAME`, `DEMO_BASIC_USER_EMAIL`, `DEMO_BASIC_USER_PASSWORD`

## Deployment Checklist

1. Set `DATABASE_URL` and `SESSION_SECRET`.
2. Set `CLIENT_URL` and/or `BASE_URL`.
3. Configure Stripe keys if billing is enabled.
4. Configure OAuth app credentials for needed platforms.
5. Configure SMTP (or Resend) for outbound notifications.
6. Run migrations:
   - `npm run db:migrate`
7. Optional: seed demo data in non-production:
   - `npm run seed:demo-accounts`
8. Start app:
   - `npm run dev` (development)
   - `npm run build && npm run start` (production-like)

