// Driver -> yard handoffs: pure functions only (no React, no Bluetooth, no network).
//
// A driver checks in with load details and signs them. The yard (room host)
// stores the check-in only if the driver's signature verifies, assigns a dock
// and countersigns. The yard's signature covers the driver's exact check-in and
// signature, so the pair is a receipt neither side can change afterwards.
//
// Every record carries a stable handoffId: mesh resends, repeat check-ins and
// repeat syncs to Contoso Fleet all dedupe on it.

import type { Signed } from '@offline-app-examples/mesh';

export const DOCKS = [
  'Dock 1',
  'Dock 2',
  'Dock 3',
  'Dock 4',
  'Dock 5',
  'Dock 6',
] as const;
export type Dock = (typeof DOCKS)[number];

/** A Contoso Fleet Device (id + name), or a demo vehicle when not signed in. */
export type Vehicle = { id: string; name: string };

export type Load = {
  bol: string;
  trailer: string;
  seal: string;
  pallets: number;
};

export type Assignment = {
  dock: Dock;
  yardId: string;
  yardName: string;
  assignedAt: number;
  yardSig: Signed;
};

export type Handoff = {
  handoffId: string;
  vehicle: Vehicle;
  driverId: string;
  driverName: string;
  load: Load;
  checkedInAt: number;
  driverSig: Signed;
  assignment?: Assignment;
};

export type Message =
  /** driver -> yard */
  | { type: 'checkin'; handoff: Handoff }
  /** yard -> one driver: that driver's handoffs as the yard holds them */
  | { type: 'yours'; handoffs: Handoff[] };

export const DEMO_VEHICLES: Vehicle[] = [
  { id: 'demo-truck-12', name: 'Truck 12 (demo)' },
  { id: 'demo-truck-27', name: 'Truck 27 (demo)' },
];

export const HANDOFFS_MAX = 50;
export const YOURS_MAX = 20;
const ID_MAX = 48;
const NAME_MAX = 40;
const FIELD_MAX = 30;

// ------------------------------------------------------- signed payloads

/** The exact text the driver signs. An array, so field order can never drift. */
export function checkInText(
  h: Omit<Handoff, 'driverSig' | 'assignment'>,
): string {
  return JSON.stringify([
    'dockhand/checkin/v1',
    h.handoffId,
    h.vehicle.id,
    h.vehicle.name,
    h.driverId,
    h.driverName,
    h.load.bol,
    h.load.trailer,
    h.load.seal,
    h.load.pallets,
    h.checkedInAt,
  ]);
}

/** The exact text the yard signs: the driver's check-in and signature, plus the dock. */
export function assignmentText(
  h: Handoff,
  a: Omit<Assignment, 'yardSig'>,
): string {
  return JSON.stringify([
    'dockhand/assign/v1',
    checkInText(h),
    h.driverSig.signature,
    a.dock,
    a.yardId,
    a.yardName,
    a.assignedAt,
  ]);
}

// ---------------------------------------------------------------- ledger

/** Adds `h` unless its handoffId is already known. Returns the same array when unchanged. */
export function addHandoff(list: Handoff[], h: Handoff): Handoff[] {
  if (list.some((x) => x.handoffId === h.handoffId)) return list;
  return [...list, h].slice(-HANDOFFS_MAX);
}

/** Sets the assignment on an unassigned handoff. A handoff is assigned once. */
export function assign(
  list: Handoff[],
  handoffId: string,
  a: Assignment,
): Handoff[] {
  const i = list.findIndex((x) => x.handoffId === handoffId);
  if (i < 0 || list[i].assignment) return list;
  const next = list.slice();
  next[i] = { ...list[i], assignment: a };
  return next;
}

/** Driver: own handoffs still waiting for the yard to acknowledge them. */
export function awaitingYard(
  list: Handoff[],
  driverId: string,
  yardHas: Set<string>,
): Handoff[] {
  return list.filter(
    (h) =>
      h.driverId === driverId && !h.assignment && !yardHas.has(h.handoffId),
  );
}

export function yoursFor(list: Handoff[], driverId: string): Message {
  return {
    type: 'yours',
    handoffs: list.filter((h) => h.driverId === driverId).slice(-YOURS_MAX),
  };
}

export function newHandoffId(): string {
  return `ho-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------ validation

export function parseMessage(data: unknown): Message | null {
  if (!isObject(data)) return null;
  if (data.type === 'checkin') {
    const handoff = parseHandoff(data.handoff);
    return handoff && !handoff.assignment ? { type: 'checkin', handoff } : null;
  }
  if (data.type === 'yours') {
    if (!Array.isArray(data.handoffs) || data.handoffs.length > YOURS_MAX)
      return null;
    const handoffs = data.handoffs.map(parseHandoff);
    if (handoffs.some((h) => h === null)) return null;
    return { type: 'yours', handoffs: handoffs as Handoff[] };
  }
  return null;
}

export function parseHandoff(data: unknown): Handoff | null {
  if (!isObject(data)) return null;
  const {
    handoffId,
    vehicle,
    driverId,
    driverName,
    load,
    checkedInAt,
    driverSig,
    assignment,
  } = data;
  if (!isHandoffId(handoffId)) return null;
  if (
    !isObject(vehicle) ||
    !isText(vehicle.id, 1, ID_MAX) ||
    !isText(vehicle.name, 1, NAME_MAX)
  )
    return null;
  if (!isText(driverId, 1, 80) || !isText(driverName, 0, NAME_MAX)) return null;
  if (!isObject(load)) return null;
  if (!isText(load.bol, 1, FIELD_MAX) || !isText(load.trailer, 1, FIELD_MAX))
    return null;
  if (!isText(load.seal, 0, FIELD_MAX) || !isInt(load.pallets, 0, 99))
    return null;
  if (!isInt(checkedInAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  const sig = parseSigned(driverSig);
  if (!sig) return null;
  const h: Handoff = {
    handoffId,
    vehicle: { id: vehicle.id, name: vehicle.name },
    driverId,
    driverName,
    load: {
      bol: load.bol,
      trailer: load.trailer,
      seal: load.seal,
      pallets: load.pallets,
    },
    checkedInAt,
    driverSig: sig,
  };
  if (assignment === undefined) return h;
  if (!isObject(assignment)) return null;
  const { dock, yardId, yardName, assignedAt, yardSig } = assignment;
  const ySig = parseSigned(yardSig);
  if (
    !DOCKS.includes(dock as Dock) ||
    !isText(yardId, 1, 80) ||
    !isText(yardName, 0, NAME_MAX)
  )
    return null;
  if (!isInt(assignedAt, 0, Number.MAX_SAFE_INTEGER) || !ySig) return null;
  return {
    ...h,
    assignment: {
      dock: dock as Dock,
      yardId,
      yardName,
      assignedAt,
      yardSig: ySig,
    },
  };
}

/** Also guards the Contoso Fleet where clause, which interpolates this id. */
export function isHandoffId(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9-]{1,48}$/.test(v);
}

function parseSigned(v: unknown): Signed | null {
  if (!isObject(v)) return null;
  const { publicKey, signature } = v;
  if (!isText(publicKey, 64, 64) || !isText(signature, 128, 128)) return null;
  return { publicKey, signature };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

function isText(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}
