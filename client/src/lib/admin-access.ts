/** Mirrors server `UserRole` / `canAccessAdmin`. */

export type AdminRole = "user" | "admin" | "super_admin";

const ADMIN_PANEL_ROLES: ReadonlySet<string> = new Set(["admin", "super_admin"]);

export function normalizeAdminRole(raw: string | null | undefined): AdminRole {
  if (raw === "super_admin" || raw === "admin" || raw === "user") return raw;
  return "user";
}

export function canAccessAdminPanel(role: string | null | undefined): boolean {
  return ADMIN_PANEL_ROLES.has(normalizeAdminRole(role));
}

export function formatRoleLabel(role: string | null | undefined): string {
  const r = normalizeAdminRole(role);
  const labels: Record<AdminRole, string> = {
    user: "Member",
    admin: "Admin",
    super_admin: "Super admin",
  };
  return labels[r];
}

export function adminPermissionsInclude(
  permissions: string[] | undefined,
  permission: string
): boolean {
  return Boolean(permissions?.includes(permission));
}
