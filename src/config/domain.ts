export const APP_DOMAIN = 'cmel.site';
export const APP_URL = 'https://cmel.site';

/**
 * Returns the preferred base URL for the application.
 * When deployed to Vercel with cmel.site, it resolves to https://cmel.site.
 * If running on a staging domain, defaults to https://cmel.site so shared links point to the official domain.
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('cmel.site')) {
      return origin;
    }
  }
  return APP_URL;
}
