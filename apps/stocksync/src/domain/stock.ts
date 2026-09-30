// Inventory state and the two wire messages. Pure: no React, no SDK.
//
// The host is the authority. Members send `adjust` ops; the host applies them,
// bumps `rev` and broadcasts a full `snapshot`. Members apply their own taps
// right away ('predict') and let the next snapshot confirm or correct them.

export const PRODUCTS = [
  { id: 'milk', name: 'Milk', unit: 'cartons' },
  { id: 'bread', name: 'Bread', unit: 'loaves' },
  { id: 'apples', name: 'Apples', unit: 'bags' },
  { id: 'eggs', name: 'Eggs', unit: 'boxes' },
  { id: 'bananas', name: 'Bananas', unit: 'bunches' },
  { id: 'cheese', name: 'Cheese', unit: 'blocks' },
  { id: 'cereal', name: 'Cereal', unit: 'boxes' },
  { id: 'tomatoes', name: 'Tomatoes', unit: 'crates' },
] as const;

export type ProductId = (typeof PRODUCTS)[number]['id'];
export type Stock = Record<ProductId, number>;
export type StockState = { rev: number; stock: Stock };

export const LOW_STOCK = 2;
const MAX_QTY = 999;
const MAX_DELTA = 10;

export const INITIAL_STATE: StockState = {
  rev: 0,
  stock: {
    milk: 12,
    bread: 6,
    apples: 24,
    eggs: 9,
    bananas: 7,
    cheese: 2,
    cereal: 5,
    tomatoes: 10,
  },
};

/** Member -> host: "change this product by delta". */
export type AdjustMessage = {
  type: 'adjust';
  productId: ProductId;
  delta: number;
};
/** Host -> everyone: the whole inventory at revision `rev`. */
export type SnapshotMessage = { type: 'snapshot'; rev: number; stock: Stock };
export type StockMessage = AdjustMessage | SnapshotMessage;

export type StockAction =
  | AdjustMessage // host: apply an op (its own tap or a member's) and bump rev
  | { type: 'predict'; productId: ProductId; delta: number } // member: show own tap now, rev unchanged
  | SnapshotMessage // member: take the host's state unless it is older than ours
  | { type: 'reset' };

export function stockReducer(
  state: StockState,
  action: StockAction,
): StockState {
  switch (action.type) {
    case 'adjust':
      return {
        rev: state.rev + 1,
        stock: withDelta(state.stock, action.productId, action.delta),
      };
    case 'predict':
      return {
        rev: state.rev,
        stock: withDelta(state.stock, action.productId, action.delta),
      };
    case 'snapshot':
      // Equal rev is accepted on purpose: it drops predictions the host never applied.
      return action.rev < state.rev
        ? state
        : { rev: action.rev, stock: action.stock };
    case 'reset':
      return INITIAL_STATE;
  }
}

function withDelta(stock: Stock, id: ProductId, delta: number): Stock {
  return { ...stock, [id]: Math.min(MAX_QTY, Math.max(0, stock[id] + delta)) };
}

export const toSnapshot = (state: StockState): SnapshotMessage => ({
  type: 'snapshot',
  ...state,
});

/** Incoming room data is untrusted: returns a well-formed message or null. */
export function parseMessage(data: unknown): StockMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type === 'adjust') {
    const { productId, delta } = m;
    if (
      !isProductId(productId) ||
      !isInt(delta, -MAX_DELTA, MAX_DELTA) ||
      delta === 0
    )
      return null;
    return { type: 'adjust', productId, delta };
  }
  if (m.type === 'snapshot') {
    if (
      !isInt(m.rev, 0, Number.MAX_SAFE_INTEGER) ||
      typeof m.stock !== 'object' ||
      m.stock === null
    ) {
      return null;
    }
    const raw = m.stock as Record<string, unknown>;
    const stock = { ...INITIAL_STATE.stock };
    for (const { id } of PRODUCTS) {
      const qty = raw[id];
      if (!isInt(qty, 0, MAX_QTY)) return null;
      stock[id] = qty;
    }
    return { type: 'snapshot', rev: m.rev, stock };
  }
  return null;
}

/** Products whose quantity differs between two stocks. */
export const changedIds = (a: Stock, b: Stock): ProductId[] =>
  PRODUCTS.map((p) => p.id).filter((id) => a[id] !== b[id]);

const isProductId = (v: unknown): v is ProductId =>
  PRODUCTS.some((p) => p.id === v);

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
