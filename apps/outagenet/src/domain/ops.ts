// Field operations log — pure functions only (no React, no Bluetooth).
//
// The command post (room host) owns the truth. Field devices send `propose`
// messages; the host deduplicates by operationId and broadcasts snapshots.
// Handoffs stay pending until another device sends `accept_handoff`.

export const SECTORS = ['Sector 1', 'Sector 2', 'Sector 3'] as const;
export type Sector = (typeof SECTORS)[number];

export type StatusRecord = {
  kind: 'status';
  operationId: string;
  sector: Sector;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};

export type HandoffRecord = {
  kind: 'handoff';
  operationId: string;
  sector: Sector;
  note: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  state: 'pending' | 'accepted';
  acceptedById?: string;
  acceptedByName?: string;
  acceptedAt?: number;
};

export type FieldRecord = StatusRecord | HandoffRecord;

export type Message =
  | { type: 'propose'; record: FieldRecord }
  | {
      type: 'accept_handoff';
      operationId: string;
      acceptorId: string;
      acceptorName: string;
      at: number;
    }
  | {
      type: 'snapshot';
      rev: number;
      records: FieldRecord[];
      syncedIds: string[];
      hqDuplicatesDropped: number;
    };

export const SNAPSHOT_MAX = 40;
export const TEXT_MAX = 200;
export const NOTE_MAX = 200;
export const NAME_MAX = 30;
export const OP_ID_MAX = 48;

// ------------------------------------------------------------------ command

export type CommandState = {
  rev: number;
  records: FieldRecord[];
  syncedIds: string[];
  hqDuplicatesDropped: number;
};

export type CommandAction =
  | { type: 'propose'; record: FieldRecord }
  | {
      type: 'accept_handoff';
      operationId: string;
      acceptorId: string;
      acceptorName: string;
      at: number;
    }
  | { type: 'mark_synced'; operationIds: string[]; duplicatesDropped: number }
  | { type: 'reset' };

export const emptyCommand: CommandState = {
  rev: 0,
  records: [],
  syncedIds: [],
  hqDuplicatesDropped: 0,
};

export function commandReducer(
  state: CommandState,
  action: CommandAction,
): CommandState {
  if (action.type === 'reset') return emptyCommand;

  if (action.type === 'mark_synced') {
    const merged = new Set([...state.syncedIds, ...action.operationIds]);
    return {
      ...state,
      syncedIds: [...merged],
      hqDuplicatesDropped:
        state.hqDuplicatesDropped + action.duplicatesDropped,
    };
  }

  if (action.type === 'propose') {
    if (state.records.some((r) => r.operationId === action.record.operationId)) {
      return state;
    }
    const records = [...state.records, action.record].slice(-SNAPSHOT_MAX);
    return { ...state, rev: state.rev + 1, records };
  }

  const idx = state.records.findIndex(
    (r) => r.kind === 'handoff' && r.operationId === action.operationId,
  );
  if (idx < 0) return state;
  const handoff = state.records[idx] as HandoffRecord;
  if (handoff.state !== 'pending') return state;
  const updated: HandoffRecord = {
    ...handoff,
    state: 'accepted',
    acceptedById: action.acceptorId,
    acceptedByName: action.acceptorName,
    acceptedAt: action.at,
  };
  const records = state.records.slice();
  records[idx] = updated;
  return { ...state, rev: state.rev + 1, records };
}

export function snapshotOf(state: CommandState): Message {
  return {
    type: 'snapshot',
    rev: state.rev,
    records: state.records,
    syncedIds: state.syncedIds,
    hqDuplicatesDropped: state.hqDuplicatesDropped,
  };
}

// ------------------------------------------------------------------- field

export type FieldState = {
  rev: number;
  records: FieldRecord[];
  syncedIds: string[];
  hqDuplicatesDropped: number;
  /** operationIds this device proposed that the host has not echoed yet */
  pending: string[];
};

export type FieldAction =
  | { type: 'queue'; operationId: string }
  | { type: 'clear_pending'; operationIds: string[] }
  | {
      type: 'snapshot';
      rev: number;
      records: FieldRecord[];
      syncedIds: string[];
      hqDuplicatesDropped: number;
    }
  | { type: 'reset' };

export const emptyField: FieldState = {
  rev: -1,
  records: [],
  syncedIds: [],
  hqDuplicatesDropped: 0,
  pending: [],
};

export function fieldReducer(state: FieldState, action: FieldAction): FieldState {
  if (action.type === 'reset') return emptyField;

  if (action.type === 'queue') {
    if (state.pending.includes(action.operationId)) return state;
    return { ...state, pending: [...state.pending, action.operationId] };
  }

  if (action.type === 'clear_pending') {
    const drop = new Set(action.operationIds);
    const pending = state.pending.filter((id) => !drop.has(id));
    if (pending.length === state.pending.length) return state;
    return { ...state, pending };
  }

  if (action.rev <= state.rev) return state;
  const hostIds = new Set(action.records.map((r) => r.operationId));
  const pending = state.pending.filter((id) => !hostIds.has(id));
  return {
    rev: action.rev,
    records: action.records,
    syncedIds: action.syncedIds,
    hqDuplicatesDropped: action.hqDuplicatesDropped,
    pending,
  };
}

export function pendingResend(state: FieldState): string[] {
  return state.pending;
}

// ------------------------------------------------------- ids & validation

export function newOperationId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    OP_ID_MAX,
  );
}

export function parseMessage(data: unknown): Message | null {
  if (!isObject(data)) return null;

  if (data.type === 'propose') {
    const record = parseRecord(data.record);
    return record ? { type: 'propose', record } : null;
  }

  if (data.type === 'accept_handoff') {
    const { operationId, acceptorId, acceptorName, at } = data;
    if (!isText(operationId, 1, OP_ID_MAX)) return null;
    if (!isText(acceptorId, 1, 80)) return null;
    if (!isText(acceptorName, 0, NAME_MAX)) return null;
    if (!isInt(at, 0, Number.MAX_SAFE_INTEGER)) return null;
    return { type: 'accept_handoff', operationId, acceptorId, acceptorName, at };
  }

  if (data.type === 'snapshot') {
    const { rev, records, syncedIds, hqDuplicatesDropped } = data;
    if (!isInt(rev, 0, Number.MAX_SAFE_INTEGER)) return null;
    if (!Array.isArray(records) || records.length > SNAPSHOT_MAX) return null;
    if (!Array.isArray(syncedIds) || syncedIds.length > SNAPSHOT_MAX) return null;
    if (!syncedIds.every((id) => isText(id, 1, OP_ID_MAX))) return null;
    if (!isInt(hqDuplicatesDropped, 0, Number.MAX_SAFE_INTEGER)) return null;
    const parsed = records.map(parseRecord);
    if (parsed.some((r) => r === null)) return null;
    return {
      type: 'snapshot',
      rev,
      records: parsed as FieldRecord[],
      syncedIds,
      hqDuplicatesDropped,
    };
  }

  return null;
}

function parseRecord(data: unknown): FieldRecord | null {
  if (!isObject(data)) return null;
  const kind = data.kind;
  if (kind !== 'status' && kind !== 'handoff') return null;
  const operationId = data.operationId;
  const sector = data.sector;
  const authorId = data.authorId;
  const authorName = data.authorName;
  const createdAt = data.createdAt;
  if (!isText(operationId, 1, OP_ID_MAX)) return null;
  if (!SECTORS.includes(sector as Sector)) return null;
  if (!isText(authorId, 1, 80)) return null;
  if (!isText(authorName, 0, NAME_MAX)) return null;
  if (!isInt(createdAt, 0, Number.MAX_SAFE_INTEGER)) return null;

  if (kind === 'status') {
    const text = data.text;
    if (!isText(text, 1, TEXT_MAX)) return null;
    return {
      kind: 'status',
      operationId,
      sector: sector as Sector,
      text,
      authorId,
      authorName,
      createdAt,
    };
  }

  const note = data.note;
  const state = data.state;
  if (!isText(note, 1, NOTE_MAX)) return null;
  if (state !== 'pending' && state !== 'accepted') return null;
  const handoff: HandoffRecord = {
    kind: 'handoff',
    operationId,
    sector: sector as Sector,
    note,
    authorId,
    authorName,
    createdAt,
    state,
  };
  if (state === 'accepted') {
    const acceptedById = data.acceptedById;
    const acceptedByName = data.acceptedByName;
    const acceptedAt = data.acceptedAt;
    if (!isText(acceptedById, 1, 80)) return null;
    if (!isText(acceptedByName, 0, NAME_MAX)) return null;
    if (!isInt(acceptedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
    handoff.acceptedById = acceptedById;
    handoff.acceptedByName = acceptedByName;
    handoff.acceptedAt = acceptedAt;
  }
  return handoff;
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
