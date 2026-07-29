"use client";
import RequireRole from "@/components/ProtectedRoute";
import MSTeamView from "@/views/admin/ms-team-view";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin"]}>
      <MSTeamView />
    </RequireRole>
  );
}
