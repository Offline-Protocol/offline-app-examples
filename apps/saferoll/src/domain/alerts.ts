import { DEMO_CLIENT } from './roster';

/** Demo Northwind Alerts signing secret — production would use platform keys + OfflineID. */
export const NORTHWIND_SIGNING_SALT = 'northwind-alerts-demo-v1';

export type IncidentSeverity = 'advisory' | 'incident' | 'critical';

export type IncidentAlert = {
  alertId: string;
  clientId: string;
  title: string;
  body: string;
  severity: IncidentSeverity;
  affectedOffices: string[];
  issuedAt: number;
  signature: string;
};

export function alertSigningPayload(alert: Omit<IncidentAlert, 'signature'>): string {
  return [
    alert.alertId,
    alert.clientId,
    alert.title,
    alert.body,
    alert.severity,
    alert.affectedOffices.join('|'),
    String(alert.issuedAt),
    NORTHWIND_SIGNING_SALT,
  ].join('\n');
}

/** Deterministic demo signature (not cryptographic — shows verify/reject UX). */
export function signAlert(alert: Omit<IncidentAlert, 'signature'>): string {
  const payload = alertSigningPayload(alert);
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `na-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function verifyAlertSignature(alert: IncidentAlert): boolean {
  if (!alert.signature.startsWith('na-')) return false;
  const expected = signAlert({
    alertId: alert.alertId,
    clientId: alert.clientId,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    affectedOffices: alert.affectedOffices,
    issuedAt: alert.issuedAt,
  });
  return alert.signature === expected;
}

export function newAlertId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Mock ingest from Northwind Alerts when the SOC cloud link is up. */
export function createDemoFloodAlert(now = Date.now()): IncidentAlert {
  const base = {
    alertId: newAlertId(),
    clientId: DEMO_CLIENT.clientId,
    title: 'Urban flood — Mumbai western suburbs',
    body:
      'IMD red alert: intense rainfall and localised flooding. Avoid BKC–Andheri corridor; ' +
      'activate travel hold for field staff. Northwind Alerts linked 3 offices and 12 travel segments.',
    severity: 'critical' as const,
    affectedOffices: ['BKC Tower', 'Andheri campus', 'Travel — Navi Mumbai'],
    issuedAt: now,
  };
  return { ...base, signature: signAlert(base) };
}
