import type { NextConfig } from "next";

const AUTH0_DOMAIN = "dev-agyzjncyuayeuo1a.ca.auth0.com";

// Auth0's SPA SDK and the SharePoint file picker both need to reach their own
// origins, so connect-src and frame-src name them explicitly rather than opening
// up to *. Tailwind injects styles at runtime, hence 'unsafe-inline' for styles.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // ponytail: 'unsafe-inline'/'unsafe-eval' are what the Next.js runtime needs without
  // a nonce-injecting middleware. Tighten with a nonce + middleware if a stricter
  // CSP is required for the audit.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  `connect-src 'self' https://${AUTH0_DOMAIN} https://*.sharepoint.com https://graph.microsoft.com https://login.microsoftonline.com`,
  `frame-src 'self' https://${AUTH0_DOMAIN} https://*.sharepoint.com`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Portal responses are per-user; never let a shared cache hold them.
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
