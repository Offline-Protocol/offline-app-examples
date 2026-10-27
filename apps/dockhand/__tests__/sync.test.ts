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
} from '../src/services/fleetPlatform';

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

  it('fits a worst-case record under the AddInRecord limit', () => {
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

  it('takes the GPS fix closest to check-in', () => {
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

/** A fake Contoso Fleet: answers by method name and records every call. */
function fakeFleet(answer: (c: Call) => unknown) {
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
  server: 'fleet3.contoso.example',
  credentials: { database: 'demo', userName: 'a@b.c', sessionId: 's1' },
};

describe('Contoso Fleet client', () => {
  it('signs in and follows the server named in path', async () => {
    const credentials = {
      database: 'demo',
      userName: 'a@b.c',
      sessionId: 's1',
    };
    const moved = fakeFleet(() => ({
      result: { credentials, path: 'fleet3.contoso.example' },
    }));
    expect(
      await signIn(
        'https://fleet.contoso.example/',
        'demo',
        'a@b.c',
        'pw',
        moved.fetchImpl,
      ),
    ).toEqual({ server: 'fleet3.contoso.example', credentials });
    expect(moved.calls[0].url).toBe('https://fleet.contoso.example/api');
    expect(moved.calls[0].method).toBe('Authenticate');

    const here = fakeFleet(() => ({
      result: { credentials, path: 'self' },
    }));
    expect(
      (
        await signIn(
          'fleet.contoso.example',
          'demo',
          'a@b.c',
          'pw',
          here.fetchImpl,
        )
      ).server,
    ).toBe('fleet.contoso.example');
    expect(cleanServer('  ')).toBe('fleet.contoso.example');
  });

  it('adds a handoff once and reports the second push as a duplicate', async () => {
    const stored: unknown[] = [];
    const fleet = fakeFleet(({ method, params }) => {
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
    expect(await pushHandoff(session, details, fleet.fetchImpl)).toBe('added');
    expect(await pushHandoff(session, details, fleet.fetchImpl)).toBe(
      'duplicate',
    );
    expect(stored).toHaveLength(1);
    expect(
      fleet.calls.every(
        (c) =>
          c.url === 'https://fleet3.contoso.example/api' &&
          c.params.credentials.sessionId === 's1',
      ),
    ).toBe(true);
    await expect(
      pushHandoff(
        session,
        { ...details, handoffId: 'x" or "1' },
        fleet.fetchImpl,
      ),
    ).rejects.toThrow(/Bad handoff id/);
  });

  it('turns an expired session into SessionExpired', async () => {
    const fleet = fakeFleet(() => ({
      error: {
        message: 'x',
        errors: [{ name: 'InvalidSessionError', message: 'Invalid session' }],
      },
    }));
    await expect(
      pushHandoff(session, toDetails(done, null), fleet.fetchImpl),
    ).rejects.toBeInstanceOf(SessionExpired);
  });
});
