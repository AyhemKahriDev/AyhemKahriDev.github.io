import type { Ads, AdProvider } from './types';

interface PokiSdk {
  showAd?: (name: string) => Promise<void>;
  rewardedAd?: {
    isLoaded: () => boolean;
    show: () => Promise<void>;
  };
}

interface CrazySdk {
  sdk?: {
    init: (opts: unknown) => void;
    ad: {
      requestAd: (id: string, opts: unknown) => Promise<boolean>;
      adFinished: () => Promise<void>;
      adError: () => Promise<void>;
      adStarted: () => Promise<void>;
    };
  };
  initSDK?: (opts: unknown) => void;
}

export interface HouseAd {
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Ad layer.
 *
 * On a portal (Poki / CrazyGames) the portal SDK owns the ad slots and we just
 * trigger them. On our own site there is no paid inventory yet, so we run
 * "house ads" — promos for other games in the catalogue. That is free inventory
 * that also lengthens the session, which is what an ad network would be paying
 * for.
 */
export function createAds(opts: {
  houseAds: HouseAd[];
  rewardedZoneId?: string;
  interstitialZoneId?: string;
}): Ads {
  const poki = (window as unknown as { poki?: PokiSdk }).poki;
  const crazy = (window as unknown as { CrazyGames?: CrazySdk }).CrazyGames;

  let provider: AdProvider = 'none';
  if (poki) provider = 'poki';
  else if (crazy) provider = 'crazygames';
  else if (opts.houseAds.length > 0) provider = 'house';

  let houseIndex = 0;

  return {
    provider: () => provider,

    async showInterstitial() {
      if (provider === 'poki' && poki?.showAd) {
        try {
          await poki.showAd('midgame');
        } catch {
          /* ignore */
        }
        return;
      }
      if (provider === 'crazygames' && crazy?.sdk) {
        try {
          const ok = await crazy.sdk.ad.requestAd('midgame', {});
          if (ok) await crazy.sdk.ad.adStarted();
        } catch {
          /* ignore */
        }
        return;
      }
      // House ad: the host renders the promo card, so nothing to do here.
    },

    async showRewarded() {
      if (provider === 'poki' && poki?.rewardedAd) {
        try {
          await poki.rewardedAd.show();
          return true;
        } catch {
          return false;
        }
      }
      if (provider === 'crazygames' && crazy?.sdk) {
        try {
          const ok = await crazy.sdk.ad.requestAd('rewarded', {});
          if (ok) {
            await crazy.sdk.ad.adStarted();
            await crazy.sdk.ad.adFinished();
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      }
      return false;
    },

    houseAd() {
      if (opts.houseAds.length === 0) return null;
      const ad = opts.houseAds[houseIndex % opts.houseAds.length];
      houseIndex++;
      return ad;
    },
  };
}
