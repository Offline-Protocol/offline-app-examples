import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommandState, FieldState } from '../domain/ops';
import { emptyCommand, emptyField } from '../domain/ops';

const KEY = '@outagenet/persist/v1';

export type Persisted = {
  command?: CommandState;
  field?: FieldState;
  hqStoredIds?: string[];
};

export async function loadPersisted(): Promise<Persisted> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Persisted;
    return data ?? {};
  } catch {
    return {};
  }
}

export async function savePersisted(data: Persisted): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[outagenet] persist failed', e);
  }
}

export function sanitizeCommand(state: unknown): CommandState {
  if (!state || typeof state !== 'object') return emptyCommand;
  const s = state as CommandState;
  if (!Array.isArray(s.records) || !Array.isArray(s.syncedIds)) return emptyCommand;
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    records: s.records,
    syncedIds: s.syncedIds,
    hqDuplicatesDropped:
      typeof s.hqDuplicatesDropped === 'number' ? s.hqDuplicatesDropped : 0,
  };
}

export function sanitizeField(state: unknown): FieldState {
  if (!state || typeof state !== 'object') return emptyField;
  const s = state as FieldState;
  if (!Array.isArray(s.records) || !Array.isArray(s.pending)) return emptyField;
  return {
    rev: typeof s.rev === 'number' ? s.rev : -1,
    records: s.records,
    syncedIds: Array.isArray(s.syncedIds) ? s.syncedIds : [],
    hqDuplicatesDropped:
      typeof s.hqDuplicatesDropped === 'number' ? s.hqDuplicatesDropped : 0,
    pending: s.pending,
  };
}
