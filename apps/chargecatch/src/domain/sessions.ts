import { findCard, type ChargerId } from './cards';

/** Demo idempotency keys — unique per process without native crypto (CMS dedupe). */
let sessionSeq = 0;

function sessionIdSuffix(): string {
  sessionSeq += 1;
  const mix = (Date.now() * 31 + sessionSeq * 997) >>> 0;
  return mix.toString(16).padStart(8, '0');
}

export type ChargeSession = {
  sessionId: string;
  siteId: string;
  chargerId: string;
  chargerLabel: string;
  cardId: string;
  cardLabel: string;
  energyKwh: number;
  startedAt: number;
  endedAt: number;
};

export type MeshMessage =
  | { type: 'propose'; record: ChargeSession }
  | {
      type: 'snapshot';
      rev: number;
      sessions: ChargeSession[];
      syncedSessionIds: string[];
      cmsDuplicatesDropped: number;
      chargerFaults: Record<string, boolean>;
      headOfficeOnline: boolean;
    }
  | { type: 'clear_fault'; chargerId: string };

export const SNAPSHOT_SESSIONS = 48;

export type HubState = {
  rev: number;
  sessions: ChargeSession[];
  syncedSessionIds: string[];
  cmsDuplicatesDropped: number;
  chargerFaults: Record<string, boolean>;
  headOfficeOnline: boolean;
};

export type ChargerState = {
  rev: number;
  sessions: ChargeSession[];
  syncedSessionIds: string[];
  cmsDuplicatesDropped: number;
  pendingSessionIds: string[];
  lastSession: ChargeSession | null;
  chargerFaults: Record<string, boolean>;
  headOfficeOnline: boolean;
};

export const emptyHub = (): HubState => ({
  rev: 0,
  sessions: [],
  syncedSessionIds: [],
  cmsDuplicatesDropped: 0,
  chargerFaults: { 'CP-A': false, 'CP-B': false },
  headOfficeOnline: false,
});

export const emptyCharger = (): ChargerState => ({
  rev: -1,
  sessions: [],
  syncedSessionIds: [],
  cmsDuplicatesDropped: 0,
  pendingSessionIds: [],
  lastSession: null,
  chargerFaults: { 'CP-A': false, 'CP-B': false },
  headOfficeOnline: false,
});

export function newSessionId(): string {
  return `ses-${Date.now().toString(36)}-${sessionIdSuffix()}`;
}

export function snapshotOf(state: HubState): MeshMessage {
  return {
    type: 'snapshot',
    rev: state.rev,
    sessions: state.sessions.slice(-SNAPSHOT_SESSIONS),
    syncedSessionIds: state.syncedSessionIds,
    cmsDuplicatesDropped: state.cmsDuplicatesDropped,
    chargerFaults: { ...state.chargerFaults },
    headOfficeOnline: state.headOfficeOnline,
  };
}

export function hubReducer(
  state: HubState,
  action:
    | { type: 'propose'; record: ChargeSession }
    | {
        type: 'mark_synced';
        sessionIds: string[];
        duplicatesDropped: number;
      }
    | { type: 'clear_fault'; chargerId: string }
    | { type: 'set_head_office_online'; online: boolean }
    | { type: 'set_fault'; chargerId: string; fault: boolean },
): HubState {
  switch (action.type) {
    case 'propose': {
      const { record } = action;
      if (state.sessions.some((s) => s.sessionId === record.sessionId)) return state;
      return {
        ...state,
        rev: state.rev + 1,
        sessions: [...state.sessions, record],
      };
    }
    case 'mark_synced':
      return {
        ...state,
        syncedSessionIds: [...new Set([...state.syncedSessionIds, ...action.sessionIds])],
        cmsDuplicatesDropped: state.cmsDuplicatesDropped + action.duplicatesDropped,
      };
    case 'clear_fault':
      return {
        ...state,
        rev: state.rev + 1,
        chargerFaults: { ...state.chargerFaults, [action.chargerId]: false },
      };
    case 'set_fault':
      return {
        ...state,
        rev: state.rev + 1,
        chargerFaults: { ...state.chargerFaults, [action.chargerId]: action.fault },
      };
    case 'set_head_office_online':
      return {
        ...state,
        rev: state.rev + 1,
        headOfficeOnline: action.online,
      };
    default:
      return state;
  }
}

export type ChargerAction =
  | { type: 'queue'; sessionId: string }
  | {
      type: 'snapshot';
      rev: number;
      sessions: ChargeSession[];
      syncedSessionIds: string[];
      cmsDuplicatesDropped: number;
      chargerFaults: Record<string, boolean>;
      headOfficeOnline: boolean;
    }
  | { type: 'completed'; record: ChargeSession };

export function chargerReducer(state: ChargerState, action: ChargerAction): ChargerState {
  switch (action.type) {
    case 'queue':
      if (state.pendingSessionIds.includes(action.sessionId)) return state;
      return { ...state, pendingSessionIds: [...state.pendingSessionIds, action.sessionId] };
    case 'snapshot': {
      const pending = state.pendingSessionIds.filter(
        (id) => !action.sessions.some((s) => s.sessionId === id),
      );
      return {
        ...state,
        rev: action.rev,
        sessions: action.sessions,
        syncedSessionIds: action.syncedSessionIds,
        cmsDuplicatesDropped: action.cmsDuplicatesDropped,
        chargerFaults: { ...action.chargerFaults },
        headOfficeOnline: action.headOfficeOnline,
        pendingSessionIds: pending,
      };
    }
    case 'completed':
      return {
        ...state,
        lastSession: action.record,
        pendingSessionIds: state.pendingSessionIds.filter((id) => id !== action.record.sessionId),
      };
    default:
      return state;
  }
}

export function pendingResend(state: ChargerState): string[] {
  return state.pendingSessionIds;
}

export function buildSession(input: {
  siteId: string;
  chargerId: ChargerId;
  chargerLabel: string;
  cardId: string;
  energyKwh: number;
  startedAt: number;
  endedAt: number;
}): { record: ChargeSession } | { error: string } {
  const card = findCard(input.cardId);
  if (!card) return { error: 'unknown_card' };
  return {
    record: {
      sessionId: newSessionId(),
      siteId: input.siteId,
      chargerId: input.chargerId,
      chargerLabel: input.chargerLabel,
      cardId: card.cardId,
      cardLabel: card.label,
      energyKwh: input.energyKwh,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    },
  };
}

export function parseMeshMessage(data: unknown): MeshMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Partial<MeshMessage>;
  if (m.type === 'propose') {
    const r = m.record as Partial<ChargeSession> | undefined;
    if (
      !r ||
      typeof r.sessionId !== 'string' ||
      typeof r.chargerId !== 'string' ||
      typeof r.cardId !== 'string' ||
      typeof r.energyKwh !== 'number'
    ) {
      return null;
    }
    return { type: 'propose', record: r as ChargeSession };
  }
  if (m.type === 'clear_fault') {
    if (typeof m.chargerId !== 'string') return null;
    return { type: 'clear_fault', chargerId: m.chargerId };
  }
  if (m.type === 'snapshot') {
    if (typeof m.rev !== 'number' || !Array.isArray(m.sessions)) return null;
    return {
      type: 'snapshot',
      rev: m.rev,
      sessions: m.sessions as ChargeSession[],
      syncedSessionIds: Array.isArray(m.syncedSessionIds) ? m.syncedSessionIds : [],
      cmsDuplicatesDropped:
        typeof m.cmsDuplicatesDropped === 'number' ? m.cmsDuplicatesDropped : 0,
      chargerFaults:
        m.chargerFaults && typeof m.chargerFaults === 'object'
          ? (m.chargerFaults as Record<string, boolean>)
          : {},
      headOfficeOnline: Boolean(m.headOfficeOnline),
    };
  }
  return null;
}

export function chargerHasFault(state: HubState | ChargerState, chargerId: string): boolean {
  return Boolean(state.chargerFaults[chargerId]);
}

export function sessionsAwaitingCms(state: HubState): number {
  const synced = new Set(state.syncedSessionIds);
  return state.sessions.filter((s) => !synced.has(s.sessionId)).length;
}
