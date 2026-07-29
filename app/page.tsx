"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useProfile } from "@/hooks/useProfile";
import DeactivatedPage from "@/screens/DeactivatedPage";
import AuthErrorPage from "@/screens/AuthErrorPage";
import UnauthorizedPage from "@/screens/UnauthorizedPage";
import { Skeleton } from "@/components/ui/skeleton";

function AppLoadingSkeleton() {
  return (
    <div className="space-y-6 p-8" role="status" aria-label="Loading portal">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-3xl" />
      <span className="sr-only">Loading portal</span>
    </div>
  );
}

export default function HomePage() {
  const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();
  const { profile, loadingProfile } = useProfile();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error) {
      // A freshly-activated account (?prompt=login) must not silently inherit
      // another user's SSO session already active in this browser.
      const forceLogin =
        new URLSearchParams(window.location.search).get("prompt") === "login";
      loginWithRedirect(
        forceLogin ? { authorizationParams: { prompt: "login" } } : undefined,
      );
    }
  }, [isLoading, isAuthenticated, error, loginWithRedirect]);

  if (isLoading || loadingProfile) return <AppLoadingSkeleton />;

  if (error) {
    if (/blocked/i.test(error.message)) return <DeactivatedPage />;
    const friendlyMessage = /invalid state/i.test(error.message)
      ? "Your sign-in session was interrupted or expired - this can happen if the login page was refreshed or reopened in another tab. Please try signing in again."
      : error.message;
    return <AuthErrorPage message={friendlyMessage} />;
  }

  if (!isAuthenticated) return <AppLoadingSkeleton />;
  if (!profile) return <UnauthorizedPage />;
  if (profile.is_active === false) redirect("/deactivated");
  if (profile.role === "client_user") redirect("/portal");
  if (profile.role === "ghs_portal_admin" || profile.role === "ghs_super_admin")
    redirect("/admin/users");
  // MS Team's only admin function is report publishing (MSP-005/MSP-014).
  if (profile.role === "ghs_ms_team") redirect("/admin/reports");

  return <UnauthorizedPage />;
}
