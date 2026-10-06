import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FieldState, OfficeState } from '../domain/ledger';
import { emptyField, emptyOffice } from '../domain/ledger';

const KEY = '@agrimesh/persist/v1';

export type Persisted = {
  office?: OfficeState;
  field?: FieldState;
  farmStoredReadingIds?: string[];
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
    console.warn('[agrimesh] persist failed', e);
  }
}

export function sanitizeOffice(state: unknown): OfficeState {
  if (!state || typeof state !== 'object') return emptyOffice();
  const s = state as OfficeState;
  if (!Array.isArray(s.readings) || !Array.isArray(s.syncedReadingIds)) return emptyOffice();
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    readings: s.readings,
    syncedReadingIds: s.syncedReadingIds,
    farmDuplicatesDropped:
      typeof s.farmDuplicatesDropped === 'number' ? s.farmDuplicatesDropped : 0,
  };
}

export function sanitizeField(state: unknown): FieldState {
  if (!state || typeof state !== 'object') return emptyField();
  const s = state as FieldState;
  if (!Array.isArray(s.readings) || !Array.isArray(s.pendingReadingIds)) return emptyField();
  return {
    rev: typeof s.rev === 'number' ? s.rev : -1,
    readings: s.readings,
    syncedReadingIds: Array.isArray(s.syncedReadingIds) ? s.syncedReadingIds : [],
    farmDuplicatesDropped:
      typeof s.farmDuplicatesDropped === 'number' ? s.farmDuplicatesDropped : 0,
    pendingReadingIds: s.pendingReadingIds,
    lastLogged: s.lastLogged ?? null,
  };
}
