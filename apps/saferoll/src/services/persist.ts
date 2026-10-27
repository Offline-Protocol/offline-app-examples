import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SocState, StaffHandsetState } from '../domain/rollcall';
import { emptySoc, emptyStaffHandset } from '../domain/rollcall';
import { verifyAlertSignature, type IncidentAlert } from '../domain/alerts';

const KEY = '@saferoll/persist/v1';

export type Persisted = {
  soc?: SocState;
  staff?: StaffHandsetState;
  northwindStoredCheckInIds?: string[];
};

export async function loadPersisted(): Promise<Persisted> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return (JSON.parse(raw) as Persisted) ?? {};
  } catch {
    return {};
  }
}

export async function savePersisted(data: Persisted): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[saferoll] persist failed', e);
  }
}

function sanitizeAlert(raw: unknown): IncidentAlert | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as IncidentAlert;
  if (typeof a.alertId !== 'string' || typeof a.signature !== 'string') return null;
  if (!verifyAlertSignature(a)) return null;
  return a;
}

export function sanitizeSoc(state: unknown): SocState {
  if (!state || typeof state !== 'object') return emptySoc();
  const s = state as SocState;
  if (!Array.isArray(s.checkIns) || !Array.isArray(s.syncedCheckInIds)) return emptySoc();
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    activeAlert: sanitizeAlert(s.activeAlert),
    checkIns: s.checkIns,
    syncedCheckInIds: s.syncedCheckInIds,
    northwindDuplicatesDropped:
      typeof s.northwindDuplicatesDropped === 'number' ? s.northwindDuplicatesDropped : 0,
    cloudLinkOnline: Boolean(s.cloudLinkOnline),
  };
}

export function sanitizeStaff(state: unknown): StaffHandsetState {
  if (!state || typeof state !== 'object') return emptyStaffHandset();
  const s = state as StaffHandsetState;
  if (!Array.isArray(s.checkIns) || !Array.isArray(s.pendingCheckInIds)) return emptyStaffHandset();
  const activeAlert = sanitizeAlert(s.activeAlert);
  return {
    rev: typeof s.rev === 'number' ? s.rev : -1,
    activeAlert,
    alertTrusted: activeAlert ? verifyAlertSignature(activeAlert) : false,
    checkIns: s.checkIns,
    syncedCheckInIds: Array.isArray(s.syncedCheckInIds) ? s.syncedCheckInIds : [],
    northwindDuplicatesDropped:
      typeof s.northwindDuplicatesDropped === 'number' ? s.northwindDuplicatesDropped : 0,
    cloudLinkOnline: Boolean(s.cloudLinkOnline),
    pendingCheckInIds: s.pendingCheckInIds,
    lastSubmitted: s.lastSubmitted ?? null,
    myCheckIn: s.myCheckIn ?? null,
  };
}
