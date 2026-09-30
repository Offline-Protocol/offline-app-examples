// Orders and how they sync. Pure functions only: no React, no Bluetooth.
//
// The kitchen (room host) owns the truth. A waiter sends `place`; the kitchen
// adds the order if its id is new and answers with a `snapshot` of all open
// orders. Waiters show whatever the newest snapshot says, and keep resending
// orders no snapshot has mentioned yet, so a dropped message loses nothing.
import { MENU, TABLES } from './menu';

export type Status = 'new' | 'cooking' | 'ready';
export type LineItem = { itemId: string; qty: number };
export type NewOrder = {
  id: string; // made up by the waiter's device, so a resend is recognisable
  table: number;
  items: LineItem[];
  note?: string;
  waiter: string;
  placedAt: number;
};
export type Order = NewOrder & { status: Status };

export type Message =
  | { type: 'place'; order: NewOrder }
  | { type: 'snapshot'; rev: number; orders: Order[]; served: string[] };

export const NEXT_STATUS: Record<Status, Status | null> = {
  new: 'cooking',
  cooking: 'ready',
  ready: null, // cleared from the board
};

// ponytail: a snapshot carries at most 30 open orders + 30 served ids, which keeps
// it under the 16 KiB room limit (see the test). Page it if a kitchen needs more.
export const SNAPSHOT_ORDERS = 30;
export const SERVED_KEPT = 30;
export const NOTE_MAX = 60;
const QTY_MAX = 20;

// ------------------------------------------------------------------ kitchen

export type KitchenState = {
  rev: number; // bumped on every change, so waiters can ignore stale snapshots
  orders: Order[]; // open orders, oldest first
  served: string[]; // ids of recently cleared orders, so a late resend stays cleared
};

export type KitchenAction =
  | { type: 'place'; order: NewOrder; now: number }
  // `from` makes a double tap harmless: the second one no longer matches.
  | { type: 'advance'; id: string; from: Status };

export const emptyKitchen: KitchenState = { rev: 0, orders: [], served: [] };

/** Returns the same object when nothing changed. */
export function kitchenReducer(
  state: KitchenState,
  action: KitchenAction,
): KitchenState {
  if (action.type === 'place') {
    const { order, now } = action;
    const known =
      state.orders.some((o) => o.id === order.id) ||
      state.served.includes(order.id);
    if (known) return state;
    // Phone clocks drift; never show an order as placed in the future.
    const placed = { ...order, placedAt: Math.min(order.placedAt, now) };
    return {
      ...state,
      rev: state.rev + 1,
      orders: [...state.orders, { ...placed, status: 'new' }],
    };
  }

  const order = state.orders.find((o) => o.id === action.id);
  if (!order || order.status !== action.from) return state;
  const next = NEXT_STATUS[order.status];
  if (!next) {
    return {
      rev: state.rev + 1,
      orders: state.orders.filter((o) => o.id !== order.id),
      served: [...state.served, order.id].slice(-SERVED_KEPT),
    };
  }
  return {
    ...state,
    rev: state.rev + 1,
    orders: state.orders.map((o) =>
      o.id === order.id ? { ...o, status: next } : o,
    ),
  };
}

export function snapshotOf(state: KitchenState): Message {
  return {
    type: 'snapshot',
    rev: state.rev,
    orders: state.orders.slice(-SNAPSHOT_ORDERS),
    served: state.served,
  };
}

// ------------------------------------------------------------------- waiter

export type WaiterState = {
  rev: number; // rev of the newest snapshot applied, -1 before the first
  orders: Order[]; // the kitchen's open orders, from that snapshot
  served: string[];
  mine: NewOrder[]; // orders this device sent, newest first
  acked: string[]; // ids of mine that some snapshot has mentioned
};

export type WaiterAction =
  | { type: 'sent'; order: NewOrder }
  | { type: 'snapshot'; rev: number; orders: Order[]; served: string[] };

export const emptyWaiter: WaiterState = {
  rev: -1,
  orders: [],
  served: [],
  mine: [],
  acked: [],
};

export function waiterReducer(
  state: WaiterState,
  action: WaiterAction,
): WaiterState {
  if (action.type === 'sent') {
    return { ...state, mine: [action.order, ...state.mine] };
  }
  if (action.rev <= state.rev) return state; // stale or already applied
  const mentioned = new Set([
    ...action.orders.map((o) => o.id),
    ...action.served,
  ]);
  const acked = state.mine
    .filter((o) => state.acked.includes(o.id) || mentioned.has(o.id))
    .map((o) => o.id);
  return {
    ...state,
    rev: action.rev,
    orders: action.orders,
    served: action.served,
    acked,
  };
}

/** Orders the kitchen has not confirmed yet. Send them (again). */
export function unconfirmed(state: WaiterState): NewOrder[] {
  return state.mine.filter((o) => !state.acked.includes(o.id));
}

export type MyStatus = Status | 'sending' | 'served';

export function statusOf(state: WaiterState, id: string): MyStatus {
  const open = state.orders.find((o) => o.id === id);
  if (open) return open.status;
  // Confirmed once and now gone: the kitchen cleared it.
  return state.acked.includes(id) ? 'served' : 'sending';
}

// ------------------------------------------------------- incoming messages

/** Everything from the radio passes through here. Returns null for anything malformed. */
export function parseMessage(data: unknown): Message | null {
  if (!isObject(data)) return null;
  if (data.type === 'place') {
    const order = parseNewOrder(data.order);
    return order ? { type: 'place', order } : null;
  }
  if (data.type === 'snapshot') {
    const { rev, orders, served } = data;
    if (!isInt(rev, 0, Number.MAX_SAFE_INTEGER)) return null;
    if (!Array.isArray(orders) || orders.length > SNAPSHOT_ORDERS) return null;
    if (!Array.isArray(served) || served.length > SERVED_KEPT) return null;
    if (!served.every((id) => isText(id, 1, 40))) return null;
    const parsed = orders.map(parseOrder);
    if (parsed.some((o) => o === null)) return null;
    return { type: 'snapshot', rev, orders: parsed as Order[], served };
  }
  return null;
}

function parseOrder(data: unknown): Order | null {
  const order = parseNewOrder(data);
  if (!order || !isObject(data)) return null;
  const status = data.status;
  if (status !== 'new' && status !== 'cooking' && status !== 'ready') {
    return null;
  }
  return { ...order, status };
}

function parseNewOrder(data: unknown): NewOrder | null {
  if (!isObject(data)) return null;
  const { id, table, items, note, waiter, placedAt } = data;
  if (!isText(id, 1, 40) || !isInt(table, 1, TABLES)) return null;
  if (!isText(waiter, 0, 30) || !isInt(placedAt, 0, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  if (note !== undefined && !isText(note, 0, NOTE_MAX)) return null;
  if (!Array.isArray(items) || items.length < 1 || items.length > MENU.length) {
    return null;
  }
  const lines: LineItem[] = [];
  for (const item of items) {
    if (!isObject(item)) return null;
    const { itemId, qty } = item;
    if (typeof itemId !== 'string' || !MENU.some((m) => m.id === itemId)) {
      return null;
    }
    if (!isInt(qty, 1, QTY_MAX)) return null;
    lines.push({ itemId, qty });
  }
  return { id, table, items: lines, note: note || undefined, waiter, placedAt };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

function isText(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}
