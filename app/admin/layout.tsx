"use client";
import RequireRole from "@/components/ProtectedRoute";
import AdminShell from "@/components/admin/admin-shell";

// Loosest gate that can see any admin page (reports is also allowed for ms_team).
// Stricter pages tighten this with their own RequireRole inside the page.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allowedRoles={["ghs_portal_admin", "ghs_super_admin", "ghs_ms_team"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
