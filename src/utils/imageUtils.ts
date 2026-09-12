/**
 * Image optimization & preloading utilities for Expert Trader avatars and platform assets
 */

/**
 * Image optimization & preloading utilities for Expert Trader avatars and platform assets
 */

// Mapping legacy or casual photos to high-resolution portraits of serious professional male traders/executives
const SERIOUS_MALE_TRADER_PHOTO_MAP: Record<string, string> = {
  // Elena legacy -> Dmitri Rostov (serious executive trader in sharp grey suit)
  'photo-1519085360753-af0119f7cbe7': 'https://images.unsplash.com/photo-1566492031773-4f4e44671857',
  // David Chen legacy (casual) -> serious quant trader in navy suit
  'photo-1500648767791-00dcc994a43e': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
  // Sarah Jenkins legacy -> Marcus Jenkins (serious corporate risk executive in dark suit)
  'photo-1472099645785-5658abf4ff4e': 'https://images.unsplash.com/photo-1556157382-97eda2d62296',
  // Old casual/female fallback -> serious executive in charcoal suit & blue tie
  'photo-1534528741775-53994a69daeb': 'https://images.unsplash.com/photo-1560250097-0b93528c311a'
};

export function optimizeTraderImageUrl(url?: string, size = 160): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return `https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&crop=face&w=${size}&h=${size}&q=80&fm=webp`;
  }

  let trimmed = url.trim();

  // Remap any legacy or casual photos to serious professional men portraits
  for (const [legacyId, replacement] of Object.entries(SERIOUS_MALE_TRADER_PHOTO_MAP)) {
    if (trimmed.includes(legacyId)) {
      trimmed = replacement;
      break;
    }
  }

  // If it's an Unsplash image, rewrite query parameters for ultra-compact, high-speed WebP format
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const baseUrl = trimmed.split('?')[0];
      return `${baseUrl}?auto=format&fit=crop&crop=face&w=${size}&h=${size}&q=80&fm=webp`;
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
