/**
 * Facebook Pixel tracking helpers.
 * Use these from client components or after the pixel has loaded.
 */

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom',
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

/**
 * Track a standard page view (called automatically on route change by FacebookPixel component).
 * Call this manually if you need to signal a virtual page view.
 */
export function pageview(): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

/**
 * Track a custom Facebook Pixel event (e.g. 'AddToCart', 'Purchase', 'ViewContent').
 * @param name - Standard event name or custom event name
 * @param options - Optional event parameters (e.g. content_ids, value, currency)
 */
export function event(
  name: string,
  options?: Record<string, unknown>
): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    if (options && Object.keys(options).length > 0) {
      window.fbq('track', name, options);
    } else {
      window.fbq('track', name);
    }
  }
}
