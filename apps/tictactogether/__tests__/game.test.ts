import { test, expect } from '@jest/globals';
import {
  initialDomainState,
  initialMatch,
  lines,
  Match,
  parseMessage,
  play,
  result,
  transition,
  validState,
} from '../src/domain';

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

test('rematch alternates the starter and keeps scores', () => {
  let m: Match = { ...initialMatch(), o: 'peer-o' };
  for (const cell of [0, 3, 1, 4, 2])
    m = play(m, m.game.turn, { kind: 'move', cell })!;
  expect(m.rev).toBe(5);
  expect(play(m, 'X', { kind: 'accept' })).toBeNull(); // nobody asked yet
  m = play(m, 'O', { kind: 'rematch' })!;
  expect(play(m, 'O', { kind: 'accept' })).toBeNull(); // can't accept your own
  m = play(m, 'X', { kind: 'accept' })!;
  expect(m.game.round).toBe(2);
  expect(m.game.turn).toBe('O');
  expect(m.game.scores).toEqual({ X: 1, O: 0, draws: 0 });
  expect(m.o).toBe('peer-o');
});

test('messages round-trip through JSON and survive validation', () => {
  const m = play(initialMatch(), 'X', { kind: 'move', cell: 4 })!;
  const state = JSON.parse(JSON.stringify({ type: 'state', ...m }));
  expect(parseMessage(state)).toEqual({ type: 'state', ...m });
  const action = { type: 'action', rev: 1, action: { kind: 'move', cell: 0 } };
  expect(parseMessage(action)).toEqual(action);
});

test('rejects malformed messages', () => {
  const game = initialDomainState();
  for (const bad of [
    null,
    'hi',
    { type: 'state', rev: 0, game: {}, o: null },
    { type: 'state', rev: -1, game, o: null },
    { type: 'state', rev: 0, game, o: 7 },
    {
      type: 'state',
      rev: 0,
      game: { ...game, board: Array(9).fill('X') },
      o: null,
    },
    { type: 'action', rev: 0, action: { kind: 'move', cell: 99 } },
    { type: 'action', rev: 1.5, action: { kind: 'rematch' } },
    { type: 'nope', rev: 0 },
  ])
    expect(parseMessage(bad)).toBeNull();
  expect(validState({ ...game, turn: 'O' })).toBe(false);
});
