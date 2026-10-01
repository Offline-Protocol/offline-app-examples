import { describe, expect, it } from '@jest/globals';
import {
  commandReducer,
  emptyCommand,
  emptyField,
  fieldReducer,
  parseMessage,
} from '../src/domain/ops';

describe('commandReducer', () => {
  it('deduplicates by operationId', () => {
    const record = {
      kind: 'status' as const,
      operationId: 'status-abc',
      sector: 'Sector 1' as const,
      text: 'Cleared',
      authorId: 'a1',
      authorName: 'Alex',
      createdAt: 1000,
    };
    const s1 = commandReducer(emptyCommand, { type: 'propose', record });
    expect(s1.records).toHaveLength(1);
    const s2 = commandReducer(s1, { type: 'propose', record });
    expect(s2).toBe(s1);
  });

  it('accepts pending handoff once', () => {
    const handoff = {
      kind: 'handoff' as const,
      operationId: 'ho-1',
      sector: 'Sector 2' as const,
      note: 'Lead block B',
      authorId: 'a1',
      authorName: 'Alex',
      createdAt: 1000,
      state: 'pending' as const,
    };
    const s1 = commandReducer(emptyCommand, { type: 'propose', record: handoff });
    const s2 = commandReducer(s1, {
      type: 'accept_handoff',
      operationId: 'ho-1',
      acceptorId: 'b2',
      acceptorName: 'Blake',
      at: 2000,
    });
    expect(s2.records[0].kind === 'handoff' && s2.records[0].state).toBe('accepted');
    const s3 = commandReducer(s2, {
      type: 'accept_handoff',
      operationId: 'ho-1',
      acceptorId: 'c3',
      acceptorName: 'Casey',
      at: 3000,
    });
    expect(s3).toBe(s2);
  });
});

describe('fieldReducer', () => {
  it('applies fresh snapshots and clears pending acked ids', () => {
    const queued = fieldReducer(emptyField, { type: 'queue', operationId: 'x1' });
    const snap = fieldReducer(queued, {
      type: 'snapshot',
      rev: 1,
      records: [
        {
          kind: 'status',
          operationId: 'x1',
          sector: 'Sector 1',
          text: 'ok',
          authorId: 'a',
          authorName: 'A',
          createdAt: 1,
        },
      ],
      syncedIds: [],
      hqDuplicatesDropped: 0,
    });
    expect(snap.pending).toEqual([]);
    expect(snap.rev).toBe(1);
  });
});

describe('parseMessage', () => {
  it('rejects malformed propose payloads', () => {
    expect(parseMessage({ type: 'propose', record: { kind: 'nope' } })).toBeNull();
    expect(
      parseMessage({
        type: 'snapshot',
        rev: 1,
        records: [],
        syncedIds: [],
        hqDuplicatesDropped: 0,
      }),
    ).not.toBeNull();
  });
});
