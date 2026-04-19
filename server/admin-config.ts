/**
 * Admin Configuration System
 * 
 * Centralized, config-based system for managing admin features, roles, and permissions.
 * All admin features are defined here and can be easily toggled or extended.
 */

export type UserRole = "user" | "admin" | "super_admin";

export type Permission = 
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "users.manage_roles"
  | "features.manage"
  | "settings.view"
  | "settings.edit"
  | "analytics.view"
  | "posts.moderate"
  | "subscriptions.manage"
  | "system.manage";

export interface RoleConfig {
  role: UserRole;
  label: string;
  description: string;
  permissions: Permission[];
  canManageRoles: boolean;
  canAccessAdmin: boolean;
}

/**
 * Role-based permission configuration
 * This is the single source of truth for all roles and permissions
 */
export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  user: {
    role: "user",
    label: "User",
    description: "Standard user with basic access",
    permissions: [],
    canManageRoles: false,
    canAccessAdmin: false,
  },
  admin: {
    role: "admin",
    label: "Admin",
    description: "Administrator with management capabilities",
    permissions: [
      "users.view",
      "users.edit",
      "features.manage",
      "settings.view",
      "analytics.view",
      "posts.moderate",
    ],
    canManageRoles: false,
    canAccessAdmin: true,
  },
  super_admin: {
    role: "super_admin",
    label: "Super Admin",
    description: "Full system access with all permissions",
    permissions: [
      "users.view",
      "users.create",
      "users.edit",
      "users.delete",
      "users.manage_roles",
      "features.manage",
      "settings.view",
      "settings.edit",
      "analytics.view",
      "posts.moderate",
      "subscriptions.manage",
      "system.manage",
    ],
    canManageRoles: true,
    canAccessAdmin: true,
  },
};

/**
 * Admin feature configuration
 * Define all admin features and their requirements here
 */
export interface AdminFeature {
  id: string;
  label: string;
  description: string;
  icon: string;
  path: string;
  requiredPermissions: Permission[];
  enabled: boolean;
  category: "users" | "features" | "settings" | "analytics" | "system";
}

export const ADMIN_FEATURES: AdminFeature[] = [
  {
    id: "user-management",
    label: "User Management",
    description: "View, create, edit, and manage users",
    icon: "Users",
    path: "/admin/users",
    requiredPermissions: ["users.view"],
    enabled: true,
    category: "users",
  },
  {
    id: "access-requests",
    label: "Access requests",
    description: "Review purchase / access requests and onboard clients",
    icon: "UserCheck",
    path: "/admin/access",
    requiredPermissions: ["users.view"],
    enabled: true,
    category: "users",
  },
  {
    id: "feature-flags",
    label: "Feature Flags",
    description: "Manage application feature flags",
    icon: "Settings",
    path: "/admin/features",
    requiredPermissions: ["features.manage"],
    enabled: true,
    category: "features",
  },
  {
    id: "system-settings",
    label: "System Settings",
    description: "Configure system-wide settings",
    icon: "Cog",
    path: "/admin/settings",
    requiredPermissions: ["settings.view"],
    enabled: true,
    category: "settings",
  },
  {
    id: "analytics",
    label: "System Analytics",
    description: "View system-wide statistics and analytics",
    icon: "BarChart",
    path: "/admin/analytics",
    requiredPermissions: ["analytics.view"],
    enabled: true,
    category: "analytics",
  },
  {
    id: "subscriptions",
    label: "Subscription Management",
    description: "Manage user subscriptions and tiers",
    icon: "CreditCard",
    path: "/admin/subscriptions",
    requiredPermissions: ["subscriptions.manage"],
    enabled: true,
    category: "system",
  },
];

/**
 * Get user's effective permissions based on role and custom permissions
 */
export function getUserPermissions(role: UserRole, customPermissions: string[] = []): Permission[] {
  const roleConfig = ROLE_CONFIG[role];
  const rolePermissions = roleConfig?.permissions || [];
  
  // Combine role permissions with custom permissions
  const allPermissions = [...rolePermissions, ...customPermissions] as Permission[];
  
  // Remove duplicates
  return Array.from(new Set(allPermissions));
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions: string[] = []
): boolean {
  const permissions = getUserPermissions(role, customPermissions);
  return permissions.includes(permission);
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdmin(role: UserRole): boolean {
  return ROLE_CONFIG[role]?.canAccessAdmin || false;
}

/**
 * Check if user can manage roles
 */
export function canManageRoles(role: UserRole): boolean {
  return ROLE_CONFIG[role]?.canManageRoles || false;
}

/**
 * Get available roles for assignment (excluding higher roles)
 */
export function getAssignableRoles(currentUserRole: UserRole): UserRole[] {
  const roleHierarchy: Record<UserRole, number> = {
    user: 1,
    admin: 2,
    super_admin: 3,
  };

  const currentLevel = roleHierarchy[currentUserRole] || 0;
  
  return Object.entries(ROLE_CONFIG)
    .filter(([_, config]) => roleHierarchy[config.role] <= currentLevel)
    .map(([_, config]) => config.role);
}

/**
 * Get features available to user based on permissions
 */
export function getAvailableFeatures(userPermissions: Permission[]): AdminFeature[] {
  return ADMIN_FEATURES.filter(feature => {
    if (!feature.enabled) return false;
    
    // User needs at least one of the required permissions
    return feature.requiredPermissions.some(perm => userPermissions.includes(perm));
  });
}

