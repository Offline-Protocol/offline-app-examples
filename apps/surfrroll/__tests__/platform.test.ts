import { describe, expect, it } from '@jest/globals';
import { ingestToDatasurfr, unsyncedCheckInIds } from '../src/domain/platform';

describe('platform', () => {
  it('dedupes checkInId on re-upload', () => {
    const { next, result } = ingestToDatasurfr(new Set(), ['c1', 'c2', 'c1']);
    expect(result.accepted).toEqual(['c1', 'c2']);
    expect(result.duplicatesDropped).toBe(1);
    const again = ingestToDatasurfr(next, ['c1', 'c3']);
    expect(again.result.accepted).toEqual(['c3']);
    expect(again.result.duplicatesDropped).toBe(1);
  });

  it('lists unsynced ids', () => {
    const ids = unsyncedCheckInIds(
      [{ checkInId: 'a' }, { checkInId: 'b' }],
      ['a'],
    );
    expect(ids).toEqual(['b']);
  });
});
