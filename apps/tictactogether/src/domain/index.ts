export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Action =
  { kind: 'move'; cell: number } | { kind: 'rematch' | 'accept' | 'decline' };
export interface DomainState {
  board: Cell[];
  turn: Mark;
  starter: Mark;
  round: number;
  scores: { X: number; O: number; draws: number };
  rematch: Mark | null;
  declined: boolean;
}
export const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export const other = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');
export function result(board: Cell[]): {
  winner: Mark | null;
  line: number[];
  draw: boolean;
} {
  const line = lines.find(
    (l) => board[l[0]] && l.every((i) => board[i] === board[l[0]]),
  );
  return {
    winner: line ? board[line[0]] : null,
    line: line ?? [],
    draw: !line && board.every(Boolean),
  };
}
export const initialDomainState = (): DomainState => ({
  board: Array(9).fill(null),
  turn: 'X',
  starter: 'X',
  round: 1,
  scores: { X: 0, O: 0, draws: 0 },
  rematch: null,
  declined: false,
});
export function transition(
  s: DomainState,
  actor: Mark,
  a: Action,
): DomainState | null {
  const end = result(s.board);
  if (a.kind === 'move') {
    if (
      end.winner ||
      end.draw ||
      actor !== s.turn ||
      !Number.isInteger(a.cell) ||
      a.cell < 0 ||
      a.cell > 8 ||
      s.board[a.cell]
    )
      return null;
    const board = [...s.board];
    board[a.cell] = actor;
    const next = result(board),
      scores = { ...s.scores };
    if (next.winner) scores[next.winner]++;
    if (next.draw) scores.draws++;
    return { ...s, board, turn: other(actor), scores };
  }
  if (!end.winner && !end.draw) return null;
  if (a.kind === 'rematch' && !s.rematch)
    return { ...s, rematch: actor, declined: false };
  if (a.kind === 'accept' && s.rematch === other(actor))
    return {
      ...initialDomainState(),
      round: s.round + 1,
      scores: { ...s.scores },
      starter: other(s.starter),
      turn: other(s.starter),
    };
  if (a.kind === 'decline' && s.rematch === other(actor))
    return { ...s, rematch: null, declined: true };
  return null;
}
export function validAction(a: any): a is Action {
  return (
    !!a &&
    (['rematch', 'accept', 'decline'].includes(a.kind) ||
      (a.kind === 'move' &&
        Number.isInteger(a.cell) &&
        a.cell >= 0 &&
        a.cell < 9))
  );
}
export function validState(s: any): s is DomainState {
  if (
    !s ||
    !Array.isArray(s.board) ||
    s.board.length !== 9 ||
    !s.board.every((c: unknown) => c === null || c === 'X' || c === 'O')
  )
    return false;
  if (
    !['X', 'O'].includes(s.turn) ||
    !['X', 'O'].includes(s.starter) ||
    !Number.isSafeInteger(s.round) ||
    s.round < 1 ||
    s.round > 1e6 ||
    !s.scores
  )
    return false;
  if (
    !['X', 'O', 'draws'].every(
      (k) =>
        Number.isSafeInteger(s.scores[k]) &&
        s.scores[k] >= 0 &&
        s.scores[k] <= s.round,
    )
  )
    return false;
  if (![null, 'X', 'O'].includes(s.rematch) || typeof s.declined !== 'boolean')
    return false;
  const first = s.board.filter((c: Cell) => c === s.starter).length,
    second = s.board.filter((c: Cell) => c === other(s.starter)).length;
  if (
    !(first === second || first === second + 1) ||
    s.turn !== (first === second ? s.starter : other(s.starter))
  )
    return false;
  const winners = lines
    .filter(
      (l) => s.board[l[0]] && l.every((i) => s.board[i] === s.board[l[0]]),
    )
    .map((l) => s.board[l[0]]);
  if (winners.includes('X') && winners.includes('O')) return false;
  return !s.rematch || !!result(s.board).winner || result(s.board).draw;
}
