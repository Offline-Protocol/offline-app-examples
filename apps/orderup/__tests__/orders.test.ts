import { describe, expect, it } from '@jest/globals';
import {
  emptyKitchen,
  emptyWaiter,
  kitchenReducer,
  NOTE_MAX,
  parseMessage,
  SERVED_KEPT,
  SNAPSHOT_ORDERS,
  snapshotOf,
  statusOf,
  unconfirmed,
  waiterReducer,
  type KitchenState,
  type NewOrder,
  type WaiterState,
} from '../src/domain/orders';

const order = (id: string): NewOrder => ({
  id,
  table: 4,
  items: [{ itemId: 'burger', qty: 2 }],
  waiter: 'Ada',
  placedAt: 1000,
});

const place = (state: KitchenState, o: NewOrder) =>
  kitchenReducer(state, { type: 'place', order: o, now: 2000 });

// What a waiter would receive right now, through the same parser as the radio.
function receive(waiter: WaiterState, kitchen: KitchenState) {
  const msg = parseMessage(JSON.parse(JSON.stringify(snapshotOf(kitchen))));
  if (msg?.type !== 'snapshot') throw new Error('bad snapshot');
  return waiterReducer(waiter, msg);
}

describe('orders', () => {
  it('places an order once, even when it is resent', () => {
    const once = place(emptyKitchen, order('a'));
    expect(once.orders).toHaveLength(1);
    expect(once.rev).toBe(1);
    expect(place(once, order('a'))).toBe(once);
  });

  it('advances new -> cooking -> ready -> served, ignoring double taps', () => {
    let k = place(emptyKitchen, order('a'));
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'new' });
    expect(k.orders[0]?.status).toBe('cooking');
    expect(kitchenReducer(k, { type: 'advance', id: 'a', from: 'new' })).toBe(
      k,
    );
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'cooking' });
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'ready' });
    expect(k.orders).toEqual([]);
    expect(k.served).toEqual(['a']);
    expect(k.rev).toBe(4);
    // A late resend of a cleared order does not bring it back.
    expect(place(k, order('a'))).toBe(k);
  });

  it('ignores stale snapshots', () => {
    const k1 = place(emptyKitchen, order('a'));
    const k2 = kitchenReducer(k1, { type: 'advance', id: 'a', from: 'new' });
    const w = receive(receive(emptyWaiter, k2), k1);
    expect(w.rev).toBe(2);
    expect(w.orders[0]?.status).toBe('cooking');
  });

  it('keeps resending orders until a snapshot mentions them', () => {
    let w = waiterReducer(emptyWaiter, { type: 'sent', order: order('a') });
    w = waiterReducer(w, { type: 'sent', order: order('b') });
    let k = place(emptyKitchen, order('a')); // "b" got lost on the way

    w = receive(w, k);
    expect(unconfirmed(w).map((o) => o.id)).toEqual(['b']);
    expect(statusOf(w, 'a')).toBe('new');
    expect(statusOf(w, 'b')).toBe('sending');

    k = place(k, order('b')); // the resend arrives
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'new' });
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'cooking' });
    k = kitchenReducer(k, { type: 'advance', id: 'a', from: 'ready' });
    w = receive(w, k);
    expect(unconfirmed(w)).toEqual([]);
    expect(statusOf(w, 'a')).toBe('served');
    expect(statusOf(w, 'b')).toBe('new');
  });

  it('rejects malformed messages and keeps snapshots under the room limit', () => {
    expect(
      parseMessage({ type: 'place', order: { ...order('a'), table: 99 } }),
    ).toBeNull();
    expect(
      parseMessage({
        type: 'place',
        order: { ...order('a'), items: [{ itemId: 'caviar', qty: 1 }] },
      }),
    ).toBeNull();
    expect(
      parseMessage({ type: 'snapshot', rev: 1, orders: [{}], served: [] }),
    ).toBeNull();

    const biggest: KitchenState = {
      rev: 1e9,
      served: Array.from(
        { length: SERVED_KEPT },
        (_, i) => `${'x'.repeat(38)}${i}`,
      ),
      orders: Array.from({ length: SNAPSHOT_ORDERS }, (_, i) => ({
        id: `${'y'.repeat(38)}${i}`,
        table: 12,
        items: [
          'burger',
          'pizza',
          'fries',
          'salad',
          'ramen',
          'taco',
          'soda',
          'icecream',
        ].map((itemId) => ({ itemId, qty: 20 })),
        note: 'n'.repeat(NOTE_MAX),
        waiter: 'w'.repeat(30),
        placedAt: Date.now(),
        status: 'cooking' as const,
      })),
    };
    expect(
      JSON.stringify({ t: 'app', d: snapshotOf(biggest) }).length,
    ).toBeLessThan(16 * 1024);
  });
});
