"use client";
import RequireRole from "@/components/ProtectedRoute";
import AuditLogView from "@/views/admin/audit-log-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <AuditLogView />
    </RequireRole>
  );
}
