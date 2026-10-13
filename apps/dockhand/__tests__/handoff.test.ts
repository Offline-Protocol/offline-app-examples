import { describe, expect, it } from '@jest/globals';
import {
  addHandoff,
  assign,
  assignmentText,
  awaitingYard,
  checkInText,
  parseMessage,
  yoursFor,
  type Assignment,
  type Handoff,
} from '../src/domain/handoff';

const sig = (c: string) => ({
  publicKey: c.repeat(64),
  signature: c.repeat(128),
});

const handoff = (over: Partial<Handoff> = {}): Handoff => ({
  handoffId: 'ho-1',
  vehicle: { id: 'b1', name: 'Truck 12' },
  driverId: 'off1driver',
  driverName: 'Ada',
  load: { bol: 'BOL-1', trailer: 'TR-1', seal: 'SL-1', pallets: 22 },
  checkedInAt: 1_700_000_000_000,
  driverSig: sig('a'),
  ...over,
});

const assignment: Assignment = {
  dock: 'Dock 3',
  yardId: 'off1yard',
  yardName: 'North Yard',
  assignedAt: 1_700_000_060_000,
  yardSig: sig('b'),
};

describe('signed texts', () => {
  it('change when any signed field changes, and the yard text covers the driver signature', () => {
    const h = handoff();
    expect(checkInText(h)).toBe(checkInText(handoff()));
    expect(checkInText(handoff({ load: { ...h.load, pallets: 21 } }))).not.toBe(
      checkInText(h),
    );
    expect(
      checkInText(handoff({ vehicle: { id: 'b2', name: 'Truck 12' } })),
    ).not.toBe(checkInText(h));
    const text = assignmentText(h, assignment);
    expect(JSON.parse(text)[1]).toBe(checkInText(h));
    expect(
      assignmentText(handoff({ driverSig: sig('c') }), assignment),
    ).not.toBe(text);
    expect(assignmentText(h, { ...assignment, dock: 'Dock 4' })).not.toBe(text);
  });
});

describe('ledger', () => {
  it('dedupes by handoffId and assigns a dock only once', () => {
    const one = addHandoff([], handoff());
    expect(addHandoff(one, handoff({ driverName: 'Mallory' }))).toBe(one);
    const assigned = assign(one, 'ho-1', assignment);
    expect(assigned[0].assignment?.dock).toBe('Dock 3');
    expect(assign(assigned, 'ho-1', { ...assignment, dock: 'Dock 5' })).toBe(
      assigned,
    );
    expect(assign(one, 'missing', assignment)).toBe(one);
  });

  it('resends only own, unassigned check-ins the yard has not acknowledged', () => {
    const list = [
      handoff({ handoffId: 'ho-a' }),
      handoff({ handoffId: 'ho-b' }),
      handoff({ handoffId: 'ho-c', assignment }),
      handoff({ handoffId: 'ho-d', driverId: 'off1other' }),
    ];
    expect(
      awaitingYard(list, 'off1driver', new Set(['ho-b'])).map(
        (h) => h.handoffId,
      ),
    ).toEqual(['ho-a']);
  });

  it('tells each driver only about their own handoffs', () => {
    const list = [
      handoff({ handoffId: 'ho-a' }),
      handoff({ handoffId: 'ho-b', driverId: 'off1other' }),
    ];
    expect(yoursFor(list, 'off1driver')).toEqual({
      type: 'yours',
      handoffs: [list[0]],
    });
  });
});

describe('parseMessage', () => {
  it('accepts well-formed messages and rejects the rest', () => {
    expect(parseMessage({ type: 'checkin', handoff: handoff() })).toEqual({
      type: 'checkin',
      handoff: handoff(),
    });
    expect(
      parseMessage({ type: 'yours', handoffs: [handoff({ assignment })] })
        ?.type,
    ).toBe('yours');
    // A check-in arriving already assigned is not a check-in.
    expect(
      parseMessage({ type: 'checkin', handoff: handoff({ assignment }) }),
    ).toBeNull();
    expect(
      parseMessage({
        type: 'checkin',
        handoff: handoff({ handoffId: 'x" = "y' }),
      }),
    ).toBeNull();
    expect(
      parseMessage({
        type: 'checkin',
        handoff: {
          ...handoff(),
          driverSig: { publicKey: 'ab', signature: 'cd' },
        },
      }),
    ).toBeNull();
    expect(
      parseMessage({
        type: 'yours',
        handoffs: [
          handoff({ assignment: { ...assignment, dock: 'Dock 99' as never } }),
        ],
      }),
    ).toBeNull();
    expect(parseMessage({ type: 'nope' })).toBeNull();
    expect(parseMessage('checkin')).toBeNull();
  });
});
