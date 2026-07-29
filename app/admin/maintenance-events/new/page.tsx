"use client";
import RequireRole from "@/components/ProtectedRoute";
import MaintenanceEventFormView from "@/views/admin/maintenance-event-form-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <MaintenanceEventFormView />
    </RequireRole>
  );
}
