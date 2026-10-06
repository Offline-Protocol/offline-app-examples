import { describe, expect, it } from '@jest/globals';
import {
  admissionByTicket,
  buildScanProposal,
  emptyHost,
  hostReducer,
  parseGateMessage,
  snapshotOf,
} from '../src/domain/admission';
import { ingestToPlatform } from '../src/domain/platform';

describe('admission ledger', () => {
  it('dedupes ticket ids on host', () => {
    const proposal = buildScanProposal({
      ticketId: 'T-1001',
      eventId: 'evt',
      gateId: 'g1',
      gateName: 'North',
      deviceId: 'd1',
      now: 1,
    });
    if ('error' in proposal) throw new Error('expected record');
    let host = hostReducer(emptyHost(), { type: 'propose', record: proposal.record });
    host = hostReducer(host, { type: 'propose', record: { ...proposal.record, scanId: 'scan-2' } });
    expect(host.admissions).toHaveLength(1);
  });

  it('round-trips gate messages', () => {
    const host = hostReducer(emptyHost(), {
      type: 'propose',
      record: {
        scanId: 's1',
        ticketId: 'T-1001',
        eventId: 'evt',
        gateId: 'g',
        gateName: 'N',
        deviceId: 'd',
        scannedAt: 1,
        holder: 'A',
        section: 'A',
      },
    });
    const snap = snapshotOf(host);
    expect(parseGateMessage(snap)?.type).toBe('snapshot');
    expect(admissionByTicket(host.admissions, 'T-1001')?.scanId).toBe('s1');
  });
});

describe('platform ingest', () => {
  it('drops duplicate scanIds', () => {
    const first = ingestToPlatform(new Set(), ['s1', 's2']);
    const second = ingestToPlatform(first.next, ['s2', 's3']);
    expect(second.result.duplicatesDropped).toBe(1);
    expect(second.result.accepted).toEqual(['s3']);
  });
});
