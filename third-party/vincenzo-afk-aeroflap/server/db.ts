import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  customizationAssets,
  customizationProfiles,
  InsertUser,
  users,
} from "../drizzle/schema";
import type {
  CustomizationAssetRecord,
  CustomizationAssetSlot,
  CustomizationSettings,
} from "../shared/customization";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomizationProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customizationProfiles)
    .where(eq(customizationProfiles.userId, userId))
    .limit(1);
  return result[0];
}

export async function saveCustomizationProfile(userId: number, settings: CustomizationSettings) {
  const db = await getDb();
  if (!db) throw new Error("Customization storage is unavailable.");
  await db
    .insert(customizationProfiles)
    .values({ userId, settings })
    .onDuplicateKeyUpdate({ set: { settings, updatedAt: new Date() } });
}

export async function listCustomizationAssets(userId: number): Promise<CustomizationAssetRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const assets = await db
    .select({
      slot: customizationAssets.slot,
      url: customizationAssets.url,
      fileName: customizationAssets.fileName,
      mimeType: customizationAssets.mimeType,
    })
    .from(customizationAssets)
    .where(eq(customizationAssets.userId, userId));
  return assets as CustomizationAssetRecord[];
}

export async function saveCustomizationAsset(input: {
  userId: number;
  slot: CustomizationAssetSlot;
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Customization storage is unavailable.");
  await db
    .insert(customizationAssets)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        storageKey: input.storageKey,
        url: input.url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytes: input.bytes,
        updatedAt: new Date(),
      },
    });
}

export async function removeCustomizationAsset(userId: number, slot: CustomizationAssetSlot) {
  const db = await getDb();
  if (!db) throw new Error("Customization storage is unavailable.");
  await db
    .delete(customizationAssets)
    .where(and(eq(customizationAssets.userId, userId), eq(customizationAssets.slot, slot)));
}
