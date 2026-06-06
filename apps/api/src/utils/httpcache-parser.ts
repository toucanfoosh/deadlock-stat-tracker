import { toInt } from "./number.js";

export interface ParsedCacheMatch {
  matchId: number;
  metadataSalt?: number;
  replaySalt?: number;
}

export function parseMatchRefsFromHttpcacheBuffer(
  buffer: Buffer,
): ParsedCacheMatch[] {
  const text = buffer.toString("latin1");
  const refs = new Map<number, ParsedCacheMatch>();

  const matchIdRegex = /match[_-]?id[=/:](\d{6,})/gi;
  for (const match of text.matchAll(matchIdRegex)) {
    const matchId = toInt(match[1]);
    if (!matchId) {
      continue;
    }
    const existing = refs.get(matchId) ?? { matchId };
    refs.set(matchId, existing);
  }

  const tupleRegex = /(\d{8,})[_/-](\d{4,})\.(meta|dem)\.bz2/gi;
  for (const match of text.matchAll(tupleRegex)) {
    const matchId = toInt(match[1]);
    const salt = toInt(match[2]);
    const kind = match[3];
    if (!matchId || !salt) {
      continue;
    }

    const existing = refs.get(matchId) ?? { matchId };
    if (kind === "meta") {
      existing.metadataSalt = salt;
    } else {
      existing.replaySalt = salt;
    }
    refs.set(matchId, existing);
  }

  const metadataRegex =
    /matches\/(\d{6,})\/metadata\?[^\\s"]*metadata[_-]?salt=(\d+)/gi;
  for (const match of text.matchAll(metadataRegex)) {
    const matchId = toInt(match[1]);
    const metadataSalt = toInt(match[2]);
    if (!matchId || !metadataSalt) {
      continue;
    }
    const existing = refs.get(matchId) ?? { matchId };
    existing.metadataSalt = metadataSalt;
    refs.set(matchId, existing);
  }

  const replayRegex =
    /matches\/(\d{6,})\/replay\?[^\\s"]*replay[_-]?salt=(\d+)/gi;
  for (const match of text.matchAll(replayRegex)) {
    const matchId = toInt(match[1]);
    const replaySalt = toInt(match[2]);
    if (!matchId || !replaySalt) {
      continue;
    }
    const existing = refs.get(matchId) ?? { matchId };
    existing.replaySalt = replaySalt;
    refs.set(matchId, existing);
  }

  return [...refs.values()];
}
