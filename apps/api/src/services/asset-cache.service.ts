import { AssetType, Prisma } from "@prisma/client";
import type { HeroAsset, ItemAsset, RankAsset } from "@deadlock/shared";
import { prisma } from "../lib/prisma.js";
import { deadlockClient } from "./deadlock-client.js";

const ASSET_TTL_MS = 12 * 60 * 60 * 1000;
let lastSyncAt = 0;

export async function syncAssetsIfNeeded() {
  const now = Date.now();
  if (now - lastSyncAt < ASSET_TTL_MS) {
    return;
  }

  const [heroes, items, ranks] = await Promise.all([
    deadlockClient.getHeroes().catch(() => [] as HeroAsset[]),
    deadlockClient.getItems().catch(() => [] as ItemAsset[]),
    deadlockClient.getRanks().catch(() => [] as RankAsset[]),
  ]);

  await upsertAssets(AssetType.HERO, heroes, (asset) => ({
    assetId: asset.id,
    name: asset.name,
    iconUrl:
      String(
        asset.images?.icon_image_small ?? asset.images?.icon_hero_card ?? "",
      ) || null,
    payload: asset,
  }));

  await upsertAssets(AssetType.ITEM, items, (asset) => ({
    assetId: asset.id,
    name: asset.name,
    iconUrl: String(asset.image ?? "") || null,
    payload: asset,
  }));

  await upsertAssets(AssetType.RANK, ranks, (asset) => ({
    assetId: asset.tier,
    name: asset.name,
    iconUrl: String(asset.images?.small ?? asset.images?.large ?? "") || null,
    payload: asset,
  }));

  lastSyncAt = now;
}

export async function getHeroMap() {
  await syncAssetsIfNeeded();
  const rows = await prisma.asset.findMany({
    where: { type: AssetType.HERO },
  });
  return new Map(
    rows.map((row) => [row.assetId, { name: row.name, iconUrl: row.iconUrl }]),
  );
}

async function upsertAssets<
  T extends { id?: number; tier?: number; name?: string },
>(
  type: AssetType,
  input: T[],
  mapper: (asset: T) => {
    assetId: number;
    name: string;
    iconUrl: string | null;
    payload: unknown;
  },
) {
  for (const asset of input) {
    const mapped = mapper(asset);
    if (!Number.isFinite(mapped.assetId) || !mapped.name) {
      continue;
    }
    await prisma.asset.upsert({
      where: {
        type_assetId: {
          type,
          assetId: mapped.assetId,
        },
      },
      update: {
        name: mapped.name,
        iconUrl: mapped.iconUrl,
        payload: mapped.payload as Prisma.InputJsonValue,
      },
      create: {
        type,
        assetId: mapped.assetId,
        name: mapped.name,
        iconUrl: mapped.iconUrl,
        payload: mapped.payload as Prisma.InputJsonValue,
      },
    });
  }
}
