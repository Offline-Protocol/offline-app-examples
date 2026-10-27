import { verifyAlertSignature, type IncidentAlert } from './alerts';
import { isRosterEmployee } from './roster';

export type CheckInStatus = 'safe' | 'help' | 'sos';

export type CheckInRecord = {
  checkInId: string;
  alertId: string;
  employeeId: string;
  displayName: string;
  office: string;
  status: CheckInStatus;
  deviceId: string;
  at: number;
};

export type RollcallMessage =
  | { type: 'propose'; record: CheckInRecord }
  | {
      type: 'snapshot';
      rev: number;
      activeAlert: IncidentAlert | null;
      checkIns: CheckInRecord[];
      syncedCheckInIds: string[];
      northwindDuplicatesDropped: number;
      cloudLinkOnline: boolean;
    };

export const SNAPSHOT_CHECKINS = 48;

let checkInSeq = 0;

function checkInIdSuffix(): string {
  checkInSeq += 1;
  const mix = (Date.now() * 31 + checkInSeq * 997) >>> 0;
  return mix.toString(16).padStart(8, '0');
}

export function newCheckInId(): string {
  return `checkin-${Date.now().toString(36)}-${checkInIdSuffix()}`;
}

export type SocState = {
  rev: number;
  activeAlert: IncidentAlert | null;
  checkIns: CheckInRecord[];
  syncedCheckInIds: string[];
  northwindDuplicatesDropped: number;
  cloudLinkOnline: boolean;
};

export type StaffHandsetState = {
  rev: number;
  activeAlert: IncidentAlert | null;
  alertTrusted: boolean;
  checkIns: CheckInRecord[];
  syncedCheckInIds: string[];
  northwindDuplicatesDropped: number;
  cloudLinkOnline: boolean;
  pendingCheckInIds: string[];
  lastSubmitted: CheckInRecord | null;
  myCheckIn: CheckInRecord | null;
};

export const emptySoc = (): SocState => ({
  rev: 0,
  activeAlert: null,
  checkIns: [],
  syncedCheckInIds: [],
  northwindDuplicatesDropped: 0,
  cloudLinkOnline: false,
});

export const emptyStaffHandset = (): StaffHandsetState => ({
  rev: -1,
  activeAlert: null,
  alertTrusted: false,
  checkIns: [],
  syncedCheckInIds: [],
  northwindDuplicatesDropped: 0,
  cloudLinkOnline: false,
  pendingCheckInIds: [],
  lastSubmitted: null,
  myCheckIn: null,
});

export function snapshotOf(state: SocState): RollcallMessage {
  return {
    type: 'snapshot',
    rev: state.rev,
    activeAlert: state.activeAlert,
    checkIns: state.checkIns.slice(-SNAPSHOT_CHECKINS),
    syncedCheckInIds: state.syncedCheckInIds,
    northwindDuplicatesDropped: state.northwindDuplicatesDropped,
    cloudLinkOnline: state.cloudLinkOnline,
  };
}

export function checkInForEmployee(
  checkIns: CheckInRecord[],
  alertId: string,
  employeeId: string,
): CheckInRecord | undefined {
  return checkIns.find((c) => c.alertId === alertId && c.employeeId === employeeId);
}

export type SocAction =
  | { type: 'set_alert'; alert: IncidentAlert | null }
  | { type: 'propose'; record: CheckInRecord }
  | {
      type: 'mark_synced';
      checkInIds: string[];
      duplicatesDropped: number;
    }
  | { type: 'set_cloud_link'; online: boolean };

export function socReducer(state: SocState, action: SocAction): SocState {
  switch (action.type) {
    case 'set_cloud_link':
      return { ...state, cloudLinkOnline: action.online };
    case 'set_alert':
      if (action.alert && !verifyAlertSignature(action.alert)) return state;
      return { ...state, rev: state.rev + 1, activeAlert: action.alert };
    case 'propose': {
      const { record } = action;
      if (!state.activeAlert || record.alertId !== state.activeAlert.alertId) return state;
      if (!isRosterEmployee(record.employeeId)) return state;
      if (state.checkIns.some((c) => c.checkInId === record.checkInId)) return state;
      if (checkInForEmployee(state.checkIns, record.alertId, record.employeeId)) return state;
      return {
        ...state,
        rev: state.rev + 1,
        checkIns: [...state.checkIns, record],
      };
    }
    case 'mark_synced':
      return {
        ...state,
        syncedCheckInIds: [...new Set([...state.syncedCheckInIds, ...action.checkInIds])],
        northwindDuplicatesDropped: state.northwindDuplicatesDropped + action.duplicatesDropped,
      };
    default:
      return state;
  }
}

export type StaffAction =
  | { type: 'queue'; checkInId: string }
  | {
      type: 'snapshot';
      rev: number;
      activeAlert: IncidentAlert | null;
      checkIns: CheckInRecord[];
      syncedCheckInIds: string[];
      northwindDuplicatesDropped: number;
      cloudLinkOnline: boolean;
      myEmployeeId: string;
    }
  | { type: 'submitted'; record: CheckInRecord };

export function staffReducer(state: StaffHandsetState, action: StaffAction): StaffHandsetState {
  switch (action.type) {
    case 'queue':
      if (state.pendingCheckInIds.includes(action.checkInId)) return state;
      return { ...state, pendingCheckInIds: [...state.pendingCheckInIds, action.checkInId] };
    case 'submitted':
      return {
        ...state,
        lastSubmitted: action.record,
        myCheckIn: action.record,
        pendingCheckInIds: state.pendingCheckInIds.filter((id) => id !== action.record.checkInId),
      };
    case 'snapshot': {
      const trusted = action.activeAlert ? verifyAlertSignature(action.activeAlert) : false;
      const myCheckIn =
        action.activeAlert && action.myEmployeeId
          ? checkInForEmployee(action.checkIns, action.activeAlert.alertId, action.myEmployeeId) ??
            state.myCheckIn
          : null;
      const pending = state.pendingCheckInIds.filter(
        (id) => !action.checkIns.some((c) => c.checkInId === id),
      );
      return {
        ...state,
        rev: action.rev,
        activeAlert: action.activeAlert,
        alertTrusted: trusted,
        checkIns: action.checkIns,
        syncedCheckInIds: action.syncedCheckInIds,
        northwindDuplicatesDropped: action.northwindDuplicatesDropped,
        cloudLinkOnline: action.cloudLinkOnline,
        pendingCheckInIds: pending,
        myCheckIn: myCheckIn?.alertId === action.activeAlert?.alertId ? myCheckIn : null,
      };
    }
    default:
      return state;
  }
}

export function pendingResend(state: StaffHandsetState): string[] {
  return state.pendingCheckInIds;
}

export function parseRollcallMessage(data: unknown): RollcallMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Partial<RollcallMessage>;
  if (m.type === 'propose') {
    const r = m.record as Partial<CheckInRecord> | undefined;
    if (
      !r ||
      typeof r.checkInId !== 'string' ||
      typeof r.alertId !== 'string' ||
      typeof r.employeeId !== 'string' ||
      typeof r.displayName !== 'string' ||
      typeof r.office !== 'string' ||
      (r.status !== 'safe' && r.status !== 'help' && r.status !== 'sos') ||
      typeof r.deviceId !== 'string' ||
      typeof r.at !== 'number'
    ) {
      return null;
    }
    if (!isRosterEmployee(r.employeeId)) return null;
    return {
      type: 'propose',
      record: {
        checkInId: r.checkInId.slice(0, 64),
        alertId: r.alertId.slice(0, 64),
        employeeId: r.employeeId,
        displayName: r.displayName.slice(0, 40),
        office: r.office.slice(0, 60),
        status: r.status,
        deviceId: r.deviceId.slice(0, 64),
        at: r.at,
      },
    };
  }
  if (m.type === 'snapshot') {
    if (typeof m.rev !== 'number' || !Array.isArray(m.checkIns) || !Array.isArray(m.syncedCheckInIds)) {
      return null;
    }
    let activeAlert: IncidentAlert | null = null;
    if (m.activeAlert && typeof m.activeAlert === 'object') {
      const a = m.activeAlert as Partial<IncidentAlert>;
      if (
        typeof a.alertId === 'string' &&
        typeof a.clientId === 'string' &&
        typeof a.title === 'string' &&
        typeof a.body === 'string' &&
        (a.severity === 'advisory' || a.severity === 'incident' || a.severity === 'critical') &&
        Array.isArray(a.affectedOffices) &&
        typeof a.issuedAt === 'number' &&
        typeof a.signature === 'string'
      ) {
        activeAlert = {
          alertId: a.alertId.slice(0, 64),
          clientId: a.clientId.slice(0, 40),
          title: a.title.slice(0, 120),
          body: a.body.slice(0, 480),
          severity: a.severity,
          affectedOffices: a.affectedOffices.map((o) => String(o).slice(0, 60)).slice(0, 12),
          issuedAt: a.issuedAt,
          signature: a.signature.slice(0, 32),
        };
      }
    }
    return {
      type: 'snapshot',
      rev: m.rev,
      activeAlert,
      checkIns: m.checkIns as CheckInRecord[],
      syncedCheckInIds: m.syncedCheckInIds as string[],
      northwindDuplicatesDropped:
        typeof m.northwindDuplicatesDropped === 'number' ? m.northwindDuplicatesDropped : 0,
      cloudLinkOnline: Boolean(m.cloudLinkOnline),
    };
  }
  return null;
}

export function buildCheckInProposal(input: {
  alertId: string;
  employeeId: string;
  displayName: string;
  office: string;
  status: CheckInStatus;
  deviceId: string;
  now?: number;
}): CheckInRecord | null {
  if (!isRosterEmployee(input.employeeId)) return null;
  return {
    checkInId: newCheckInId(),
    alertId: input.alertId,
    employeeId: input.employeeId,
    displayName: input.displayName,
    office: input.office,
    status: input.status,
    deviceId: input.deviceId,
    at: input.now ?? Date.now(),
  };
}
