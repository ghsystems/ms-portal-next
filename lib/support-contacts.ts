import { apiFetch } from "@/lib/api";

export type SupportContacts = {
  managedServicesEmail: string;
  managedServicesPhone: string;
  hotlinePhone: string;
  escalationManagerName: string;
  escalationManagerEmail: string;
  escalationManagerPhone: string;
};

export const defaultSupportContacts: SupportContacts = {
  managedServicesEmail: "managedservices@msportal.example",
  managedServicesPhone: "+1 (800) 555-0199",
  hotlinePhone: "+1 (800) 555-0144",
  escalationManagerName: "Sarah Kim",
  escalationManagerEmail: "sarah.kim@msportal.example",
  escalationManagerPhone: "+1 (647) 555-0112",
};

// Support email used by pages shown before/without a valid session, when the
// admin-managed value can't be read (network error, missing row, etc.).
export const FALLBACK_SUPPORT_EMAIL = "support@ghsystems.com";

// Public (unauthenticated) read of just the support email, for the pre-auth
// error pages. The endpoint returns only that one field — the rest of the
// contact record (phone numbers, escalation manager) needs a session.
export async function fetchPublicSupportEmail(): Promise<string> {
  try {
    const { email } = await apiFetch<{ email: string | null }>("/site-settings?public=1", null);
    return email || FALLBACK_SUPPORT_EMAIL;
  } catch {
    return FALLBACK_SUPPORT_EMAIL;
  }
}

export async function fetchSupportContacts(token: string): Promise<SupportContacts> {
  const { contacts } = await apiFetch<{ contacts: Partial<SupportContacts> | null }>(
    "/site-settings",
    token,
  );
  if (!contacts) return defaultSupportContacts;
  return { ...defaultSupportContacts, ...contacts };
}

export async function saveSupportContacts(token: string, contacts: SupportContacts) {
  await apiFetch("/site-settings", token, {
    method: "PUT",
    body: JSON.stringify(contacts),
  });
}
