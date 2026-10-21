import type { Analytics } from './types';

interface DataLayerWindow {
  dataLayer?: unknown[];
}

/**
 * Event tracking that works with whatever is installed:
 *  - window.dataLayer (Google Tag Manager / GA4) when present
 *  - a first-party endpoint (Cloudflare Worker) via sendBeacon
 *  - nothing, if neither is configured
 */
export function createAnalytics(opts: {
  gameId: string;
  endpoint?: string;
}): Analytics {
  const queue: { event: string; props: Record<string, unknown> }[] = [];

  const flush = () => {
    if (!opts.endpoint || queue.length === 0) return;
    const body = JSON.stringify({ gameId: opts.gameId, events: queue.splice(0, queue.length) });
    try {
      navigator.sendBeacon?.(opts.endpoint, new Blob([body], { type: 'application/json' }));
    } catch {
      /* ignore */
    }
  };

  setInterval(flush, 15_000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return {
    track(event, props = {}) {
      const dl = (window as unknown as DataLayerWindow).dataLayer;
      if (dl) {
        dl.push({ event, game: opts.gameId, ...props });
        return;
      }
      queue.push({ event, props });
      if (queue.length > 40) flush();
    },
  };
}
