import { describe, expect, it } from '@jest/globals';
import { ingestToFarm } from '../src/domain/farm';
import {
  buildReadingProposal,
  emptyOffice,
  officeReducer,
  parseMeshMessage,
  snapshotOf,
} from '../src/domain/ledger';

describe('reading ledger', () => {
  it('dedupes readingId on office host', () => {
    const proposal = buildReadingProposal({
      plotId: 'P-N1',
      kind: 'moisture_pct',
      value: '18',
      unit: '%',
      farmId: 'farm',
      collectorId: 'c1',
      collectorName: 'Walker',
      now: 1,
    });
    if ('error' in proposal) throw new Error('expected record');
    let office = officeReducer(emptyOffice(), { type: 'propose', record: proposal.record });
    office = officeReducer(office, {
      type: 'propose',
      record: { ...proposal.record, plotName: 'dup' },
    });
    expect(office.readings).toHaveLength(1);
  });

  it('round-trips mesh messages', () => {
    const office = officeReducer(emptyOffice(), {
      type: 'propose',
      record: {
        readingId: 'r1',
        farmId: 'f',
        plotId: 'P-N1',
        plotName: 'North',
        kind: 'moisture_pct',
        value: '18',
        unit: '%',
        collectorId: 'c',
        collectorName: 'A',
        recordedAt: 1,
      },
    });
    const snap = snapshotOf(office);
    expect(parseMeshMessage(snap)?.type).toBe('snapshot');
    expect(office.readings[0].readingId).toBe('r1');
  });
});

describe('farm ingest', () => {
  it('drops duplicate readingIds', () => {
    const first = ingestToFarm(new Set(), ['r1', 'r2']);
    const second = ingestToFarm(first.next, ['r2', 'r3']);
    expect(second.result.duplicatesDropped).toBe(1);
    expect(second.result.accepted).toEqual(['r3']);
  });
});
