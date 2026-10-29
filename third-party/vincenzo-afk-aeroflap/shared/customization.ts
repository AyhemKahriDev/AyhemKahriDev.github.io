export const CUSTOMIZATION_ASSET_SLOTS = [
  "backgroundImage",
  "backgroundVideo",
  "planeImage",
  "ambientAudio",
  "flapAudio",
] as const;

export type CustomizationAssetSlot = (typeof CUSTOMIZATION_ASSET_SLOTS)[number];

export type BackgroundMode = "default" | "image" | "video";

export type CustomizationSettings = {
  accentColor: string;
  gateColor: string;
  backgroundMode: BackgroundMode;
  pace: number;
  gateOpening: number;
  volume: number;
  muted: boolean;
};

export const CUSTOMIZATION_DEFAULTS: CustomizationSettings = {
  accentColor: "#f24a2e",
  gateColor: "#378a62",
  backgroundMode: "default",
  pace: 1,
  gateOpening: 1,
  volume: 0.7,
  muted: false,
};

export type CustomizationAssetRecord = {
  slot: CustomizationAssetSlot;
  url: string;
  fileName: string;
  mimeType: string;
};

export type CustomizationSnapshot = {
  settings: CustomizationSettings;
  assets: Partial<Record<CustomizationAssetSlot, CustomizationAssetRecord>>;
};

