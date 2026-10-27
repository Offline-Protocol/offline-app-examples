import { describe, expect, it } from '@jest/globals';
import { createDemoFloodAlert } from '../src/domain/alerts';
import {
  buildCheckInProposal,
  checkInForEmployee,
  emptySoc,
  socReducer,
  staffReducer,
  emptyStaffHandset,
} from '../src/domain/rollcall';

describe('rollcall', () => {
  it('accepts roster check-in for active alert', () => {
    const alert = createDemoFloodAlert();
    let soc = socReducer(emptySoc(), { type: 'set_alert', alert });
    const record = buildCheckInProposal({
      alertId: alert.alertId,
      employeeId: 'emp-001',
      displayName: 'Priya N.',
      office: 'BKC Tower',
      status: 'safe',
      deviceId: 'd1',
      now: 100,
    });
    expect(record).not.toBeNull();
    soc = socReducer(soc, { type: 'propose', record: record! });
    expect(soc.checkIns).toHaveLength(1);
    expect(checkInForEmployee(soc.checkIns, alert.alertId, 'emp-001')).toBeDefined();
  });

  it('dedupes same employee on one alert', () => {
    const alert = createDemoFloodAlert();
    let soc = socReducer(emptySoc(), { type: 'set_alert', alert });
    const r1 = buildCheckInProposal({
      alertId: alert.alertId,
      employeeId: 'emp-002',
      displayName: 'Rahul K.',
      office: 'Andheri',
      status: 'help',
      deviceId: 'd1',
    })!;
    const r2 = { ...r1, checkInId: 'other-id', status: 'sos' as const };
    soc = socReducer(soc, { type: 'propose', record: r1 });
    soc = socReducer(soc, { type: 'propose', record: r2 });
    expect(soc.checkIns).toHaveLength(1);
    expect(soc.checkIns[0].status).toBe('help');
  });

  it('staff snapshot marks untrusted bad signature', () => {
    const alert = createDemoFloodAlert();
    const bad = { ...alert, signature: 'na-deadbeee' };
    const staff = staffReducer(emptyStaffHandset(), {
      type: 'snapshot',
      rev: 1,
      activeAlert: bad,
      checkIns: [],
      syncedCheckInIds: [],
      northwindDuplicatesDropped: 0,
      cloudLinkOnline: true,
      myEmployeeId: 'emp-001',
    });
    expect(staff.alertTrusted).toBe(false);
  });
});
