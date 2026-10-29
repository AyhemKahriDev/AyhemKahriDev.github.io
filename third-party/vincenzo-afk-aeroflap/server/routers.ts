import { COOKIE_NAME } from "@shared/const";
import { CUSTOMIZATION_DEFAULTS } from "@shared/customization";
import {
  getCustomizationProfile,
  listCustomizationAssets,
  removeCustomizationAsset,
  saveCustomizationAsset,
  saveCustomizationProfile,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  customizationAssetSlotSchema,
  customizationSettingsSchema,
  decodeCustomizationUpload,
  safeAssetName,
  uploadInputSchema,
} from "./customization";
import { storagePut } from "./storage";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  customization: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const [profile, assets] = await Promise.all([
        getCustomizationProfile(ctx.user.id),
        listCustomizationAssets(ctx.user.id),
      ]);
      return {
        settings: profile?.settings ?? CUSTOMIZATION_DEFAULTS,
        assets,
      };
    }),
    save: protectedProcedure.input(customizationSettingsSchema).mutation(async ({ ctx, input }) => {
      await saveCustomizationProfile(ctx.user.id, input);
      return { success: true } as const;
    }),
    upload: protectedProcedure.input(uploadInputSchema).mutation(async ({ ctx, input }) => {
      const data = decodeCustomizationUpload(input);
      const fileName = safeAssetName(input.fileName);
      const stored = await storagePut(
        `aeroflap/users/${ctx.user.id}/${input.slot}/${fileName}`,
        data,
        input.mimeType,
      );
      await saveCustomizationAsset({
        userId: ctx.user.id,
        slot: input.slot,
        storageKey: stored.key,
        url: stored.url,
        fileName,
        mimeType: input.mimeType,
        bytes: data.length,
      });
      return { success: true, url: stored.url, slot: input.slot } as const;
    }),
    clearAsset: protectedProcedure.input(customizationAssetSlotSchema).mutation(async ({ ctx, input }) => {
      await removeCustomizationAsset(ctx.user.id, input);
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
