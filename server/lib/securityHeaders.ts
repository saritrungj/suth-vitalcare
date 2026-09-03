/**
 * External origins intentionally required by the browser runtime:
 * - Cloudflare Turnstile loads a script and an iframe from challenges.cloudflare.com.
 * - LIFF loads optional extensions and translation data from LINE's CDN hosts.
 * - Cloudflare Web Analytics injects its beacon at the edge.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com https://static.line-scdn.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.line.me https://api.opentyphoon.ai https://challenges.cloudflare.com https://liffsdk.line-scdn.net https://cloudflareinsights.com wss:; frame-src https://challenges.cloudflare.com; upgrade-insecure-requests";
