/** Mock farm office ingest — idempotent on readingId (same pattern as OutageNet HQ). */

export type FarmIngestResult = {
  accepted: string[];
  duplicatesDropped: number;
};

export function ingestToFarm(
  alreadyStored: Set<string>,
  readingIds: string[],
): { next: Set<string>; result: FarmIngestResult } {
  const accepted: string[] = [];
  let duplicatesDropped = 0;
  const next = new Set(alreadyStored);
  for (const id of readingIds) {
    if (next.has(id)) {
      duplicatesDropped += 1;
      continue;
    }
    next.add(id);
    accepted.push(id);
  }
  return { next, result: { accepted, duplicatesDropped } };
}

export function unsyncedReadingIds(
  readings: { readingId: string }[],
  syncedIds: string[],
): string[] {
  const synced = new Set(syncedIds);
  return readings.map((r) => r.readingId).filter((id) => !synced.has(id));
}
