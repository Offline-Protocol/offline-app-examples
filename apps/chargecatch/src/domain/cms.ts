/** Mock head-office / CMS ingest — idempotent on sessionId. */

export type CmsIngestResult = {
  accepted: string[];
  duplicatesDropped: number;
};

export function ingestToCms(
  alreadyStored: Set<string>,
  sessionIds: string[],
): { next: Set<string>; result: CmsIngestResult } {
  const accepted: string[] = [];
  let duplicatesDropped = 0;
  const next = new Set(alreadyStored);
  for (const id of sessionIds) {
    if (next.has(id)) {
      duplicatesDropped += 1;
      continue;
    }
    next.add(id);
    accepted.push(id);
  }
  return { next, result: { accepted, duplicatesDropped } };
}

export function unsyncedSessionIds(
  sessions: { sessionId: string }[],
  syncedIds: string[],
): string[] {
  const synced = new Set(syncedIds);
  return sessions.map((s) => s.sessionId).filter((id) => !synced.has(id));
}
