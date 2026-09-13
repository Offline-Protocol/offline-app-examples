import { test, expect } from '@jest/globals';
import {
  initialDomainState,
  transition,
  result,
  lines,
  validState,
} from '../src/domain';
import { Session } from '../src/session';
import { decode, Wire } from '../src/wire';
function pair() {
  let now = 1000,
    id = 0;
  const queue: { to: string; m: Wire }[] = [];
  const make = (host: boolean) =>
    new Session(host, {
      id: () => `id-${++id}`,
      now: () => now,
      changed: () => {},
      send: (to, m) => queue.push({ to, m: JSON.parse(JSON.stringify(m)) }),
    });
  const a = make(true),
    b = make(false);
  b.connect('a', a.lobby);
  queue.length = 0;
  a.hostAccept('b', b.joinToken);
  const flush = () => {
    let count = 0;
    while (queue.length) {
      if (count++ > 100) throw Error('message loop');
      const { to, m } = queue.shift()!;
      (to === 'a' ? a : b).receive(to === 'a' ? 'b' : 'a', JSON.stringify(m));
    }
  };
  flush();
  return {
    a,
    b,
    queue,
    flush,
    advance: (ms: number) => {
      now += ms;
      a.tick();
      b.tick();
    },
    move: (cell: number) => {
      (a.view.domain.turn === 'X' ? a : b).action({ kind: 'move', cell });
      flush();
    },
  };
}
test('all winning lines are recognized', () => {
  for (const l of lines) {
    const board = Array(9).fill(null);
    l.forEach((i) => (board[i] = 'X'));
    expect(result(board).line).toEqual(l);
  }
});
test('rejects illegal moves and freezes a finished board', () => {
  let s = initialDomainState();
  expect(transition(s, 'O', { kind: 'move', cell: 0 })).toBeNull();
  for (const i of [0, 3, 1, 4, 2])
    s = transition(s, s.turn, { kind: 'move', cell: i })!;
  expect(s.scores.X).toBe(1);
  expect(transition(s, 'O', { kind: 'move', cell: 5 })).toBeNull();
  expect(transition(s, 'X', { kind: 'move', cell: 9 })).toBeNull();
});
test('two devices synchronize a win, rematch acceptance, alternating starter, scores', () => {
  const p = pair();
  for (const c of [0, 3, 1, 4, 2]) p.move(c);
  expect(p.a.view.domain).toEqual(p.b.view.domain);
  expect(p.a.view.domain.scores.X).toBe(1);
  p.b.action({ kind: 'rematch' });
  p.flush();
  expect(p.a.view.domain.rematch).toBe('O');
  p.a.action({ kind: 'accept' });
  p.flush();
  expect(p.a.view.domain.board).toEqual(Array(9).fill(null));
  expect(p.b.view.domain.turn).toBe('O');
  expect(p.b.view.domain.scores.X).toBe(1);
  expect(p.b.view.domain.round).toBe(2);
});
test('draw and rematch decline synchronize', () => {
  const p = pair();
  for (const c of [0, 1, 2, 4, 3, 5, 7, 6, 8]) p.move(c);
  expect(result(p.a.view.domain.board).draw).toBe(true);
  expect(p.b.view.domain.scores.draws).toBe(1);
  p.a.action({ kind: 'rematch' });
  p.flush();
  p.b.action({ kind: 'decline' });
  p.flush();
  expect(p.a.view.domain.declined).toBe(true);
  expect(p.a.view.domain.rematch).toBeNull();
});
test('retries lost state and lost ACK; duplicates never double apply', () => {
  const p = pair();
  p.a.action({ kind: 'move', cell: 0 });
  const state = p.queue[0];
  p.queue.length = 0;
  p.advance(2000);
  p.flush();
  expect(p.b.view.domain.board[0]).toBe('X');
  p.b.action({ kind: 'move', cell: 4 });
  const proposal = p.queue[0];
  p.flush();
  p.a.receive('b', JSON.stringify(proposal.m));
  p.flush();
  expect(p.a.view.round).toBe(2);
  p.b.receive('a', JSON.stringify(state.m));
  expect(p.b.view.domain.board[4]).toBe('O');
  expect(p.b.view.round).toBe(2);
});
test('stale state does not release pending guest move', () => {
  const p = pair();
  p.a.action({ kind: 'move', cell: 0 });
  const stale = p.queue[0].m;
  p.flush();
  p.b.action({ kind: 'move', cell: 4 });
  p.queue.length = 0;
  p.b.receive('a', JSON.stringify(stale));
  expect(p.b.view.syncing).toBe(true);
  p.advance(2000);
  p.flush();
  expect(p.a.view.domain.board[4]).toBe('O');
  expect(p.b.view.syncing).toBe(false);
});
test('old ACK cannot unlock a newer host revision', () => {
  const p = pair();
  p.a.action({ kind: 'move', cell: 0 });
  const state = p.queue[0].m as Extract<Wire, { type: 'state' }>;
  p.a.receive(
    'b',
    JSON.stringify({
      v: 1,
      type: 'ack',
      session: state.session,
      round: 1,
      rev: 0,
    }),
  );
  expect(p.a.view.syncing).toBe(true);
  p.flush();
  expect(p.a.view.syncing).toBe(false);
});
test('heartbeat timeout preserves board and recovers on valid same-session traffic', () => {
  const p = pair();
  p.move(0);
  p.advance(46000);
  expect(p.a.view.phase).toBe('disconnected');
  expect(p.a.view.domain.board[0]).toBe('X');
  p.a.waitForOpponent();
  p.b.waitForOpponent();
  p.flush();
  expect(p.a.view.phase).toBe('active');
  expect(p.b.view.phase).toBe('active');
  expect(p.a.view.domain).toEqual(p.b.view.domain);
});
test('explicit leave is terminal and foreign peers cannot mutate game', () => {
  const p = pair();
  p.a.leave();
  p.flush();
  expect(p.b.view.recoverable).toBe(false);
  expect(p.b.view.phase).toBe('disconnected');
  p.b.waitForOpponent();
  expect(p.b.view.phase).toBe('disconnected');
});
test('bounded decoder rejects malformed game state and actions', () => {
  expect(decode('x'.repeat(4097))).toBeNull();
  expect(decode('{')).toBeNull();
  expect(
    decode(
      JSON.stringify({
        v: 1,
        type: 'app',
        session: 'a',
        round: 1,
        rev: 0,
        payload: { kind: 'move', cell: 99 },
      }),
    ),
  ).toBeNull();
  expect(
    validState({ ...initialDomainState(), board: Array(9).fill('X') }),
  ).toBe(false);
  expect(
    decode(
      JSON.stringify({
        v: 1,
        type: 'state',
        session: 'a',
        join: 'b',
        round: 0,
        payload: {},
      }),
    ),
  ).toBeNull();
});
test('simultaneous rematch requests converge; explicit accept still required', () => {
  const p = pair();
  for (const c of [0, 3, 1, 4, 2]) p.move(c);
  p.a.action({ kind: 'rematch' });
  p.b.action({ kind: 'rematch' });
  p.flush();
  expect(p.a.view.domain).toEqual(p.b.view.domain);
  expect(p.a.view.domain.round).toBe(1);
  p.b.action({ kind: 'accept' });
  p.flush();
  expect(p.b.view.domain.round).toBe(2);
});

test('a lost ACK is repaired by repeating the same snapshot', () => {
  const p = pair();
  p.a.action({ kind: 'move', cell: 0 });
  const packet = p.queue.shift()!;
  p.b.receive('a', JSON.stringify(packet.m));
  p.queue.length = 0; // Drop the ACK, not the committed board.
  expect(p.a.view.syncing).toBe(true);
  p.advance(2000);
  p.flush();
  expect(p.a.view.syncing).toBe(false);
  expect(p.a.view.round).toBe(1);
  expect(p.b.view.domain.board.filter(Boolean)).toHaveLength(1);
});

test('foreign peers and old sessions cannot change the board', () => {
  const p = pair();
  p.a.action({ kind: 'move', cell: 0 });
  const state = p.queue[0].m;
  p.b.receive('stranger', JSON.stringify(state));
  expect(p.b.view.domain.board[0]).toBeNull();
  p.flush();
  const before = p.b.view.domain;
  p.b.receive(
    'a',
    JSON.stringify({ ...state, session: 'old-session', round: 99 }),
  );
  expect(p.b.view.domain).toEqual(before);
});
