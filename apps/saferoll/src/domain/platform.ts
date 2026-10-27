/** Mock Northwind Alerts roll-call ingest — idempotent on checkInId. */

export type NorthwindIngestResult = {
  accepted: string[];
  duplicatesDropped: number;
};

export function ingestToNorthwind(
  alreadyStored: Set<string>,
  checkInIds: string[],
): { next: Set<string>; result: NorthwindIngestResult } {
  const accepted: string[] = [];
  let duplicatesDropped = 0;
  const next = new Set(alreadyStored);
  for (const id of checkInIds) {
    if (next.has(id)) {
      duplicatesDropped += 1;
      continue;
    }
    next.add(id);
    accepted.push(id);
  }
  return { next, result: { accepted, duplicatesDropped } };
}

export function unsyncedCheckInIds(
  checkIns: { checkInId: string }[],
  syncedIds: string[],
): string[] {
  const synced = new Set(syncedIds);
  return checkIns.map((c) => c.checkInId).filter((id) => !synced.has(id));
}
