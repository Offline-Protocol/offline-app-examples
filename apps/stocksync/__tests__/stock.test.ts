import { describe, expect, it } from '@jest/globals';
import { INITIAL_STATE, parseMessage, stockReducer } from '../src/domain/stock';

describe('stockReducer', () => {
  it('host adjust changes one product, clamps at 0 and bumps rev', () => {
    const s1 = stockReducer(INITIAL_STATE, {
      type: 'adjust',
      productId: 'milk',
      delta: 1,
    });
    expect(s1.stock.milk).toBe(INITIAL_STATE.stock.milk + 1);
    expect(s1.stock.bread).toBe(INITIAL_STATE.stock.bread);
    expect(s1.rev).toBe(1);

    const s2 = stockReducer(s1, {
      type: 'adjust',
      productId: 'cheese',
      delta: -10,
    });
    expect(s2.stock.cheese).toBe(0);
    expect(s2.rev).toBe(2);
  });

  it('member prediction keeps rev, next snapshot replaces it, stale snapshots are ignored', () => {
    const predicted = stockReducer(INITIAL_STATE, {
      type: 'predict',
      productId: 'eggs',
      delta: -1,
    });
    expect(predicted.rev).toBe(0);

    const fresh = { ...INITIAL_STATE.stock, eggs: 3 };
    const s1 = stockReducer(predicted, {
      type: 'snapshot',
      rev: 5,
      stock: fresh,
    });
    expect(s1).toEqual({ rev: 5, stock: fresh });

    const s2 = stockReducer(s1, {
      type: 'snapshot',
      rev: 4,
      stock: INITIAL_STATE.stock,
    });
    expect(s2).toBe(s1);
  });
});

describe('parseMessage', () => {
  it('accepts well-formed messages and rejects anything else', () => {
    expect(
      parseMessage({ type: 'adjust', productId: 'milk', delta: -1 }),
    ).toEqual({
      type: 'adjust',
      productId: 'milk',
      delta: -1,
    });
    expect(
      parseMessage({ type: 'snapshot', rev: 1, stock: INITIAL_STATE.stock }),
    ).not.toBeNull();

    expect(
      parseMessage({ type: 'adjust', productId: 'caviar', delta: 1 }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'adjust', productId: 'milk', delta: 1.5 }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'adjust', productId: 'milk', delta: 1e6 }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'snapshot', rev: 1, stock: { milk: -1 } }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'snapshot', rev: -1, stock: INITIAL_STATE.stock }),
    ).toBeNull();
    expect(parseMessage('hello')).toBeNull();
    expect(parseMessage(null)).toBeNull();
  });
});
