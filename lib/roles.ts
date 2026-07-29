export type AppRole =
  | "client_user"
  | "ghs_portal_admin"
  | "ghs_ms_team"
  | "ghs_super_admin";

export function canAccessAdmin(role: AppRole) {
  return role === "ghs_portal_admin" || role === "ghs_super_admin";
}

export function canPublishReports(role: AppRole) {
  return (
    role === "ghs_ms_team" ||
    role === "ghs_portal_admin" ||
    role === "ghs_super_admin"
  );
}

export function isSuperAdmin(role: AppRole) {
  return role === "ghs_super_admin";
}
