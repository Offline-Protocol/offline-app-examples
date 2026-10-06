import { findTicket } from './tickets';

export type AdmissionRecord = {
  scanId: string;
  ticketId: string;
  eventId: string;
  gateId: string;
  gateName: string;
  deviceId: string;
  scannedAt: number;
  holder: string;
  section: string;
};

export type GateMessage =
  | { type: 'propose'; record: AdmissionRecord }
  | {
      type: 'snapshot';
      rev: number;
      admissions: AdmissionRecord[];
      syncedScanIds: string[];
      platformDuplicatesDropped: number;
    };

export const SNAPSHOT_ADMISSIONS = 40;

export type HostState = {
  rev: number;
  admissions: AdmissionRecord[];
  syncedScanIds: string[];
  platformDuplicatesDropped: number;
};

export type ScannerState = {
  rev: number;
  admissions: AdmissionRecord[];
  syncedScanIds: string[];
  platformDuplicatesDropped: number;
  pendingScanIds: string[];
  lastResult: ScanResult | null;
};

export type ScanResult =
  | { outcome: 'admitted'; record: AdmissionRecord }
  | { outcome: 'already_used'; record: AdmissionRecord }
  | { outcome: 'unknown_ticket'; ticketId: string }
  | { outcome: 'invalid'; reason: string };

export const emptyHost = (): HostState => ({
  rev: 0,
  admissions: [],
  syncedScanIds: [],
  platformDuplicatesDropped: 0,
});

export const emptyScanner = (): ScannerState => ({
  rev: -1,
  admissions: [],
  syncedScanIds: [],
  platformDuplicatesDropped: 0,
  pendingScanIds: [],
  lastResult: null,
});

export function newScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function admissionByTicket(
  admissions: AdmissionRecord[],
  ticketId: string,
): AdmissionRecord | undefined {
  const id = ticketId.trim().toUpperCase();
  return admissions.find((a) => a.ticketId === id);
}

export function snapshotOf(state: HostState): GateMessage {
  return {
    type: 'snapshot',
    rev: state.rev,
    admissions: state.admissions.slice(-SNAPSHOT_ADMISSIONS),
    syncedScanIds: state.syncedScanIds,
    platformDuplicatesDropped: state.platformDuplicatesDropped,
  };
}

export type HostAction =
  | { type: 'propose'; record: AdmissionRecord }
  | {
      type: 'mark_synced';
      scanIds: string[];
      duplicatesDropped: number;
    };

export function hostReducer(state: HostState, action: HostAction): HostState {
  switch (action.type) {
    case 'propose': {
      const { record } = action;
      if (state.admissions.some((a) => a.ticketId === record.ticketId)) return state;
      if (state.admissions.some((a) => a.scanId === record.scanId)) return state;
      return {
        ...state,
        rev: state.rev + 1,
        admissions: [...state.admissions, record],
      };
    }
    case 'mark_synced':
      return {
        ...state,
        syncedScanIds: [...new Set([...state.syncedScanIds, ...action.scanIds])],
        platformDuplicatesDropped: state.platformDuplicatesDropped + action.duplicatesDropped,
      };
    default:
      return state;
  }
}

export type ScannerAction =
  | { type: 'queue'; scanId: string }
  | {
      type: 'snapshot';
      rev: number;
      admissions: AdmissionRecord[];
      syncedScanIds: string[];
      platformDuplicatesDropped: number;
    }
  | { type: 'scan_result'; result: ScanResult };

export function scannerReducer(state: ScannerState, action: ScannerAction): ScannerState {
  switch (action.type) {
    case 'queue':
      if (state.pendingScanIds.includes(action.scanId)) return state;
      return { ...state, pendingScanIds: [...state.pendingScanIds, action.scanId] };
    case 'snapshot': {
      if (action.rev < state.rev) return state;
      const known = new Set(action.admissions.map((a) => a.scanId));
      const pendingScanIds = state.pendingScanIds.filter((id) => !known.has(id));
      return {
        rev: action.rev,
        admissions: action.admissions,
        syncedScanIds: action.syncedScanIds,
        platformDuplicatesDropped: action.platformDuplicatesDropped,
        pendingScanIds,
        lastResult: state.lastResult,
      };
    }
    case 'scan_result':
      return { ...state, lastResult: action.result };
    default:
      return state;
  }
}

export function pendingResend(state: ScannerState): string[] {
  const admitted = new Set(state.admissions.map((a) => a.scanId));
  return state.pendingScanIds.filter((id) => !admitted.has(id));
}

export function buildScanProposal(input: {
  ticketId: string;
  eventId: string;
  gateId: string;
  gateName: string;
  deviceId: string;
  now: number;
}): { record: AdmissionRecord } | { error: string } {
  const ticket = findTicket(input.ticketId);
  if (!ticket) return { error: 'Ticket not in offline cache for this event.' };
  return {
    record: {
      scanId: newScanId(),
      ticketId: ticket.ticketId,
      eventId: input.eventId,
      gateId: input.gateId,
      gateName: input.gateName.slice(0, 40),
      deviceId: input.deviceId,
      scannedAt: input.now,
      holder: ticket.holder,
      section: ticket.section,
    },
  };
}

export function evaluateLocalScan(
  admissions: AdmissionRecord[],
  ticketId: string,
): ScanResult {
  const ticket = findTicket(ticketId);
  if (!ticket) return { outcome: 'unknown_ticket', ticketId: ticketId.trim().toUpperCase() };
  const existing = admissionByTicket(admissions, ticket.ticketId);
  if (existing) return { outcome: 'already_used', record: existing };
  return { outcome: 'invalid', reason: 'Host must confirm first scan' };
}

export function parseGateMessage(data: unknown): GateMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Partial<GateMessage>;
  if (m.type === 'propose') {
    const r = m.record as Partial<AdmissionRecord> | undefined;
    if (
      !r ||
      typeof r.scanId !== 'string' ||
      typeof r.ticketId !== 'string' ||
      typeof r.gateId !== 'string'
    ) {
      return null;
    }
    return { type: 'propose', record: r as AdmissionRecord };
  }
  if (m.type === 'snapshot') {
    if (typeof m.rev !== 'number' || !Array.isArray(m.admissions)) return null;
    return {
      type: 'snapshot',
      rev: m.rev,
      admissions: m.admissions as AdmissionRecord[],
      syncedScanIds: Array.isArray(m.syncedScanIds) ? m.syncedScanIds : [],
      platformDuplicatesDropped:
        typeof m.platformDuplicatesDropped === 'number' ? m.platformDuplicatesDropped : 0,
    };
  }
  return null;
}
