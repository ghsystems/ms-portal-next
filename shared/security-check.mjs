// Run: node shared/security-check.mjs
// Smallest thing that fails if the security-critical logic regresses.
import assert from "node:assert/strict";
import { isAllowedAttachment } from "./servicenow.js";
import { verifyAuth0JWT } from "./verify-jwt.js";

// --- attachment allowlist ---------------------------------------------------
for (const good of ["report.pdf", "Q3 summary.xlsx", "screen-shot.png", "logs.tar.gz"]) {
  assert.equal(isAllowedAttachment(good), true, `expected ${good} to be allowed`);
}
// The extensions the old blocklist missed, plus path traversal.
for (const bad of [
  "payload.html", "icon.svg", "run.hta", "shortcut.lnk", "disk.iso",
  "keys.reg", "script.wsf", "evil.exe", "a.js", "../../etc/passwd",
  "name\nwith-newline.pdf", "noextension",
]) {
  assert.equal(isAllowedAttachment(bad), false, `expected ${bad} to be rejected`);
}

// --- JWT verification fails closed ------------------------------------------
const anyToken = "a.b.c";
await assert.rejects(
  () => verifyAuth0JWT(anyToken, "tenant.auth0.com", undefined),
  /AUTH0_AUDIENCE is not configured/,
  "a missing audience must fail closed, not skip the audience check",
);
await assert.rejects(
  () => verifyAuth0JWT(anyToken, undefined, "https://api"),
  /AUTH0_DOMAIN is not configured/,
);
await assert.rejects(
  () => verifyAuth0JWT("not-a-jwt", "tenant.auth0.com", "https://api"),
  /Malformed JWT/,
);
// alg confusion: header says HS256, must be refused before any key handling.
const hs256 = `${Buffer.from(JSON.stringify({ alg: "HS256", kid: "k" })).toString("base64url")}.e30.sig`;
await assert.rejects(
  () => verifyAuth0JWT(hs256, "tenant.auth0.com", "https://api"),
  /Unsupported JWT algorithm/,
);

console.log("security-check: all assertions passed");
