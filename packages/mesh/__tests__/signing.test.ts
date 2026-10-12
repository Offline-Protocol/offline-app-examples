import { describe, expect, it } from '@jest/globals';
import { fromHex, toHex, utf8 } from '../src/signing';

describe('signing helpers', () => {
  it('round-trips bytes through hex and rejects anything that is not hex', () => {
    expect(toHex([0, 15, 255])).toBe('000fff');
    expect(fromHex('000fff')).toEqual([0, 15, 255]);
    expect(fromHex('000FFF')).toEqual([0, 15, 255]);
    expect(fromHex('abc')).toBeNull();
    expect(fromHex('zz')).toBeNull();
    expect(fromHex(42)).toBeNull();
    expect(utf8('é')).toEqual([0xc3, 0xa9]);
  });
});
