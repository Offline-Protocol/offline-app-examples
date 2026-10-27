/** Demo employee roster (OfflineID / HR stand-in: employee id + PIN). */

export type EmployeeProfile = {
  employeeId: string;
  displayName: string;
  pin: string;
  office: string;
  role: string;
};

export const DEMO_CLIENT = {
  clientId: 'client-demo-bank',
  name: 'Demo Global Bank',
  region: 'Mumbai metro',
} as const;

export const EMPLOYEE_ROSTER: EmployeeProfile[] = [
  {
    employeeId: 'emp-001',
    displayName: 'Priya N.',
    pin: '4101',
    office: 'BKC Tower',
    role: 'Branch ops',
  },
  {
    employeeId: 'emp-002',
    displayName: 'Rahul K.',
    pin: '4102',
    office: 'Andheri campus',
    role: 'Facilities',
  },
  {
    employeeId: 'emp-003',
    displayName: 'Anita S.',
    pin: '4103',
    office: 'Travel — Navi Mumbai',
    role: 'Field sales',
  },
  {
    employeeId: 'emp-004',
    displayName: 'Vikram M.',
    pin: '4104',
    office: 'BKC Tower',
    role: 'Security',
  },
];

export type EmployeeSession = {
  employeeId: string;
  displayName: string;
  office: string;
  role: string;
};

export function signInEmployee(employeeId: string, pin: string): EmployeeSession | null {
  const profile = EMPLOYEE_ROSTER.find((e) => e.employeeId === employeeId);
  if (!profile || profile.pin !== pin.trim()) return null;
  return {
    employeeId: profile.employeeId,
    displayName: profile.displayName,
    office: profile.office,
    role: profile.role,
  };
}

export function isRosterEmployee(employeeId: string): boolean {
  return EMPLOYEE_ROSTER.some((e) => e.employeeId === employeeId);
}
