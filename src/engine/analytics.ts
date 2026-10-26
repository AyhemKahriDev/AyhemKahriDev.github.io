import type { Analytics } from './types';

interface DataLayerWindow {
  dataLayer?: unknown[];
}

/**
 * Event tracking that works with whatever is installed:
 *  - window.dataLayer (Google Tag Manager / GA4) when present
 *  - a first-party endpoint (Cloudflare Worker) via sendBeacon
 *  - nothing, if neither is configured
 *
 * With neither configured - the default, and the whole point of this site -
 * nothing is queued at all. Events used to accumulate in an array that could
 * never drain because there was no endpoint to drain to.
 */
export function createAnalytics(opts: {
  gameId: string;
  endpoint?: string;
}): Analytics {
  const queue: { event: string; props: Record<string, unknown> }[] = [];
  const endpoint = opts.endpoint?.trim() || '';

  const flush = () => {
    if (!endpoint || queue.length === 0) return;
    const body = JSON.stringify({ gameId: opts.gameId, events: queue.splice(0, queue.length) });
    try {
      navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }));
    } catch {
      /* best effort; the queue is already drained */
    }
  };

  if (endpoint) {
    // pagehide fires on iOS, where visibilitychange can be skipped.
    setInterval(flush, 15_000);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  return {
    track(event, props = {}) {
      const dl = (window as unknown as DataLayerWindow).dataLayer;
      if (dl) {
        dl.push({ event, game: opts.gameId, ...props });
        return;
      }
      if (!endpoint) return;
      queue.push({ event, props });
      if (queue.length > 40) flush();
    },
  };
}
