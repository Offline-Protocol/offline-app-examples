/** Mock ticketing platform ingest — idempotent on scanId. */

export type PlatformIngestResult = {
  accepted: string[];
  duplicatesDropped: number;
};

export function ingestToPlatform(
  alreadyStored: Set<string>,
  scanIds: string[],
): { next: Set<string>; result: PlatformIngestResult } {
  const accepted: string[] = [];
  let duplicatesDropped = 0;
  const next = new Set(alreadyStored);
  for (const id of scanIds) {
    if (next.has(id)) {
      duplicatesDropped += 1;
      continue;
    }
    next.add(id);
    accepted.push(id);
  }
  return { next, result: { accepted, duplicatesDropped } };
}

export function unsyncedScanIds(
  admissions: { scanId: string }[],
  syncedIds: string[],
): string[] {
  const synced = new Set(syncedIds);
  return admissions.map((a) => a.scanId).filter((id) => !synced.has(id));
}
