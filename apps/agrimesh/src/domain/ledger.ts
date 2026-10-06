import { findPlot, type ReadingKind } from './plots';

export type ReadingRecord = {
  readingId: string;
  farmId: string;
  plotId: string;
  plotName: string;
  kind: ReadingKind;
  value: string;
  unit: string;
  collectorId: string;
  collectorName: string;
  recordedAt: number;
};

export type MeshMessage =
  | { type: 'propose'; record: ReadingRecord }
  | {
      type: 'snapshot';
      rev: number;
      readings: ReadingRecord[];
      syncedReadingIds: string[];
      farmDuplicatesDropped: number;
    };

export const SNAPSHOT_READINGS = 48;

export type OfficeState = {
  rev: number;
  readings: ReadingRecord[];
  syncedReadingIds: string[];
  farmDuplicatesDropped: number;
};

export type FieldState = {
  rev: number;
  readings: ReadingRecord[];
  syncedReadingIds: string[];
  farmDuplicatesDropped: number;
  pendingReadingIds: string[];
  lastLogged: ReadingRecord | null;
};

export const emptyOffice = (): OfficeState => ({
  rev: 0,
  readings: [],
  syncedReadingIds: [],
  farmDuplicatesDropped: 0,
});

export const emptyField = (): FieldState => ({
  rev: -1,
  readings: [],
  syncedReadingIds: [],
  farmDuplicatesDropped: 0,
  pendingReadingIds: [],
  lastLogged: null,
});

export function newReadingId(): string {
  return `rdg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function snapshotOf(state: OfficeState): MeshMessage {
  return {
    type: 'snapshot',
    rev: state.rev,
    readings: state.readings.slice(-SNAPSHOT_READINGS),
    syncedReadingIds: state.syncedReadingIds,
    farmDuplicatesDropped: state.farmDuplicatesDropped,
  };
}

export type OfficeAction =
  | { type: 'propose'; record: ReadingRecord }
  | {
      type: 'mark_synced';
      readingIds: string[];
      duplicatesDropped: number;
    };

export function officeReducer(state: OfficeState, action: OfficeAction): OfficeState {
  switch (action.type) {
    case 'propose': {
      const { record } = action;
      if (state.readings.some((r) => r.readingId === record.readingId)) return state;
      return {
        ...state,
        rev: state.rev + 1,
        readings: [...state.readings, record],
      };
    }
    case 'mark_synced':
      return {
        ...state,
        syncedReadingIds: [...new Set([...state.syncedReadingIds, ...action.readingIds])],
        farmDuplicatesDropped: state.farmDuplicatesDropped + action.duplicatesDropped,
      };
    default:
      return state;
  }
}

export type FieldAction =
  | { type: 'queue'; readingId: string }
  | {
      type: 'snapshot';
      rev: number;
      readings: ReadingRecord[];
      syncedReadingIds: string[];
      farmDuplicatesDropped: number;
    }
  | { type: 'logged'; record: ReadingRecord };

export function fieldReducer(state: FieldState, action: FieldAction): FieldState {
  switch (action.type) {
    case 'queue':
      if (state.pendingReadingIds.includes(action.readingId)) return state;
      return { ...state, pendingReadingIds: [...state.pendingReadingIds, action.readingId] };
    case 'snapshot': {
      if (action.rev < state.rev) return state;
      const known = new Set(action.readings.map((r) => r.readingId));
      const pendingReadingIds = state.pendingReadingIds.filter((id) => !known.has(id));
      return {
        rev: action.rev,
        readings: action.readings,
        syncedReadingIds: action.syncedReadingIds,
        farmDuplicatesDropped: action.farmDuplicatesDropped,
        pendingReadingIds,
        lastLogged: state.lastLogged,
      };
    }
    case 'logged':
      return { ...state, lastLogged: action.record };
    default:
      return state;
  }
}

export function pendingResend(state: FieldState): string[] {
  const onLedger = new Set(state.readings.map((r) => r.readingId));
  return state.pendingReadingIds.filter((id) => !onLedger.has(id));
}

export function buildReadingProposal(input: {
  plotId: string;
  kind: ReadingKind;
  value: string;
  unit: string;
  farmId: string;
  collectorId: string;
  collectorName: string;
  now: number;
}): { record: ReadingRecord } | { error: string } {
  const plot = findPlot(input.plotId);
  if (!plot) return { error: 'Plot not in offline cache for this farm.' };
  const value = input.value.slice(0, 32);
  const unit = input.unit.slice(0, 12);
  return {
    record: {
      readingId: newReadingId(),
      farmId: input.farmId,
      plotId: plot.plotId,
      plotName: plot.name,
      kind: input.kind,
      value,
      unit,
      collectorId: input.collectorId,
      collectorName: input.collectorName.slice(0, 40),
      recordedAt: input.now,
    },
  };
}

export function parseMeshMessage(data: unknown): MeshMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Partial<MeshMessage>;
  if (m.type === 'propose') {
    const r = m.record as Partial<ReadingRecord> | undefined;
    if (
      !r ||
      typeof r.readingId !== 'string' ||
      typeof r.plotId !== 'string' ||
      typeof r.collectorId !== 'string'
    ) {
      return null;
    }
    return { type: 'propose', record: r as ReadingRecord };
  }
  if (m.type === 'snapshot') {
    if (typeof m.rev !== 'number' || !Array.isArray(m.readings)) return null;
    return {
      type: 'snapshot',
      rev: m.rev,
      readings: m.readings as ReadingRecord[],
      syncedReadingIds: Array.isArray(m.syncedReadingIds) ? m.syncedReadingIds : [],
      farmDuplicatesDropped:
        typeof m.farmDuplicatesDropped === 'number' ? m.farmDuplicatesDropped : 0,
    };
  }
  return null;
}
