import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HostState, ScannerState } from '../domain/admission';
import { emptyHost, emptyScanner } from '../domain/admission';

const KEY = '@eventfloor/persist/v1';

export type Persisted = {
  host?: HostState;
  scanner?: ScannerState;
  platformStoredScanIds?: string[];
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
    console.warn('[eventfloor] persist failed', e);
  }
}

export function sanitizeHost(state: unknown): HostState {
  if (!state || typeof state !== 'object') return emptyHost();
  const s = state as HostState;
  if (!Array.isArray(s.admissions) || !Array.isArray(s.syncedScanIds)) return emptyHost();
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    admissions: s.admissions,
    syncedScanIds: s.syncedScanIds,
    platformDuplicatesDropped:
      typeof s.platformDuplicatesDropped === 'number' ? s.platformDuplicatesDropped : 0,
  };
}

export function sanitizeScanner(state: unknown): ScannerState {
  if (!state || typeof state !== 'object') return emptyScanner();
  const s = state as ScannerState;
  if (!Array.isArray(s.admissions) || !Array.isArray(s.pendingScanIds)) return emptyScanner();
  return {
    rev: typeof s.rev === 'number' ? s.rev : -1,
    admissions: s.admissions,
    syncedScanIds: Array.isArray(s.syncedScanIds) ? s.syncedScanIds : [],
    platformDuplicatesDropped:
      typeof s.platformDuplicatesDropped === 'number' ? s.platformDuplicatesDropped : 0,
    pendingScanIds: s.pendingScanIds,
    lastResult: s.lastResult ?? null,
  };
}
