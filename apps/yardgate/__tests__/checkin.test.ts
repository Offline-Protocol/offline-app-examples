import { describe, expect, it } from '@jest/globals';
import {
  encodeCheckIn,
  encodeDecision,
  encodeServiceError,
  emptyGate,
  gateReducer,
  parseCheckIn,
  parseDecision,
  parseServiceError,
} from '../src/domain/checkin';

describe('check-in payloads', () => {
  it('round-trips check-in JSON', () => {
    const payload = {
      checkInId: 'chk-1',
      loadId: 'LD-1042',
      trailerId: 'TRL-88',
      driverName: 'Sam',
      createdAt: 1,
    };
    expect(parseCheckIn(encodeCheckIn(payload))).toEqual(payload);
  });

  it('rejects malformed bodies', () => {
    expect(parseCheckIn('not json')).toBeNull();
    expect(parseCheckIn('{}')).toBeNull();
  });
});

describe('gateReducer', () => {
  const base = {
    checkInId: 'chk-1',
    loadId: 'LD-1',
    trailerId: 'TRL-1',
    driverName: 'Sam',
    createdAt: 1,
  };

  it('queues a new request', () => {
    const next = gateReducer(emptyGate(), {
      type: 'request_received',
      requestId: 'req-1',
      sender: 'off1driver',
      payload: base,
      at: 2,
    });
    expect(next.pending).toHaveLength(1);
    expect(next.pending[0].requestId).toBe('req-1');
  });

  it('dedupes decided checkInId on replay', () => {
    let state = gateReducer(emptyGate(), {
      type: 'request_received',
      requestId: 'req-1',
      sender: 'off1driver',
      payload: base,
      at: 2,
    });
    state = gateReducer(state, {
      type: 'decide',
      checkInId: 'chk-1',
      decision: 'approved',
      gateOfficer: 'Gate 1',
      at: 3,
    });
    state = gateReducer(state, {
      type: 'request_received',
      requestId: 'req-2',
      sender: 'off1driver',
      payload: base,
      at: 4,
    });
    expect(state.duplicateResponses).toBe(1);
    expect(state.pending).toHaveLength(0);
  });

  it('dedupes duplicate checkInId still pending', () => {
    let state = gateReducer(emptyGate(), {
      type: 'request_received',
      requestId: 'req-1',
      sender: 'off1driver',
      payload: base,
      at: 2,
    });
    state = gateReducer(state, {
      type: 'request_received',
      requestId: 'req-2',
      sender: 'off1driver',
      payload: base,
      at: 3,
    });
    expect(state.pending).toHaveLength(1);
    expect(state.duplicateResponses).toBe(1);
  });

  it('parses gate decisions', () => {
    const d = {
      checkInId: 'chk-1',
      decision: 'denied' as const,
      gateOfficer: 'Gate',
      at: 5,
    };
    expect(parseDecision(encodeDecision(d))).toEqual(d);
  });
});

describe('service errors', () => {
  it('round-trips service error JSON', () => {
    expect(parseServiceError(encodeServiceError('invalid_check_in'))).toBe('invalid_check_in');
  });
});
