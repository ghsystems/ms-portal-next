"use client";
// No extra gate: the admin layout already allows exactly
// [portal_admin, super_admin, ms_team], which matches this route.
import AdminReportsView from "@/views/admin/admin-reports-view";
export default function Page() {
  return <AdminReportsView />;
}
