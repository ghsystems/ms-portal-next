"use client";
import RequireRole from "@/components/ProtectedRoute";
import P1AccessView from "@/views/admin/p1-access-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <P1AccessView />
    </RequireRole>
  );
}
