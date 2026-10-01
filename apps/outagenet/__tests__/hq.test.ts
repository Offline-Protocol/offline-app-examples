import { describe, expect, it } from '@jest/globals';
import { ingestToHq, unsyncedOperationIds } from '../src/domain/hq';

describe('ingestToHq', () => {
  it('accepts new ids and drops duplicates', () => {
    const first = ingestToHq(new Set(), ['a', 'b']);
    expect(first.result.accepted).toEqual(['a', 'b']);
    expect(first.result.duplicatesDropped).toBe(0);

    const second = ingestToHq(first.next, ['b', 'c']);
    expect(second.result.accepted).toEqual(['c']);
    expect(second.result.duplicatesDropped).toBe(1);
  });
});

describe('unsyncedOperationIds', () => {
  it('includes status and accepted handoffs only', () => {
    const ids = unsyncedOperationIds(
      [
        {
          operationId: 's1',
          kind: 'status',
        },
        {
          operationId: 'h1',
          kind: 'handoff',
          state: 'pending',
        },
        {
          operationId: 'h2',
          kind: 'handoff',
          state: 'accepted',
        },
      ],
      [],
    );
    expect(ids.sort()).toEqual(['h2', 's1']);
  });
});
