"use client";

import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { clearDismissedMaintenanceEvents } from "@/components/portal/maintenance-events-storage";
import { Toaster } from "@/components/ui/sonner";

function onRedirectCallback(appState?: AppState) {
  // Fires once per completed Auth0 login redirect (not on silent token
  // refresh), so this is the reliable signal for "user just logged in"
  // that the maintenance banner's reappear-on-next-login rule needs.
  clearDismissedMaintenanceEvents();
  window.history.replaceState(
    {},
    document.title,
    appState?.returnTo || window.location.pathname,
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain="dev-agyzjncyuayeuo1a.ca.auth0.com"
      clientId="0Luqjfe6WjA2DSNzq39FPw8UbwW3jC19"
      authorizationParams={{
        redirect_uri:
          typeof window !== "undefined" ? window.location.origin : undefined,
        audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
      <Toaster />
    </Auth0Provider>
  );
}
