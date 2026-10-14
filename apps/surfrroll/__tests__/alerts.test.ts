import { describe, expect, it } from '@jest/globals';
import {
  createDemoFloodAlert,
  signAlert,
  verifyAlertSignature,
  alertSigningPayload,
} from '../src/domain/alerts';

describe('alerts', () => {
  it('signs and verifies demo flood alert', () => {
    const alert = createDemoFloodAlert(1_700_000_000_000);
    expect(verifyAlertSignature(alert)).toBe(true);
    expect(alert.signature).toMatch(/^ds-/);
  });

  it('rejects tampered body', () => {
    const alert = createDemoFloodAlert();
    const tampered = { ...alert, body: alert.body + ' spoof' };
    expect(verifyAlertSignature(tampered)).toBe(false);
  });

  it('signAlert is stable for same payload', () => {
    const base = {
      alertId: 'a1',
      clientId: 'c1',
      title: 't',
      body: 'b',
      severity: 'incident' as const,
      affectedOffices: ['X'],
      issuedAt: 100,
    };
    expect(signAlert(base)).toBe(signAlert(base));
    expect(alertSigningPayload(base)).toContain('a1');
  });
});
