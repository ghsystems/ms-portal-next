/**
 * Verifies an Auth0 RS256 JWT against Auth0's public JWKS endpoint.
 * Throws if the signature is invalid, the token is expired or not yet valid,
 * the issuer doesn't match this Auth0 tenant, or the token wasn't issued for
 * this API.
 *
 * `expectedAudience` is required. Previously it was optional and the audience
 * check was skipped when unset, which meant a missing AUTH0_AUDIENCE env var
 * silently downgraded every endpoint to "any token from this tenant" —
 * including tokens minted for other APIs. It now fails closed.
 */

// ponytail: process-local JWKS cache, 1h TTL. Auth0 rotates signing keys rarely and
// an unknown `kid` forces a refetch below, so a longer TTL just adds staleness risk.
const JWKS_TTL_MS = 60 * 60 * 1000;
const _jwksCache = new Map(); // domain -> { keys, fetchedAt }

async function getSigningKey(auth0Domain, kid) {
  const cached = _jwksCache.get(auth0Domain);
  const fresh = cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS;

  if (fresh) {
    const hit = cached.keys.find((k) => k.kid === kid);
    if (hit) return hit;
    // Unknown kid on a fresh cache means Auth0 rotated keys — fall through and refetch.
  }

  const resp = await fetch(`https://${auth0Domain}/.well-known/jwks.json`);
  if (!resp.ok) throw new Error("Failed to fetch Auth0 JWKS");
  const { keys } = await resp.json();
  _jwksCache.set(auth0Domain, { keys, fetchedAt: Date.now() });

  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error("No matching signing key found in JWKS");
  return jwk;
}

export async function verifyAuth0JWT(token, auth0Domain, expectedAudience) {
  if (!auth0Domain) throw new Error("AUTH0_DOMAIN is not configured");
  if (!expectedAudience) throw new Error("AUTH0_AUDIENCE is not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [headerB64, payloadB64, signatureB64] = parts;

  // base64url → base64: replace URL-safe chars, then pad to a multiple of 4.
  // Missing padding is the most common cause of silent decode errors for the
  // binary signature field (RS256 sigs are 256 bytes → 342 base64url chars,
  // 342 % 4 === 2, so atob needs "==" appended or it decodes wrong bytes).
  const toBase64 = (b64url) => {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    return pad ? b64 + "=".repeat(4 - pad) : b64;
  };
  const decode = (b64url) => atob(toBase64(b64url));
  const decodeBytes = (b64url) =>
    Uint8Array.from(decode(b64url), (c) => c.charCodeAt(0));

  const header = JSON.parse(decode(headerB64));

  // Only RS256 is accepted. The verify below is hard-coded to RSA anyway, but
  // rejecting up front makes the intent explicit and blocks alg-confusion probes.
  if (header.alg !== "RS256") throw new Error("Unsupported JWT algorithm");

  const jwk = await getSigningKey(auth0Domain, header.kid);

  // Import the RSA public key (RS256 = RSASSA-PKCS1-v1_5 + SHA-256)
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Verify the signature over "header.payload"
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = decodeBytes(signatureB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signingInput,
  );
  if (!valid) throw new Error("JWT signature verification failed");

  const payload = JSON.parse(decode(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  const SKEW_SECONDS = 60;

  // Must be present — `undefined < now` is false, so a token with no `exp`
  // used to sail past the expiry check entirely.
  if (typeof payload.exp !== "number") throw new Error("JWT has no expiry");
  if (payload.exp < now - SKEW_SECONDS) throw new Error("JWT has expired");

  if (typeof payload.nbf === "number" && payload.nbf > now + SKEW_SECONDS) {
    throw new Error("JWT is not yet valid");
  }

  if (payload.iss !== `https://${auth0Domain}/`) {
    throw new Error("JWT issuer does not match this Auth0 tenant");
  }

  if (!payload.sub) throw new Error("JWT has no subject");

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(expectedAudience)) {
    throw new Error("JWT was not issued for this API");
  }

  return payload;
}
