import { createStorage } from './storage';
import { createAudio } from './audio';
import { createAnalytics } from './analytics';
import { createAds, type HouseAd } from './ads';

export * from './types';
export { startLoop } from './loop';
export { attachPointer } from './input';
export { createStorage } from './storage';
export { createAudio } from './audio';
export { createAnalytics } from './analytics';
export { createAds } from './ads';
export { shareResult } from './share';
export * from './render';

import type { Ads, Analytics, Audio, Storage } from './types';

export interface EngineBundle {
  storage: Storage;
  audio: Audio;
  ads: Ads;
  analytics: Analytics;
}

export function createEngineBundle(opts: {
  gameId: string;
  houseAds: HouseAd[];
  analyticsEndpoint?: string;
}): EngineBundle {
  return {
    storage: createStorage(`af:${opts.gameId}`),
    audio: createAudio('af:muted'),
    ads: createAds({ houseAds: opts.houseAds }),
    analytics: createAnalytics({
      gameId: opts.gameId,
      endpoint: opts.analyticsEndpoint,
    }),
  };
}
