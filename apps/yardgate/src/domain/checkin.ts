export const CHECKIN_METHOD = 'checkin';
export const SERVICE_SUFFIX = '-gate';

/** Mesh SDK `respondToServiceRequest` / response events — not HTTP status codes. */
export const SERVICE_STATUS_OK = 'ok';
export const SERVICE_STATUS_ERROR = 'error';
export const SERVICE_STATUS_NOT_FOUND = 'not_found';

export function encodeServiceError(message: string): string {
  return JSON.stringify({ message: message.slice(0, 120) });
}

export function parseServiceError(body: string): string | null {
  try {
    const raw = JSON.parse(body) as { message?: string };
    return typeof raw.message === 'string' ? raw.message.slice(0, 200) : null;
  } catch {
    return body.slice(0, 200) || null;
  }
}

export type CheckInPayload = {
  checkInId: string;
  loadId: string;
  trailerId: string;
  driverName: string;
  createdAt: number;
};

export type GateDecision = 'approved' | 'denied';

export type CheckInDecision = {
  checkInId: string;
  decision: GateDecision;
  gateOfficer: string;
  at: number;
  note?: string;
};

export type PendingCheckIn = CheckInPayload & {
  requestId: string;
  sender: string;
  receivedAt: number;
};

export type GateState = {
  pending: PendingCheckIn[];
  decided: CheckInDecision[];
  duplicateResponses: number;
};

export const emptyGate = (): GateState => ({
  pending: [],
  decided: [],
  duplicateResponses: 0,
});

export const SEEDED_LOADS = [
  { loadId: 'LD-1042', trailerId: 'TRL-88' },
  { loadId: 'LD-2201', trailerId: 'TRL-12' },
  { loadId: 'LD-3310', trailerId: 'TRL-55' },
] as const;

export function newCheckInId(prefix = 'chk'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function encodeCheckIn(payload: CheckInPayload): string {
  return JSON.stringify(payload);
}

export function parseCheckIn(body: string): CheckInPayload | null {
  try {
    const raw = JSON.parse(body) as Partial<CheckInPayload>;
    if (
      typeof raw.checkInId !== 'string' ||
      typeof raw.loadId !== 'string' ||
      typeof raw.trailerId !== 'string' ||
      typeof raw.driverName !== 'string' ||
      typeof raw.createdAt !== 'number'
    ) {
      return null;
    }
    return {
      checkInId: raw.checkInId.slice(0, 64),
      loadId: raw.loadId.slice(0, 32),
      trailerId: raw.trailerId.slice(0, 32),
      driverName: raw.driverName.slice(0, 40),
      createdAt: raw.createdAt,
    };
  } catch {
    return null;
  }
}

export function encodeDecision(decision: CheckInDecision): string {
  return JSON.stringify(decision);
}

export function parseDecision(body: string): CheckInDecision | null {
  try {
    const raw = JSON.parse(body) as Partial<CheckInDecision>;
    if (
      typeof raw.checkInId !== 'string' ||
      (raw.decision !== 'approved' && raw.decision !== 'denied') ||
      typeof raw.gateOfficer !== 'string' ||
      typeof raw.at !== 'number'
    ) {
      return null;
    }
    return {
      checkInId: raw.checkInId,
      decision: raw.decision,
      gateOfficer: raw.gateOfficer,
      at: raw.at,
      note: typeof raw.note === 'string' ? raw.note.slice(0, 120) : undefined,
    };
  } catch {
    return null;
  }
}

export function findDecision(state: GateState, checkInId: string): CheckInDecision | undefined {
  return state.decided.find((d) => d.checkInId === checkInId);
}

export type GateAction =
  | {
      type: 'request_received';
      requestId: string;
      sender: string;
      payload: CheckInPayload;
      at: number;
    }
  | {
      type: 'decide';
      checkInId: string;
      decision: GateDecision;
      gateOfficer: string;
      note?: string;
      at: number;
    }
  | { type: 'duplicate_response' };

export function gateReducer(state: GateState, action: GateAction): GateState {
  switch (action.type) {
    case 'duplicate_response':
      return { ...state, duplicateResponses: state.duplicateResponses + 1 };
    case 'request_received': {
      if (findDecision(state, action.payload.checkInId)) {
        return { ...state, duplicateResponses: state.duplicateResponses + 1 };
      }
      if (state.pending.some((p) => p.checkInId === action.payload.checkInId)) {
        return { ...state, duplicateResponses: state.duplicateResponses + 1 };
      }
      if (state.pending.some((p) => p.requestId === action.requestId)) return state;
      const pending: PendingCheckIn = {
        ...action.payload,
        requestId: action.requestId,
        sender: action.sender,
        receivedAt: action.at,
      };
      return { ...state, pending: [...state.pending, pending] };
    }
    case 'decide': {
      const pending = state.pending.filter((p) => p.checkInId !== action.checkInId);
      if (state.decided.some((d) => d.checkInId === action.checkInId)) {
        return { ...state, pending };
      }
      const decided: CheckInDecision = {
        checkInId: action.checkInId,
        decision: action.decision,
        gateOfficer: action.gateOfficer,
        at: action.at,
        note: action.note,
      };
      return { ...state, pending, decided: [...state.decided, decided] };
    }
    default:
      return state;
  }
}

export type DriverState = {
  status: 'idle' | 'submitting' | 'waiting' | 'done' | 'error';
  lastCheckInId: string | null;
  lastDecision: CheckInDecision | null;
  error: string;
};

export const emptyDriver = (): DriverState => ({
  status: 'idle',
  lastCheckInId: null,
  lastDecision: null,
  error: '',
});
