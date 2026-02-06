/**
 * Canonical site URL for the application.
 * Used for absolute links (product pages, feeds, QR codes, Open Graph, etc.)
 */
export const DEFAULT_SITE_URL = 'https://almnarhome.com';

/**
 * Returns the public site base URL (no trailing slash).
 * Priority: NEXT_PUBLIC_SITE_URL → VERCEL_URL (on Vercel) → DEFAULT_SITE_URL
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return DEFAULT_SITE_URL;
}
