import { describe, expect, it } from '@jest/globals';
import { ingestToCms } from '../src/domain/cms';
import {
  buildSession,
  hubReducer,
  emptyHub,
  newSessionId,
  parseMeshMessage,
} from '../src/domain/sessions';

describe('charge sessions', () => {
  it('uses secure random session ids', () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).toMatch(/^ses-[a-z0-9]+-[0-9a-f]{8}$/);
    expect(b).not.toBe(a);
  });

  it('builds session for seeded card', () => {
    const built = buildSession({
      siteId: 'site-demo-north',
      chargerId: 'CP-A',
      chargerLabel: 'A',
      cardId: 'RFID-1001',
      energyKwh: 10,
      startedAt: 1,
      endedAt: 2,
    });
    expect('record' in built).toBe(true);
    if ('record' in built) {
      expect(built.record.cardId).toBe('RFID-1001');
    }
  });

  it('dedupes cms ingest on sessionId', () => {
    const first = ingestToCms(new Set(), ['ses-a', 'ses-b']);
    const second = ingestToCms(first.next, ['ses-a', 'ses-c']);
    expect(first.result.accepted).toEqual(['ses-a', 'ses-b']);
    expect(second.result.accepted).toEqual(['ses-c']);
    expect(second.result.duplicatesDropped).toBe(1);
  });

  it('parses propose messages', () => {
    const msg = parseMeshMessage({
      type: 'propose',
      record: {
        sessionId: 'ses-1',
        siteId: 's',
        chargerId: 'CP-A',
        chargerLabel: 'A',
        cardId: 'RFID-1001',
        cardLabel: 'x',
        energyKwh: 1,
        startedAt: 1,
        endedAt: 2,
      },
    });
    expect(msg?.type).toBe('propose');
  });

  it('clears charger fault on hub', () => {
    let hub = hubReducer(emptyHub(), { type: 'set_fault', chargerId: 'CP-A', fault: true });
    expect(hub.chargerFaults['CP-A']).toBe(true);
    hub = hubReducer(hub, { type: 'clear_fault', chargerId: 'CP-A' });
    expect(hub.chargerFaults['CP-A']).toBe(false);
  });
});
