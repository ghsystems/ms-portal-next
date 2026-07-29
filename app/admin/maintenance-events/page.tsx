"use client";
import RequireRole from "@/components/ProtectedRoute";
import MaintenanceEventsView from "@/views/admin/maintenance-events-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <MaintenanceEventsView />
    </RequireRole>
  );
}
