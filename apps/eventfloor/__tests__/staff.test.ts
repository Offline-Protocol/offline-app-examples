import { describe, expect, it } from '@jest/globals';
import { parseStaffMessage, signInStaff, STAFF_ROSTER } from '../src/domain/staff';

describe('staff roster', () => {
  it('signs in with demo PIN', () => {
    const profile = STAFF_ROSTER[0];
    expect(signInStaff(profile.staffId, profile.pin)?.displayName).toBe(profile.displayName);
    expect(signInStaff(profile.staffId, '0000')).toBeNull();
  });

  it('parses staff alerts from roster members only', () => {
    const alert = {
      type: 'staff_alert' as const,
      alertId: 'a1',
      body: 'Medic',
      section: 'Section B',
      senderStaffId: STAFF_ROSTER[0].staffId,
      senderName: 'Sec',
      senderUnit: 'Security',
      createdAt: 1,
    };
    expect(parseStaffMessage(alert)).toEqual(alert);
    expect(
      parseStaffMessage({ ...alert, senderStaffId: 'unknown' }),
    ).toBeNull();
  });
});
