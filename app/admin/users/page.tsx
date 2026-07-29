"use client";
import RequireRole from "@/components/ProtectedRoute";
import UsersView from "@/views/admin/users-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <UsersView />
    </RequireRole>
  );
}
