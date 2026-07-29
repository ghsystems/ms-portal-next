"use client";
import RequireRole from "@/components/ProtectedRoute";
import SupportContactsView from "@/views/admin/support-contacts-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <SupportContactsView />
    </RequireRole>
  );
}
