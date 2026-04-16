# Feature Flags Configuration

This document explains how to manage feature flags in the application, specifically for subscription features.

## Overview

Feature flags allow you to enable/disable features without code changes. This is particularly useful for:
- Testing features in production
- Gradually rolling out features
- Temporarily disabling features
- Managing subscription/payment features

## Available Feature Flags

### `subscriptions_enabled`
- **Description**: Enable/disable subscription plans and tier management
- **Default**: `true`
- **Impact**: When disabled, all users get unlimited posts and subscription endpoints return default values

### `post_quota_enabled`
- **Description**: Enable/disable post quota limits based on subscription tiers
- **Default**: `true`
- **Impact**: When disabled, post quota checks are bypassed and all users can post unlimited content

### `stripe_payments_enabled`
- **Description**: Enable/disable Stripe payment processing
- **Default**: `true`
- **Impact**: When disabled, subscription creation and payment webhooks are blocked

## API Endpoints

### Get All Feature Flags
```bash
GET /api/admin/features
```

**Response:**
```json
{
  "features": [
    {
      "key": "subscriptions_enabled",
      "value": true,
      "description": "Enable/disable subscription plans and tier management",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

### Update Feature Flag
```bash
POST /api/admin/features/:key
Content-Type: application/json

{
  "value": false
}
```

**Example:**
```bash
# Disable subscriptions
curl -X POST https://siamshoppinghub.com/api/admin/features/subscriptions_enabled \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{"value": false}'
```

## Database Schema

Feature flags are stored in the `app_settings` table:

```sql
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Behavior When Features Are Disabled

### Subscriptions Disabled
- `/api/subscription` returns unlimited plan with `featureDisabled: true`
- Subscription creation endpoints return `403 Forbidden`
- Frontend shows "Unlimited" instead of plan details
- Upgrade buttons are hidden

### Post Quota Disabled
- Post quota middleware allows all posts
- No rate limiting based on subscription tiers
- Users can post unlimited content

### Stripe Payments Disabled
- Subscription creation blocked
- Payment webhooks rejected
- Stripe checkout sessions cannot be created

## Implementation Details

### Backend
- Feature flags are cached in memory for performance
- Cache is refreshed when flags are updated
- Default values are used if database is unavailable
- Feature flags are initialized on server startup

### Frontend
- Components gracefully handle disabled features
- UI elements are conditionally rendered
- Error messages are user-friendly

## Security Notes

⚠️ **Important**: Currently, any authenticated user can manage feature flags. You should add role-based access control (RBAC) to restrict this to super admins only.

To add super admin check, modify the admin routes in `server/routes.ts`:

```typescript
// Add to user schema
isSuperAdmin: boolean("is_super_admin").default(false)

// Update admin routes
if (!req.user!.isSuperAdmin) {
  return res.sendStatus(403);
}
```

## Usage Examples

### Disable Subscriptions Temporarily
```bash
# Login first
curl -X POST https://siamshoppinghub.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  -c cookies.txt

# Disable subscriptions
curl -X POST https://siamshoppinghub.com/api/admin/features/subscriptions_enabled \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value": false}'
```

### Re-enable Subscriptions
```bash
curl -X POST https://siamshoppinghub.com/api/admin/features/subscriptions_enabled \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value": true}'
```

## Testing

To test feature flag behavior:

1. **Disable subscriptions**: Set `subscriptions_enabled` to `false`
2. **Verify**: Check that `/api/subscription` returns unlimited plan
3. **Verify**: Check that upgrade buttons are hidden in UI
4. **Re-enable**: Set `subscriptions_enabled` to `true`
5. **Verify**: Check that normal subscription behavior returns

