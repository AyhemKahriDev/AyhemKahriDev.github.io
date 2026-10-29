import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CUSTOMIZATION_ASSET_SLOTS, type CustomizationAssetSlot } from "../shared/customization";

const hexColor = /^#[0-9a-fA-F]{6}$/;

export const customizationSettingsSchema = z.object({
  accentColor: z.string().regex(hexColor),
  gateColor: z.string().regex(hexColor),
  backgroundMode: z.enum(["default", "image", "video"]),
  pace: z.number().min(0.75).max(1.35),
  gateOpening: z.number().min(0.8).max(1.2),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});

export const customizationAssetSlotSchema = z.enum(CUSTOMIZATION_ASSET_SLOTS);

export const uploadInputSchema = z.object({
  slot: customizationAssetSlotSchema,
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  base64: z.string().min(1),
});

const slotRules: Record<CustomizationAssetSlot, { prefix: string; maxBytes: number }> = {
  backgroundImage: { prefix: "image/", maxBytes: 5 * 1024 * 1024 },
  planeImage: { prefix: "image/", maxBytes: 5 * 1024 * 1024 },
  backgroundVideo: { prefix: "video/", maxBytes: 12 * 1024 * 1024 },
  ambientAudio: { prefix: "audio/", maxBytes: 8 * 1024 * 1024 },
  flapAudio: { prefix: "audio/", maxBytes: 8 * 1024 * 1024 },
};

export function decodeCustomizationUpload(input: z.infer<typeof uploadInputSchema>) {
  const rule = slotRules[input.slot];
  if (!input.mimeType.startsWith(rule.prefix)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.slot} only accepts ${rule.prefix} files.`,
    });
  }

  const normalizedBase64 = input.base64.replace(/^data:[^;]+;base64,/, "");
  const data = Buffer.from(normalizedBase64, "base64");
  if (!data.length || data.length > rule.maxBytes) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `${input.slot} exceeds the permitted upload size.`,
    });
  }

  return data;
}

export function safeAssetName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

