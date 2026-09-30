import { describe, expect, it } from '@jest/globals';
import { decodeEnvelope, encodeEnvelope } from '../src/envelope';
import { hostFromAnnouncement, pruneHosts, upsertHost } from '../src/hosts';

const SERVICE = 'stocksync-room';
const announce = (overrides: Partial<Parameters<typeof hostFromAnnouncement>[0]> = {}) => ({
  service_id: SERVICE,
  version: '1',
  provider_peer_id: 'off1host',
  capabilities: { name: '  Corner Shop  ' },
  ...overrides,
});

describe('host list', () => {
  it('accepts only this app’s rooms from other real peers', () => {
    expect(hostFromAnnouncement(announce(), SERVICE, 'off1me', 5)).toEqual({ id: 'off1host', name: 'Corner Shop', seenAt: 5 });
    expect(hostFromAnnouncement(announce({ service_id: 'other-room' }), SERVICE, 'off1me', 5)).toBeNull();
    expect(hostFromAnnouncement(announce({ version: '2' }), SERVICE, 'off1me', 5)).toBeNull();
    expect(hostFromAnnouncement(announce({ provider_peer_id: 'off1me' }), SERVICE, 'off1me', 5)).toBeNull();
    expect(hostFromAnnouncement(announce({ provider_peer_id: 'AA:BB:CC' }), SERVICE, 'off1me', 5)).toBeNull();
    expect(hostFromAnnouncement(announce({ capabilities: {} }), SERVICE, 'off1me', 5)?.name).toBe('Nearby host');
  });

  it('dedupes by id, keeps first-seen order, and prunes stale hosts', () => {
    let hosts = upsertHost([], { id: 'a', name: 'A', seenAt: 0 });
    hosts = upsertHost(hosts, { id: 'b', name: 'B', seenAt: 1 });
    hosts = upsertHost(hosts, { id: 'a', name: 'A2', seenAt: 10 });
    expect(hosts).toEqual([
      { id: 'a', name: 'A2', seenAt: 10 },
      { id: 'b', name: 'B', seenAt: 1 },
    ]);
    expect(pruneHosts(hosts, 15, 10)).toEqual([{ id: 'a', name: 'A2', seenAt: 10 }]);
    expect(pruneHosts(hosts, 5, 10)).toBe(hosts); // unchanged list keeps its identity
  });
});

describe('envelope', () => {
  it('round-trips app data and rejects malformed or oversized messages', () => {
    const json = encodeEnvelope({ t: 'app', d: { op: 'add', qty: 2 } }, 1024);
    expect(decodeEnvelope(json, 1024)).toEqual({ t: 'app', d: { op: 'add', qty: 2 } });
    expect(decodeEnvelope('not json', 1024)).toBeNull();
    expect(decodeEnvelope('{"t":"group"}', 1024)).toBeNull();
    expect(decodeEnvelope('{"t":"nope"}', 1024)).toBeNull();
    expect(decodeEnvelope(json, 10)).toBeNull();
    expect(() => encodeEnvelope({ t: 'app', d: 'x'.repeat(2000) }, 1024)).toThrow(/limit is 1024/);
  });
});
