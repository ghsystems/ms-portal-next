import { useEffect, useState } from "react";
import {
  FALLBACK_SUPPORT_EMAIL,
  fetchPublicSupportEmail,
} from "@/lib/support-contacts";

// Resolves the admin-managed support email for pages that render without a
// valid session (Deactivated / Unauthorized / Auth error). Starts with the
// fallback so the "Contact Support" link is valid on first paint.
export function useSupportEmail(): string {
  const [email, setEmail] = useState(FALLBACK_SUPPORT_EMAIL);
  useEffect(() => {
    let cancelled = false;
    fetchPublicSupportEmail().then((e) => {
      if (!cancelled) setEmail(e);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return email;
}
