// The smallest MyGeotab JSON-RPC client this demo needs: sign in, list vehicles,
// read GO GPS records, and write handoffs as AddInData.
// https://developers.geotab.com/myGeotab/introduction/

import { isHandoffId } from '../domain/handoff';
import type { GoFix, HandoffDetails } from '../domain/sync';

/**
 * Keys the Storage API records of this add-in (an encoded GUID: "a" + 22 base64url
 * characters). Fixed so that every phone and the MyGeotab page read the same records.
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
  // POST only: MyGeotab asks that credentials never travel in a URL.
  const res = await fetchImpl(`https://${server}/apiv1`, {
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
      json.error.errors?.[0]?.message ?? json.error.message ?? 'MyGeotab error';
    if (
      names.includes('InvalidUserException') ||
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
      .replace(/\/.*$/, '') || 'my.geotab.com'
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
  // `path` names the server that holds this database, or "ThisServer".
  const path =
    result.path && result.path !== 'ThisServer'
      ? cleanServer(result.path)
      : host;
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

/** GO GPS records within `windowMs` either side of `at`. */
export async function goFixesAround(
  s: Session,
  deviceId: string,
  at: number,
  windowMs = 10 * 60_000,
  fetchImpl?: Fetch,
) {
  const records = await call<GoFix[]>(
    s,
    'Get',
    {
      typeName: 'LogRecord',
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
  // second can both add it. The MyGeotab page dedupes on handoffId; a server-side
  // sync service would make this one transaction.
  const existing = await call<unknown[]>(
    s,
    'Get',
    {
      typeName: 'AddInData',
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
    { typeName: 'AddInData', entity: { addInId: ADD_IN_ID, details } },
    fetchImpl,
  );
  return 'added';
}
