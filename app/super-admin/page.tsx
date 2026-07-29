"use client";
import RequireRole from "@/components/ProtectedRoute";
import SuperAdminPage from "@/screens/SuperAdminPage";
export default function Page() {
  return (
    <RequireRole allowedRoles={["ghs_super_admin"]}>
      <SuperAdminPage />
    </RequireRole>
  );
}
