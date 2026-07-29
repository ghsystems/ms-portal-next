// ponytail: process-local cache — the Management API token is per-app, not per-user,
// so every handler in this instance can share one. Auth0 issues these for 24h;
// re-minting one per request (the old behaviour) burned quota and added a round trip.
let _cached = null;

export async function getAuth0ManagementToken() {
  if (_cached && Date.now() < _cached.expiry - 60_000) return _cached.token;

  const domain = process.env.AUTH0_DOMAIN;
  const resp = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  if (!resp.ok) {
    console.error("[auth0] management token request failed:", await resp.text());
    throw new Error("Failed to get Auth0 management token");
  }

  const data = await resp.json();
  _cached = { token: data.access_token, expiry: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
