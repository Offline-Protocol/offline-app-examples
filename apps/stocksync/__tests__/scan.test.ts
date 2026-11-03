import { describe, expect, it } from '@jest/globals';
import {
  INITIAL_STATE,
  parseMessage,
  PRODUCTS,
  scanToAdjust,
  stockReducer,
} from '../src/domain/stock';

// GS1 check digit: weights 1,3,1,3… over the first 12 digits.
const isEan13 = (code: string) => {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce(
    (acc, digit, i) => acc + Number(digit) * (i % 2 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(code[12]);
};

describe('barcodes', () => {
  it('every product has a unique, valid in-store EAN-13', () => {
    const codes = PRODUCTS.map((p) => p.barcode);
    expect(new Set(codes).size).toBe(PRODUCTS.length);
    for (const code of codes) {
      expect(isEan13(code)).toBe(true);
      expect(code.startsWith('20')).toBe(true);
    }
  });
});

describe('scanToAdjust', () => {
  it('maps each barcode to a +1 adjust op for its product', () => {
    for (const product of PRODUCTS) {
      expect(scanToAdjust(product.barcode)).toEqual({
        type: 'adjust',
        productId: product.id,
        delta: 1,
      });
    }
  });

  it('ignores surrounding whitespace, rejects unknown or partial codes', () => {
    expect(scanToAdjust(' 2000000000015\n')?.productId).toBe('milk');
    expect(scanToAdjust('5012345678900')).toBeNull();
    expect(scanToAdjust('200000000001')).toBeNull();
    expect(scanToAdjust('')).toBeNull();
  });

  it('produces an op that passes validation and the host applies like a tap', () => {
    const op = scanToAdjust('2000000000060');
    expect(op).not.toBeNull();
    expect(parseMessage(op)).toEqual(op);

    const next = stockReducer(INITIAL_STATE, op!);
    expect(next.stock.cheese).toBe(INITIAL_STATE.stock.cheese + 1);
    expect(next.rev).toBe(INITIAL_STATE.rev + 1);
  });
});
