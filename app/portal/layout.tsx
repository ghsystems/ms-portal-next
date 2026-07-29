"use client";
import RequireRole from "@/components/ProtectedRoute";
import { PortalProvider } from "@/components/portal/portal-context";
import PortalShell from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allowedRoles={["client_user"]}>
      <PortalProvider>
        <PortalShell>{children}</PortalShell>
      </PortalProvider>
    </RequireRole>
  );
}
