import { describe, expect, it, vi } from "vitest";
import { decodeCustomizationUpload } from "./customization";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getCustomizationProfile: vi.fn(),
  listCustomizationAssets: vi.fn(),
  saveCustomizationProfile: vi.fn(),
  saveCustomizationAsset: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({
  getCustomizationProfile: mocks.getCustomizationProfile,
  listCustomizationAssets: mocks.listCustomizationAssets,
  removeCustomizationAsset: vi.fn(),
  saveCustomizationAsset: mocks.saveCustomizationAsset,
  saveCustomizationProfile: mocks.saveCustomizationProfile,
}));

vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
}));

import { appRouter } from "./routers";

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "customizer-test",
      email: "customizer@example.com",
      name: "Customizer",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("customization upload validation", () => {
  it("accepts an image payload for an image slot", () => {
    const data = decodeCustomizationUpload({
      slot: "backgroundImage",
      fileName: "sky.png",
      mimeType: "image/png",
      base64: Buffer.from("aeroflap").toString("base64"),
    });
    expect(data.toString()).toBe("aeroflap");
  });

  it("rejects media assigned to an incompatible slot", () => {
    expect(() =>
      decodeCustomizationUpload({
        slot: "flapAudio",
        fileName: "sky.png",
        mimeType: "image/png",
        base64: Buffer.from("aeroflap").toString("base64"),
      }),
    ).toThrow("only accepts audio/");
  });

  it("stores a validated user upload with its matching customization slot", async () => {
    mocks.storagePut.mockResolvedValue({
      key: "aeroflap/users/42/backgroundImage/sky_abc123.png",
      url: "/manus-storage/aeroflap/users/42/backgroundImage/sky_abc123.png",
    });
    const caller = appRouter.createCaller(authenticatedContext());
    const result = await caller.customization.upload({
      slot: "backgroundImage",
      fileName: "sky scene.png",
      mimeType: "image/png",
      base64: Buffer.from("paper-sky").toString("base64"),
    });

    expect(mocks.storagePut).toHaveBeenCalledWith(
      "aeroflap/users/42/backgroundImage/sky-scene.png",
      expect.any(Buffer),
      "image/png",
    );
    expect(mocks.saveCustomizationAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        slot: "backgroundImage",
        fileName: "sky-scene.png",
        bytes: 9,
      }),
    );
    expect(result).toMatchObject({
      success: true,
      slot: "backgroundImage",
      url: "/manus-storage/aeroflap/users/42/backgroundImage/sky_abc123.png",
    });
  });

  it("returns a saved profile and persists valid settings for the authenticated user", async () => {
    const savedSettings = {
      accentColor: "#112233",
      gateColor: "#334455",
      backgroundMode: "image" as const,
      pace: 1.1,
      gateOpening: 0.9,
      volume: 0.45,
      muted: false,
    };
    mocks.getCustomizationProfile.mockResolvedValue({ settings: savedSettings });
    mocks.listCustomizationAssets.mockResolvedValue([
      { slot: "planeImage", url: "/manus-storage/plane.png", fileName: "plane.png", mimeType: "image/png" },
    ]);
    const caller = appRouter.createCaller(authenticatedContext());

    const loaded = await caller.customization.get();
    await caller.customization.save(savedSettings);

    expect(loaded).toEqual({
      settings: savedSettings,
      assets: [{ slot: "planeImage", url: "/manus-storage/plane.png", fileName: "plane.png", mimeType: "image/png" }],
    });
    expect(mocks.saveCustomizationProfile).toHaveBeenCalledWith(42, savedSettings);
  });
});
