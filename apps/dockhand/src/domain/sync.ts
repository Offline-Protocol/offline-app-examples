// What gets synced to Contoso Fleet, and the mock ingest used when not signed in.
// Pure functions only.

import type { Signed } from '@offline-app-examples/mesh';
import { assignmentText, checkInText, type Handoff } from './handoff';

/** A GPS point the vehicle's tracker logged. */
export type GpsFix = { latitude: number; longitude: number; dateTime: string };

/** One AddInRecord `details` object. Contoso Fleet caps it at 10,000 characters. */
export type HandoffDetails = {
  handoffId: string;
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  driverAddress: string;
  bol: string;
  trailer: string;
  seal: string;
  pallets: number;
  dock: string;
  yardName: string;
  checkedInAt: string;
  assignedAt: string;
  /** The signed texts themselves, so a verifier needs no copy of our encoding. */
  signed: { checkIn: string; driver: Signed; assignment: string; yard: Signed };
  /** Where the tracker put the vehicle closest to check-in time. Null for demo vehicles. */
  gpsFix: GpsFix | null;
  source: 'dockhand/1';
};

export const DETAILS_MAX_CHARS = 10_000;

/** Handoffs that are complete (dock assigned) and not yet synced from this device. */
export function unsynced(list: Handoff[], syncedIds: string[]): Handoff[] {
  const done = new Set(syncedIds);
  return list.filter((h) => h.assignment && !done.has(h.handoffId));
}

export function toDetails(h: Handoff, gpsFix: GpsFix | null): HandoffDetails {
  const a = h.assignment;
  if (!a) throw new Error(`Handoff ${h.handoffId} has no dock yet.`);
  return {
    handoffId: h.handoffId,
    vehicleId: h.vehicle.id,
    vehicleName: h.vehicle.name,
    driverName: h.driverName,
    driverAddress: h.driverId,
    bol: h.load.bol,
    trailer: h.load.trailer,
    seal: h.load.seal,
    pallets: h.load.pallets,
    dock: a.dock,
    yardName: a.yardName,
    checkedInAt: new Date(h.checkedInAt).toISOString(),
    assignedAt: new Date(a.assignedAt).toISOString(),
    signed: {
      checkIn: checkInText(h),
      driver: h.driverSig,
      assignment: assignmentText(h, a),
      yard: a.yardSig,
    },
    gpsFix,
    source: 'dockhand/1',
  };
}

export const isDemoVehicle = (vehicleId: string) =>
  vehicleId.startsWith('demo-');

/** The fix closest in time to `at`, or null. */
export function nearestFix(fixes: GpsFix[], at: number): GpsFix | null {
  let best: GpsFix | null = null;
  let bestGap = Infinity;
  for (const f of fixes) {
    const gap = Math.abs(Date.parse(f.dateTime) - at);
    if (gap < bestGap) {
      best = f;
      bestGap = gap;
    }
  }
  return best;
}

/** Mock ingest, idempotent by handoffId: what Contoso Fleet's duplicate check does, offline. */
export function mockIngest(
  stored: string[],
  ids: string[],
): { stored: string[]; added: string[]; duplicates: number } {
  const next = new Set(stored);
  const added: string[] = [];
  let duplicates = 0;
  for (const id of ids) {
    if (next.has(id)) duplicates++;
    else {
      next.add(id);
      added.push(id);
    }
  }
  return { stored: [...next], added, duplicates };
}
