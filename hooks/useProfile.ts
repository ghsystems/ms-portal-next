import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiFetch } from "@/lib/api";
import type { AppRole } from "@/lib/roles";

export type Profile = {
  auth0_user_id: string;
  email: string;
  role: AppRole;
  client_id: string | null;
  is_active: boolean;
  p1_authorized: boolean;
};

export function useProfile() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (isLoading) return;

      if (!isAuthenticated) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      try {
        const token = await getAccessTokenSilently();
        // The profile is resolved server-side from the verified token's `sub`.
        // The old email-fallback lookup ran in the browser and would hand back
        // whatever profile matched the address, including an administrator's.
        const { profile: data } = await apiFetch<{ profile: Profile }>("/profile", token);
        setProfile(data);
      } catch (err) {
        console.error(err);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  return { profile, loadingProfile };
}
