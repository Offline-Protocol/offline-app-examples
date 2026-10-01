// Mock HQ ingest — idempotent by operationId (pure, testable).

export type HqIngestResult = {
  accepted: string[];
  duplicatesDropped: number;
};

export function ingestToHq(
  alreadyStored: Set<string>,
  operationIds: string[],
): { next: Set<string>; result: HqIngestResult } {
  const accepted: string[] = [];
  let duplicatesDropped = 0;
  const next = new Set(alreadyStored);
  for (const id of operationIds) {
    if (next.has(id)) {
      duplicatesDropped += 1;
      continue;
    }
    next.add(id);
    accepted.push(id);
  }
  return { next, result: { accepted, duplicatesDropped } };
}

/** Records ready to sync: every status + accepted handoffs not yet in syncedIds */
export function unsyncedOperationIds(
  records: { operationId: string; kind: string; state?: string }[],
  syncedIds: string[],
): string[] {
  const synced = new Set(syncedIds);
  const out: string[] = [];
  for (const r of records) {
    if (synced.has(r.operationId)) continue;
    if (r.kind === 'status') out.push(r.operationId);
    else if (r.kind === 'handoff' && r.state === 'accepted') out.push(r.operationId);
  }
  return out;
}
