export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

/**
 * All portal data goes through the API, which authorises with the service role
 * behind a verified Auth0 token. The browser never talks to Supabase directly:
 * Supabase can't validate an Auth0 JWT, so those requests arrived as the
 * anonymous role and only worked while RLS was left open.
 */
export async function apiFetch<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error ?? `Request failed (${resp.status})`);
  return data as T;
}
