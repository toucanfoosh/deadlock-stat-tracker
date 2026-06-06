import type { PatchEntry } from "@deadlock/shared";
import { prisma } from "../lib/prisma.js";
import { deadlockClient } from "./deadlock-client.js";

interface PatchWindow {
  patchId: string;
  releasedAt: Date;
  endedAt?: Date;
}

let cachedWindows: PatchWindow[] = [];
let lastPatchSyncAt = 0;
const PATCH_SYNC_TTL_MS = 10 * 60 * 1000;

export async function syncPatchesIfNeeded() {
  const now = Date.now();
  if (now - lastPatchSyncAt < PATCH_SYNC_TTL_MS && cachedWindows.length > 0) {
    return cachedWindows;
  }

  const rawPatches = await deadlockClient.getPatches();
  const windows = normalizePatches(rawPatches);

  if (windows.length > 0) {
    await prisma.$transaction(
      windows.map((patch) =>
        prisma.patch.upsert({
          where: { patchId: patch.patchId },
          update: {
            title: patch.patchId,
            releasedAt: patch.releasedAt,
            endedAt: patch.endedAt,
          },
          create: {
            patchId: patch.patchId,
            title: patch.patchId,
            releasedAt: patch.releasedAt,
            endedAt: patch.endedAt,
          },
        }),
      ),
    );
  }

  cachedWindows = windows;
  lastPatchSyncAt = now;
  return windows;
}

export async function resolvePatchIdForUnixSeconds(
  startTimeUnix: number,
): Promise<string | null> {
  const windows = await syncPatchesIfNeeded();
  const time = new Date(startTimeUnix * 1000);
  const found = windows.find((patch) => {
    if (time < patch.releasedAt) {
      return false;
    }
    if (patch.endedAt && time >= patch.endedAt) {
      return false;
    }
    return true;
  });
  return found?.patchId ?? null;
}

function normalizePatches(entries: PatchEntry[]): PatchWindow[] {
  const parsed = entries
    .map((entry) => {
      const patchId = String(
        entry.patch_id ?? entry.id ?? entry.title ?? entry.name ?? "",
      ).trim();
      if (!patchId) {
        return null;
      }

      const dateValue =
        entry.released_at ??
        entry.release_date ??
        entry.date ??
        entry.timestamp ??
        null;
      if (!dateValue) {
        return null;
      }

      let releasedAt: Date | null = null;
      if (typeof dateValue === "number") {
        releasedAt = new Date(dateValue * 1000);
      } else {
        const asDate = new Date(dateValue);
        if (!Number.isNaN(asDate.getTime())) {
          releasedAt = asDate;
        }
      }

      if (!releasedAt) {
        return null;
      }

      return { patchId, releasedAt };
    })
    .filter((entry): entry is { patchId: string; releasedAt: Date } =>
      Boolean(entry),
    )
    .sort((a, b) => a.releasedAt.getTime() - b.releasedAt.getTime());

  return parsed.map((patch, index) => ({
    patchId: patch.patchId,
    releasedAt: patch.releasedAt,
    endedAt: parsed[index + 1]?.releasedAt,
  }));
}
