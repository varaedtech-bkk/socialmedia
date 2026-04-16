# Admin System Documentation

## Overview

The admin system is a comprehensive, config-based management interface with role-based access control (RBAC), user management, feature flags, and system analytics.

## Features

### 1. Role-Based Access Control (RBAC)

The system supports three roles with hierarchical permissions:

- **User** (`user`): Standard user with basic access
- **Admin** (`admin`): Administrator with management capabilities
- **Super Admin** (`super_admin`): Full system access with all permissions

### 2. Admin Dashboard

Accessible at `/admin`, the dashboard includes:

- **Statistics Tab**: System-wide metrics and analytics
- **Users Tab**: User management with search, filtering, and CRUD operations
- **Features Tab**: Feature flag management

### 3. User Management

- View all users with pagination
- Search users by username or email
- Filter by role
- Create new users
- Edit user roles and permissions
- Activate/deactivate users
- Soft delete users

### 4. Feature Flags

- Toggle subscription features
- Enable/disable post quotas
- Control Stripe payment processing
- All changes take effect immediately

### 5. System Statistics

- User counts (total, active, by role)
- Post statistics (total, published, scheduled)
- Subscription metrics
- Role distribution

## Configuration

### Admin Config (`server/admin-config.ts`)

All admin features are defined in a centralized configuration:

```typescript
export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  user: { ... },
  admin: { ... },
  super_admin: { ... }
};

export const ADMIN_FEATURES: AdminFeature[] = [
  { id: "user-management", ... },
  { id: "feature-flags", ... },
  ...
];
```

### Permissions

Permissions are granular and can be assigned to roles:

- `users.view`, `users.create`, `users.edit`, `users.delete`
- `users.manage_roles`
- `features.manage`
- `settings.view`, `settings.edit`
- `analytics.view`
- `posts.moderate`
- `subscriptions.manage`
- `system.manage`

## API Endpoints

### User Management

- `GET /api/admin/users` - List users (paginated, searchable, filterable)
- `GET /api/admin/users/:id` - Get user details
- `POST /api/admin/users` - Create new user
- `PATCH /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Soft delete user

### Feature Flags

- `GET /api/admin/features` - List all feature flags
- `POST /api/admin/features/:key` - Update feature flag

### Statistics

- `GET /api/admin/statistics` - Get system statistics

### Configuration

- `GET /api/admin/config` - Get admin configuration (roles, permissions, available features)

## Security

### Middleware

All admin routes are protected with RBAC middleware:

- `requireAdmin()` - Requires admin or super_admin role
- `requirePermission(permission)` - Requires specific permission
- `requireAnyPermission(...permissions)` - Requires any of the specified permissions

### Access Control

- Routes check user roles and permissions before allowing access
- Users cannot delete their own accounts
- Role hierarchy prevents lower roles from managing higher roles

## Database Schema

### Users Table

Added fields:
- `role`: `text` - User role (user, admin, super_admin)
- `permissions`: `json` - Array of custom permission strings

### App Settings Table

Stores feature flags and system configuration:
- `key`: Feature flag identifier
- `value`: Boolean or JSON value
- `description`: Human-readable description
- `updated_by`: User who last updated
- `updated_at`: Last update timestamp

## Usage

### Setting Up First Super Admin

```bash
# Create a user first (via registration or manage-users script)
yarn create-superuser

# Then set them as super admin
yarn set-super-admin <username>
```

### Managing Users

1. Navigate to `/admin`
2. Click on "Users" tab
3. Use search and filters to find users
4. Click edit icon to modify user
5. Change role, activate/deactivate, or delete

### Managing Feature Flags

1. Navigate to `/admin`
2. Click on "Features" tab
3. Toggle switches to enable/disable features
4. Changes take effect immediately

### Viewing Statistics

1. Navigate to `/admin`
2. View the "Statistics" tab (default)
3. See real-time system metrics

## Frontend Components

### Admin Page (`client/src/pages/admin-page.tsx`)

Main admin interface with:
- Tabbed navigation
- Dynamic feature loading based on permissions
- Real-time updates
- Error handling and loading states

### Components

- `FeatureFlagsTab`: Feature flag management
- `UserManagementTab`: User CRUD operations
- `StatisticsTab`: System statistics display
- `UserCard`: Individual user card with inline editing
- `CreateUserForm`: User creation dialog

## Configuration-Based Design

All admin features are defined in configuration files:

1. **`server/admin-config.ts`**: Roles, permissions, and feature definitions
2. **`server/feature-config.ts`**: Feature flag management
3. **`server/middleware/rbac.ts`**: Access control middleware

This makes it easy to:
- Add new roles
- Modify permissions
- Add new features
- Change access rules

## Extending the System

### Adding a New Role

1. Update `ROLE_CONFIG` in `server/admin-config.ts`
2. Add role to database enum (if using enum)
3. Update UI to show new role

### Adding a New Permission

1. Add permission to `Permission` type in `server/admin-config.ts`
2. Assign to roles in `ROLE_CONFIG`
3. Use in middleware: `requirePermission("new.permission")`

### Adding a New Admin Feature

1. Add feature to `ADMIN_FEATURES` array
2. Create API endpoint in `server/routes-admin.ts`
3. Add UI component/tab in admin page
4. Update permissions as needed

## Best Practices

1. **Always use middleware**: Don't manually check permissions in route handlers
2. **Follow role hierarchy**: Lower roles shouldn't manage higher roles
3. **Soft delete**: Use soft deletes for users to maintain data integrity
4. **Cache feature flags**: Feature flags are cached for performance
5. **Validate inputs**: Use Zod schemas for all inputs
6. **Remove passwords**: Never return passwords in API responses

## Troubleshooting

### User can't access admin panel

- Check user role: `SELECT role FROM users WHERE id = ?`
- Verify role is `admin` or `super_admin`
- Check `canAccessAdmin()` function in `admin-config.ts`

### Permission denied errors

- Check user's role and permissions
- Verify permission is assigned to role in `ROLE_CONFIG`
- Check middleware is correctly applied

### Feature flags not updating

- Check feature flag cache is refreshed
- Verify database update succeeded
- Check `updateFeatureFlag()` function logs

## Migration Notes

After deploying this update:

1. Run database migration: `yarn db:push`
2. Set first super admin: `yarn set-super-admin <username>`
3. Existing users default to `user` role
4. Feature flags are auto-initialized on server startup

