import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChargerState, HubState } from '../domain/sessions';
import { emptyCharger, emptyHub } from '../domain/sessions';

const KEY = '@chargecatch/persist/v1';

export type Persisted = {
  hub?: HubState;
  charger?: ChargerState;
  cmsStoredSessionIds?: string[];
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
    console.warn('[chargecatch] persist failed', e);
  }
}

export function sanitizeHub(state: unknown): HubState {
  if (!state || typeof state !== 'object') return emptyHub();
  const s = state as HubState;
  if (!Array.isArray(s.sessions) || !Array.isArray(s.syncedSessionIds)) return emptyHub();
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    sessions: s.sessions,
    syncedSessionIds: s.syncedSessionIds,
    cmsDuplicatesDropped:
      typeof s.cmsDuplicatesDropped === 'number' ? s.cmsDuplicatesDropped : 0,
    chargerFaults:
      s.chargerFaults && typeof s.chargerFaults === 'object'
        ? { 'CP-A': false, 'CP-B': false, ...s.chargerFaults }
        : { 'CP-A': false, 'CP-B': false },
    headOfficeOnline: Boolean(s.headOfficeOnline),
  };
}

export function sanitizeCharger(state: unknown): ChargerState {
  if (!state || typeof state !== 'object') return emptyCharger();
  const s = state as ChargerState;
  if (!Array.isArray(s.sessions) || !Array.isArray(s.pendingSessionIds)) return emptyCharger();
  return {
    rev: typeof s.rev === 'number' ? s.rev : -1,
    sessions: s.sessions,
    syncedSessionIds: Array.isArray(s.syncedSessionIds) ? s.syncedSessionIds : [],
    cmsDuplicatesDropped:
      typeof s.cmsDuplicatesDropped === 'number' ? s.cmsDuplicatesDropped : 0,
    pendingSessionIds: s.pendingSessionIds,
    lastSession: s.lastSession ?? null,
    chargerFaults:
      s.chargerFaults && typeof s.chargerFaults === 'object'
        ? { 'CP-A': false, 'CP-B': false, ...s.chargerFaults }
        : { 'CP-A': false, 'CP-B': false },
    headOfficeOnline: Boolean(s.headOfficeOnline),
  };
}
