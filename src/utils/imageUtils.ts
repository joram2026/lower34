/**
 * Image optimization & preloading utilities for Expert Trader avatars and platform assets
 */

export function optimizeTraderImageUrl(url?: string, size = 160): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&crop=face&w=${size}&h=${size}&q=75&fm=webp`;
  }

  const trimmed = url.trim();

  // If it's an Unsplash image, rewrite query parameters for ultra-compact, high-speed WebP format
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const baseUrl = trimmed.split('?')[0];
      return `${baseUrl}?auto=format&fit=crop&crop=face&w=${size}&h=${size}&q=75&fm=webp`;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function getInitials(name?: string): string {
  if (!name) return 'EX';
  const clean = name.replace(/["'()]/g, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Preload high-priority images into browser memory cache
 */
export function preloadTraderImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  urls.forEach((url) => {
    if (!url) return;
    const optimized = optimizeTraderImageUrl(url, 160);
    const img = new Image();
    img.src = optimized;
  });
}
