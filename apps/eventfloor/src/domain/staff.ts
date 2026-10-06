/** Flow A — staff roster (demo OfflineID stand-in: staff id + PIN). */

export type StaffProfile = {
  staffId: string;
  displayName: string;
  pin: string;
  unit: string;
};

export const STAFF_ROSTER: StaffProfile[] = [
  { staffId: 'staff-sec', displayName: 'Security Lead', pin: '1001', unit: 'Security' },
  { staffId: 'staff-med', displayName: 'Medical Lead', pin: '2002', unit: 'Medical' },
  { staffId: 'staff-ops', displayName: 'Ops Coordinator', pin: '3003', unit: 'Operations' },
];

export type StaffSession = {
  staffId: string;
  displayName: string;
  unit: string;
};

export function signInStaff(staffId: string, pin: string): StaffSession | null {
  const profile = STAFF_ROSTER.find((s) => s.staffId === staffId);
  if (!profile || profile.pin !== pin.trim()) return null;
  return {
    staffId: profile.staffId,
    displayName: profile.displayName,
    unit: profile.unit,
  };
}

export type StaffAlert = {
  type: 'staff_alert';
  alertId: string;
  body: string;
  section: string;
  senderStaffId: string;
  senderName: string;
  senderUnit: string;
  createdAt: number;
};

export type StaffAck = {
  type: 'staff_ack';
  alertId: string;
  ackStaffId: string;
  ackName: string;
  at: number;
};

export type StaffMessage = StaffAlert | StaffAck;

export const STAFF_SECTIONS = ['Section A', 'Section B', 'Section C', 'Backstage'] as const;

export function newAlertId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parseStaffMessage(data: unknown): StaffMessage | null {
  if (!data || typeof data !== 'object') return null;
  const m = data as Partial<StaffMessage>;
  if (m.type === 'staff_alert') {
    if (
      typeof m.alertId !== 'string' ||
      typeof m.body !== 'string' ||
      typeof m.section !== 'string' ||
      typeof m.senderStaffId !== 'string' ||
      typeof m.senderName !== 'string' ||
      typeof m.createdAt !== 'number'
    ) {
      return null;
    }
    if (!STAFF_ROSTER.some((s) => s.staffId === m.senderStaffId)) return null;
    return {
      type: 'staff_alert',
      alertId: m.alertId.slice(0, 64),
      body: m.body.slice(0, 240),
      section: m.section.slice(0, 40),
      senderStaffId: m.senderStaffId,
      senderName: m.senderName.slice(0, 40),
      senderUnit: typeof m.senderUnit === 'string' ? m.senderUnit.slice(0, 40) : 'Staff',
      createdAt: m.createdAt,
    };
  }
  if (m.type === 'staff_ack') {
    if (
      typeof m.alertId !== 'string' ||
      typeof m.ackStaffId !== 'string' ||
      typeof m.ackName !== 'string' ||
      typeof m.at !== 'number'
    ) {
      return null;
    }
    if (!STAFF_ROSTER.some((s) => s.staffId === m.ackStaffId)) return null;
    return {
      type: 'staff_ack',
      alertId: m.alertId,
      ackStaffId: m.ackStaffId,
      ackName: m.ackName.slice(0, 40),
      at: m.at,
    };
  }
  return null;
}
