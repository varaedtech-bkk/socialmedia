# Admin System Documentation

## Overview

The admin system combines platform-level controls and company-level controls under one `/admin` route with role-aware visibility.

It is built on:

- Config-based permissions (`server/admin-config.ts`)
- RBAC middleware (`server/middleware/rbac.ts`)
- Route-level checks in `server/routes-admin.ts`
- Role-aware UI in `client/src/pages/admin-page.tsx`

## RBAC Model (Current)

### Global Roles

- `super_admin`
- `client`

### Company Membership Roles

- `owner`
- `moderator`

### Access Behavior

- `super_admin`: full platform admin access
- `client + owner`: company admin access (company tab, member controls)
- `client + moderator`: restricted access (cannot manage admin-only controls)

## Admin Surface

### Platform Admin (super admin)

Primary capabilities:

- User lifecycle management (create, update, soft delete, restore, permanent delete)
- Access request approvals/rejections
- Feature flag management
- Statistics and system-level configuration
- Super-company overview

Key endpoints:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/restore`
- `DELETE /api/admin/users/:id/permanent`
- `GET /api/admin/access-requests`
- `POST /api/admin/access-requests/:id/approve`
- `POST /api/admin/access-requests/:id/reject`
- `GET /api/admin/features`
- `POST /api/admin/features/:key`
- `GET /api/admin/statistics`
- `GET /api/admin/super/companies-overview`
- `GET /api/admin/config`

### Company Admin (owner)

Primary capabilities:

- Manage company members and controls
- Toggle member-level AI/platform permissions
- Manage company-level OpenRouter reference key
- Manage linked channel users
- Deactivate/reactivate linked Telegram/WhatsApp mappings (kill switch)

Key endpoints:

- `GET /api/admin/company/members`
- `PATCH /api/admin/company/members/:userId`
- `PUT /api/admin/company/openrouter-key`
- `GET /api/admin/company/channel-users`
- `PATCH /api/admin/company/channel-users/:id`

## Permissions Configuration

Defined in `server/admin-config.ts`.

Global permission keys include:

- `users.view`, `users.create`, `users.edit`, `users.delete`, `users.manage_roles`
- `features.manage`
- `settings.view`, `settings.edit`
- `analytics.view`
- `posts.moderate`
- `subscriptions.manage`
- `system.manage`

`super_admin` receives the full configured permission set. `client` has no platform-admin permissions by default.

## Middleware and Enforcement

Primary middleware:

- `requireAdmin()`
- `requirePermission(permission)`
- `requireAnyPermission(...permissions)`

Additional enforcement is implemented inside handlers for ownership checks and company-role constraints.

## Frontend Admin UX

`client/src/pages/admin-page.tsx` renders role-specific tabs and content:

- Super admin sees platform tabs (overview/users/access/settings/features)
- Company owner sees company administration tab
- Non-eligible roles receive forbidden admin state

Related components:

- `client/src/components/admin-user-management-tab.tsx`
- `client/src/components/admin-access-requests-tab.tsx`
- `client/src/components/admin-feature-flags-tab.tsx`
- `client/src/components/admin-statistics-tab.tsx`
- `client/src/components/admin-company-members-tab.tsx`
- `client/src/components/admin-super-company-directory-tab.tsx`

## Data Notes

- Global role is stored on `users.role`
- Company role is stored on `company_memberships.role`
- Channel user mappings are stored in `agent_channel_users` with `isActive` state
- User lifecycle supports soft delete and restore flows
- Audit events are captured via `audit_logs`

## Operations

### Set up super admin

```bash
npm run create-superuser
npm run set-super-admin <username>
```

### Migrate schema

```bash
npm run db:migrate
```

### Seed demo accounts

```bash
npm run seed:demo-accounts
```

## Troubleshooting

### Owner cannot access company admin

- Confirm user has active `company_memberships` row with role `owner`
- Confirm session user role is `client` or `super_admin`
- Re-seed demo accounts if testing locally

### Super admin cannot access platform admin

- Confirm `users.role = 'super_admin'`
- Verify `/api/admin/config` returns expected permissions

### Feature flags appear stale

- Re-check `app_settings` rows
- Verify update endpoint returns success


