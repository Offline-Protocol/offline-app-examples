// The smallest JSON-RPC client this demo needs for Contoso Fleet, a fictional
// fleet platform: sign in, list vehicles, read GPS records, and write handoffs as
// AddInRecord entries. No real Contoso Fleet server exists: the tests run this
// client against a fake server, and the app uses the mock ingest when signed out.

import { isHandoffId } from '../domain/handoff';
import type { GpsFix, HandoffDetails } from '../domain/sync';

/**
 * Keys the Storage API records of this add-in (an encoded GUID: "a" + 22 base64url
 * characters). Fixed so that every phone and the Contoso Fleet page read the same records.
 * Generate your own for a real integration.
 */
export const ADD_IN_ID = 'aQ1J3cGt1UkW1vXoJmZ6h3w';

/** Sign-in result. The password is never kept; only this session. */
export type Session = {
  server: string;
  credentials: { database: string; userName: string; sessionId: string };
};

/** The session is no longer valid: sign in again. */
export class SessionExpired extends Error {}

type Fetch = typeof fetch;

async function rpc<T>(
  server: string,
  method: string,
  params: object,
  fetchImpl: Fetch,
): Promise<T> {
  // POST only: Contoso Fleet asks that credentials never travel in a URL.
  const res = await fetchImpl(`https://${server}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  const json = (await res.json()) as {
    result?: T;
    error?: {
      message?: string;
      errors?: { name?: string; message?: string }[];
    };
  };
  if (json.error) {
    const names = (json.error.errors ?? []).map((e) => e.name);
    const message =
      json.error.errors?.[0]?.message ??
      json.error.message ??
      'Contoso Fleet error';
    if (
      names.includes('InvalidSessionError') ||
      /invalid session/i.test(message)
    ) {
      throw new SessionExpired(message);
    }
    throw new Error(message);
  }
  return json.result as T;
}

const call = <T>(
  s: Session,
  method: string,
  params: object,
  fetchImpl: Fetch = fetch,
) =>
  rpc<T>(
    s.server,
    method,
    { ...params, credentials: s.credentials },
    fetchImpl,
  );

export function cleanServer(server: string): string {
  return (
    server
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '') || 'fleet.contoso.example'
  );
}

export async function signIn(
  server: string,
  database: string,
  userName: string,
  password: string,
  fetchImpl: Fetch = fetch,
): Promise<Session> {
  const host = cleanServer(server);
  const result = await rpc<{
    credentials: Session['credentials'];
    path: string;
  }>(
    host,
    'Authenticate',
    { database: database.trim(), userName: userName.trim(), password },
    fetchImpl,
  );
  // `path` names the server that holds this database, or "self".
  const path =
    result.path && result.path !== 'self' ? cleanServer(result.path) : host;
  return { server: path, credentials: result.credentials };
}

export async function listVehicles(s: Session, fetchImpl?: Fetch) {
  const devices = await call<{ id: string; name: string }[]>(
    s,
    'Get',
    { typeName: 'Device', resultsLimit: 50 },
    fetchImpl,
  );
  return devices.map((d) => ({ id: d.id, name: String(d.name).slice(0, 40) }));
}

/** GPS records within `windowMs` either side of `at`. */
export async function gpsFixesAround(
  s: Session,
  deviceId: string,
  at: number,
  windowMs = 10 * 60_000,
  fetchImpl?: Fetch,
) {
  const records = await call<GpsFix[]>(
    s,
    'Get',
    {
      typeName: 'GpsRecord',
      search: {
        deviceSearch: { id: deviceId },
        fromDate: new Date(at - windowMs).toISOString(),
        toDate: new Date(at + windowMs).toISOString(),
      },
      resultsLimit: 100,
    },
    fetchImpl,
  );
  return records.map((r) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    dateTime: r.dateTime,
  }));
}

/**
 * Writes one handoff unless a record with its handoffId already exists, so a
 * retry, or the yard and the driver both syncing, never makes a second record.
 */
export async function pushHandoff(
  s: Session,
  details: HandoffDetails,
  fetchImpl?: Fetch,
): Promise<'added' | 'duplicate'> {
  if (!isHandoffId(details.handoffId)) throw new Error('Bad handoff id.');
  // ponytail: check-then-add, so two devices syncing the same handoff in the same
  // second can both add it. The Contoso Fleet page dedupes on handoffId; a server-side
  // sync service would make this one transaction.
  const existing = await call<unknown[]>(
    s,
    'Get',
    {
      typeName: 'AddInRecord',
      search: {
        addInId: ADD_IN_ID,
        selectClause: 'handoffId',
        whereClause: `handoffId = "${details.handoffId}"`,
      },
    },
    fetchImpl,
  );
  if (existing.length > 0) return 'duplicate';
  await call(
    s,
    'Add',
    { typeName: 'AddInRecord', entity: { addInId: ADD_IN_ID, details } },
    fetchImpl,
  );
  return 'added';
}
