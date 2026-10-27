import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseHandoff, type Handoff, type Vehicle } from '../domain/handoff';
import type { Session } from './fleetPlatform';

const KEY = '@dockhand/persist/v1';

export type SyncReport = {
  at: number;
  target: 'contosoFleet' | 'mock';
  added: number;
  duplicates: number;
  error?: string;
};

export type Persisted = {
  /** Yard: check-ins received. Driver: own check-ins. Both: what gets synced. */
  handoffs: Handoff[];
  /** handoffIds this device has synced (to Contoso Fleet or the mock). */
  syncedIds: string[];
  mockStored: string[];
  session: Session | null;
  /** Contoso Fleet devices from the last sign-in. Empty means demo vehicles. */
  vehicles: Vehicle[];
  vehicleId: string;
  lastSync: SyncReport | null;
};

export const emptyPersisted: Persisted = {
  handoffs: [],
  syncedIds: [],
  mockStored: [],
  session: null,
  vehicles: [],
  vehicleId: '',
  lastSync: null,
};

export async function loadPersisted(): Promise<Persisted> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : emptyPersisted;
  } catch {
    return emptyPersisted;
  }
}

export async function savePersisted(data: Persisted): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[dockhand] persist failed', e);
  }
}

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function sanitize(data: unknown): Persisted {
  if (!data || typeof data !== 'object') return emptyPersisted;
  const d = data as Record<string, unknown>;
  const s = d.session as Session | null | undefined;
  const session =
    s &&
    typeof s.server === 'string' &&
    typeof s.credentials?.sessionId === 'string'
      ? s
      : null;
  return {
    handoffs: Array.isArray(d.handoffs)
      ? d.handoffs.map(parseHandoff).filter((h): h is Handoff => h !== null)
      : [],
    syncedIds: strings(d.syncedIds),
    mockStored: strings(d.mockStored),
    session,
    vehicles: Array.isArray(d.vehicles)
      ? (d.vehicles as Vehicle[]).filter(
          (v) => typeof v?.id === 'string' && typeof v?.name === 'string',
        )
      : [],
    vehicleId: typeof d.vehicleId === 'string' ? d.vehicleId : '',
    lastSync: (d.lastSync as SyncReport | null) ?? null,
  };
}
