import { createContext, useContext } from "react";
import type { PortalContextValue } from "@/components/portal/portal-context";

export const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal() {
  const context = useContext(PortalContext);

  if (!context) {
    throw new Error("usePortal must be used within a PortalProvider");
  }

  return context;
}
