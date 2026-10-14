import { describe, expect, it, jest } from '@jest/globals';
import type { Handoff } from '../src/domain/handoff';
import {
  DETAILS_MAX_CHARS,
  mockIngest,
  nearestFix,
  toDetails,
  unsynced,
} from '../src/domain/sync';
import {
  cleanServer,
  pushHandoff,
  SessionExpired,
  signIn,
  type Session,
} from '../src/services/mygeotab';

const sig = (c: string) => ({
  publicKey: c.repeat(64),
  signature: c.repeat(128),
});
const done: Handoff = {
  handoffId: 'ho-1',
  vehicle: { id: 'b1', name: 'Truck 12' },
  driverId: 'off1driver',
  driverName: 'Ada',
  load: { bol: 'BOL-1', trailer: 'TR-1', seal: 'SL-1', pallets: 22 },
  checkedInAt: 1_700_000_000_000,
  driverSig: sig('a'),
  assignment: {
    dock: 'Dock 3',
    yardId: 'off1yard',
    yardName: 'North Yard',
    assignedAt: 1_700_000_060_000,
    yardSig: sig('b'),
  },
};

describe('what gets synced', () => {
  it('picks completed handoffs not yet synced', () => {
    const waiting = { ...done, handoffId: 'ho-2', assignment: undefined };
    expect(unsynced([done, waiting], [])).toEqual([done]);
    expect(unsynced([done, waiting], ['ho-1'])).toEqual([]);
  });

  it('fits a worst-case record under the AddInData limit', () => {
    const long = 'W'.repeat(40);
    const big: Handoff = {
      ...done,
      vehicle: { id: long, name: long },
      driverId: 'o'.repeat(80),
      driverName: long,
      load: {
        bol: long.slice(0, 30),
        trailer: long.slice(0, 30),
        seal: long.slice(0, 30),
        pallets: 99,
      },
      assignment: {
        ...done.assignment!,
        yardId: 'o'.repeat(80),
        yardName: long,
      },
    };
    const details = toDetails(big, {
      latitude: -33.123456789,
      longitude: 151.123456789,
      dateTime: new Date().toISOString(),
    });
    expect(JSON.stringify(details).length).toBeLessThan(DETAILS_MAX_CHARS);
    expect(() => toDetails({ ...done, assignment: undefined }, null)).toThrow(
      /no dock/,
    );
  });

  it('takes the GO fix closest to check-in', () => {
    const at = Date.parse('2026-10-12T10:00:00Z');
    const fix = (t: string) => ({ latitude: 1, longitude: 2, dateTime: t });
    expect(
      nearestFix(
        [
          fix('2026-10-12T09:50:00Z'),
          fix('2026-10-12T10:01:00Z'),
          fix('2026-10-12T10:09:00Z'),
        ],
        at,
      )?.dateTime,
    ).toBe('2026-10-12T10:01:00Z');
    expect(nearestFix([], at)).toBeNull();
  });

  it('mock ingest drops duplicates by handoffId', () => {
    const first = mockIngest([], ['a', 'b']);
    expect(first).toEqual({
      stored: ['a', 'b'],
      added: ['a', 'b'],
      duplicates: 0,
    });
    expect(mockIngest(first.stored, ['b', 'c'])).toEqual({
      stored: ['a', 'b', 'c'],
      added: ['c'],
      duplicates: 1,
    });
  });
});

type Call = { url: string; method: string; params: Record<string, any> };

/** A fake MyGeotab: answers by method name and records every call. */
function fakeGeotab(answer: (c: Call) => unknown) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: any, init: any) => {
    const { method, params } = JSON.parse(init.body);
    const call = { url, method, params };
    calls.push(call);
    return { json: async () => answer(call) } as Response;
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const session: Session = {
  server: 'my3.geotab.com',
  credentials: { database: 'demo', userName: 'a@b.c', sessionId: 's1' },
};

describe('MyGeotab client', () => {
  it('signs in and follows the server named in path', async () => {
    const credentials = {
      database: 'demo',
      userName: 'a@b.c',
      sessionId: 's1',
    };
    const moved = fakeGeotab(() => ({
      result: { credentials, path: 'my3.geotab.com' },
    }));
    expect(
      await signIn(
        'https://my.geotab.com/',
        'demo',
        'a@b.c',
        'pw',
        moved.fetchImpl,
      ),
    ).toEqual({ server: 'my3.geotab.com', credentials });
    expect(moved.calls[0].url).toBe('https://my.geotab.com/apiv1');
    expect(moved.calls[0].method).toBe('Authenticate');

    const here = fakeGeotab(() => ({
      result: { credentials, path: 'ThisServer' },
    }));
    expect(
      (await signIn('my.geotab.com', 'demo', 'a@b.c', 'pw', here.fetchImpl))
        .server,
    ).toBe('my.geotab.com');
    expect(cleanServer('  ')).toBe('my.geotab.com');
  });

  it('adds a handoff once and reports the second push as a duplicate', async () => {
    const stored: unknown[] = [];
    const geotab = fakeGeotab(({ method, params }) => {
      if (method === 'Get')
        return {
          result: stored.filter(
            (d: any) =>
              params.search.whereClause === `handoffId = "${d.handoffId}"`,
          ),
        };
      if (method === 'Add') {
        stored.push(params.entity.details);
        return { result: 'id1' };
      }
      return { error: { message: 'unexpected' } };
    });
    const details = toDetails(done, null);
    expect(await pushHandoff(session, details, geotab.fetchImpl)).toBe('added');
    expect(await pushHandoff(session, details, geotab.fetchImpl)).toBe(
      'duplicate',
    );
    expect(stored).toHaveLength(1);
    expect(
      geotab.calls.every(
        (c) =>
          c.url === 'https://my3.geotab.com/apiv1' &&
          c.params.credentials.sessionId === 's1',
      ),
    ).toBe(true);
    await expect(
      pushHandoff(
        session,
        { ...details, handoffId: 'x" or "1' },
        geotab.fetchImpl,
      ),
    ).rejects.toThrow(/Bad handoff id/);
  });

  it('turns an expired session into SessionExpired', async () => {
    const geotab = fakeGeotab(() => ({
      error: {
        message: 'x',
        errors: [{ name: 'InvalidUserException', message: 'Invalid session' }],
      },
    }));
    await expect(
      pushHandoff(session, toDetails(done, null), geotab.fetchImpl),
    ).rejects.toBeInstanceOf(SessionExpired);
  });
});
