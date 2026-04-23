# Production Deployment Runbook - MultiSocial Studio

This runbook provides deterministic steps for a safe first live rollout.  
Always test on staging first.

## Prerequisites

- SSH access to production server
- PostgreSQL database (backup available)
- Environment file: `/var/www/multisocial/.env.production`
- PM2 installed globally (`npm install -g pm2`)

### PM2 log rotation (recommended)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 0) Pre-Deployment Safety

```bash
# Create a database snapshot (if using managed DB, use its backup tool)
pg_dump "postgresql://user:pass@host:5432/dbname" > ~/multisocial_backup_$(date +%Y%m%d_%H%M%S).sql
```

Expected output: `pg_dump: ...` and a backup file created.

## 1) Pull Latest Code

```bash
cd /var/www/multisocial
git pull origin main
```

Expected: `Already up to date.` or a list of updated files.

## 2) Install Dependencies

```bash
npm ci --only=production
# If you need dev dependencies for build:
npm ci
```

Expected: `added X packages in Ys`.

## 3) Run Pre-Deployment Verification

```bash
npm run predeploy:verify
```

Expected output pattern:

```text
Pre-deployment verification

Checking environment variables...
Required env vars: OK

Checking database connectivity...
Database connection: OK

Checking migration markers...
Migration marker tables: OK

Checking critical file paths...
OK server/routes.ts
OK server/routes-admin.ts
OK server/routes-telegram.ts
OK server/auth.ts
OK server/storage.ts

================================================
All checks passed. Ready for deployment.
```

If any check fails, stop and fix.

## 4) Run Database Migrations

```bash
npm run db:migrate
```

Expected: migration success logs, no SQL/runtime errors.

## 5) Build Frontend + Server Bundle

```bash
npm run build
```

Expected: Vite build success + server bundle created in `dist/`.

## 6) Run Deployment Test Suite

Run black-box deployment tests against the running app base URL.

```bash
# Optional when target is not localhost
# export BASE_URL_TEST=https://yourdomain.com

npm run test:deploy
```

Expected: all test groups pass (`test:api`, `test:rbac`, `test:db`, `test:frontend`).
If any group fails, stop and fix before go-live.

## 7) Start Application

### Option A: PM2 (recommended)

```bash
# First time
cp ecosystem.config.example.js ecosystem.config.js
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Subsequent deploys
pm2 restart multisocial
```

Expected: process status `online`.

Check logs for startup errors:

```bash
pm2 logs multisocial --lines 50 --nostream
```

### Option B: systemd

```bash
sudo cp deploy/multisocial.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable multisocial
sudo systemctl start multisocial
sudo systemctl status multisocial --no-pager
```

## 8) Smoke Test (Critical Paths)

Run these from another terminal or with `curl` from the server.

### 8.0 Health Check

```bash
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/health/ready
```

Expected:

- `/api/health` -> HTTP `200`, `{"status":"healthy",...}`
- `/api/health/ready` -> HTTP `200`, `{"status":"ready",...}` when DB is reachable

### 8.1 Auth Flow

```bash
# Login (replace with real credentials)
curl -X POST https://yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_owner","password":"DemoOwner@123"}' \
  -c cookies.txt
```

Expected: HTTP `200`, session established.

```bash
curl -b cookies.txt https://yourdomain.com/api/user
```

Expected: HTTP `200`, user object.

### 8.2 RBAC - Admin Access

As `demo_owner`:

```bash
curl -b cookies.txt https://yourdomain.com/api/admin/company/members
```

Expected: HTTP `200`, members payload.

As `demo_moderator`:

```bash
curl -b cookies.txt https://yourdomain.com/api/admin/company/members
```

Expected: HTTP `403`.

### 8.3 Billing and Trial

```bash
curl -b cookies.txt https://yourdomain.com/api/subscription
```

Expected: HTTP `200`, includes trial/payment fields where applicable.

### 8.4 AI and BYOK

```bash
curl -b cookies.txt -X POST https://yourdomain.com/api/ai/generate-post \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a tweet about AI","platforms":["twitter"]}'
```

Expected:

- HTTP `400/403` without user OpenRouter key
- HTTP `200` with generated draft if key + access conditions are valid

### 8.5 Agent Mapping (Telegram)

- Send `/connect` to Telegram bot
- Open link and login
- Validate mapping:

```bash
curl -b cookies.txt https://yourdomain.com/api/admin/company/channel-users
```

Expected: mapping row with `channel=telegram` and `isActive=true`.

Kill switch test:

```bash
curl -b cookies.txt -X PATCH https://yourdomain.com/api/admin/company/channel-users/{id} \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'
```

Expected: HTTP `200`, updated mapping.

### 8.6 WhatsApp Attach (Endpoint ready; live-number verification pending)

```bash
curl -b cookies.txt -X POST https://yourdomain.com/api/whatsapp/attach \
  -H "Content-Type: application/json" \
  -d '{"token":"..."}'
```

Expected: HTTP `200`, `{ "ok": true, "whatsAppUserId": "..." }` for valid token.

## 9) Post-Deployment Checks

- [ ] Open `https://yourdomain.com`, login with test accounts
- [ ] Verify admin tabs by role (`super_admin` vs owner vs moderator)
- [ ] Create test post via dashboard
- [ ] Send `/post test` via Telegram bot and verify flow
- [ ] Check PM2 logs for warnings/errors

## 10) Rollback Instructions

If critical failure occurs:

```bash
# Stop current version
pm2 stop multisocial

# Restore previous artifact/tag
git checkout <previous-tag>
npm ci && npm run build
pm2 restart multisocial

# Restore DB backup if migration caused breakage
psql -d dbname < ~/multisocial_backup_*.sql
```

## 11) Environment File Setup Reminder

Before first deploy:

```bash
cp .env.production.example .env.production
nano .env.production
```

Then re-run:

```bash
npm run predeploy:verify
```

---

Go/No-Go decision:

- All smoke tests pass -> Go
- Any critical failure -> No-Go, fix and re-validate

