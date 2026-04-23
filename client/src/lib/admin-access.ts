/** Mirrors server `UserRole` / `canAccessAdmin`. */

export type AdminRole = "client" | "super_admin";
export type CompanyMembershipRole = "owner" | "moderator";

const ADMIN_PANEL_ROLES: ReadonlySet<string> = new Set(["super_admin"]);

export function normalizeAdminRole(raw: string | null | undefined): AdminRole {
  if (raw === "super_admin") return raw;
  return "client";
}

export function canAccessAdminPanel(
  role: string | null | undefined,
  companyRole?: string | null
): boolean {
  if (ADMIN_PANEL_ROLES.has(normalizeAdminRole(role))) return true;
  return companyRole === "owner";
}

export function formatRoleLabel(role: string | null | undefined): string {
  const r = normalizeAdminRole(role);
  const labels: Record<AdminRole, string> = {
    client: "Client",
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
