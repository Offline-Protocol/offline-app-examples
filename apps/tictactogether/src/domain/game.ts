// Tic-tac-toe rules and the two wire messages. Pure: no React, no SDK.
//
// The host plays X and owns the match. O sends each action tagged with the
// revision it saw; the host applies it only if that revision is still current,
// so duplicates and stale taps do nothing. Then it bumps `rev` and broadcasts
// the whole match as a `state`. O shows its own move right away and lets that
// state confirm it.

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Action =
  { kind: 'move'; cell: number } | { kind: 'rematch' | 'accept' | 'decline' };

export type Game = {
  board: Cell[]; // 9 cells, row by row
  turn: Mark;
  starter: Mark; // who opened this round; alternates on every rematch
  round: number;
  scores: { X: number; O: number; draws: number };
  rematch: Mark | null; // who asked for a rematch
  declined: boolean;
};

/** Everything both phones need to draw the game. `o` is the room peer id playing O. */
export type Match = { rev: number; game: Game; o: string | null };

export type Message =
  ({ type: 'state' } & Match) | { type: 'action'; rev: number; action: Action };

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const MAX_ROUND = 1_000_000;

export const other = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');

export function result(board: Cell[]) {
  const line = LINES.find(
    ([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c],
  );
  return {
    winner: line ? board[line[0]] : null,
    line: line ?? [],
    draw: !line && board.every(Boolean),
  };
}

export const newGame = (): Game => ({
  board: Array(9).fill(null),
  turn: 'X',
  starter: 'X',
  round: 1,
  scores: { X: 0, O: 0, draws: 0 },
  rematch: null,
  declined: false,
});

export const newMatch = (): Match => ({ rev: 0, game: newGame(), o: null });

/** Applies `action` for `actor`. Null if it is not allowed right now. */
export function transition(
  game: Game,
  actor: Mark,
  action: Action,
): Game | null {
  const { winner, draw } = result(game.board);
  const over = winner !== null || draw;

  if (action.kind === 'move') {
    const { cell } = action;
    if (over || actor !== game.turn) return null;
    if (!isInt(cell, 0, 8) || game.board[cell]) return null;
    const board = [...game.board];
    board[cell] = actor;
    const end = result(board);
    const scores = { ...game.scores };
    if (end.winner) scores[end.winner]++;
    if (end.draw) scores.draws++;
    return { ...game, board, turn: other(actor), scores };
  }

  // Rematches only once the round is over.
  if (!over) return null;
  if (action.kind === 'rematch') {
    return game.rematch ? null : { ...game, rematch: actor, declined: false };
  }
  // Accept and decline answer the other player's request.
  if (game.rematch !== other(actor)) return null;
  if (action.kind === 'decline') {
    return { ...game, rematch: null, declined: true };
  }
  const starter = other(game.starter);
  return {
    ...newGame(),
    round: game.round + 1,
    scores: game.scores,
    starter,
    turn: starter,
  };
}

/** Applies `action` and bumps the revision. Null if the action is not allowed. */
export function play(match: Match, actor: Mark, action: Action): Match | null {
  const game = transition(match.game, actor, action);
  return game && { ...match, rev: match.rev + 1, game };
}

// ------------------------------------------------------- incoming messages

/** Everything from the radio passes through here. Returns null for anything malformed. */
export function parseMessage(data: unknown): Message | null {
  if (!isObject(data)) return null;
  const { type, rev, o } = data;
  if (!isInt(rev, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (type === 'state') {
    const game = parseGame(data.game);
    if (!game || (o !== null && !isText(o, 0, 200))) return null;
    return { type, rev, game, o };
  }
  if (type === 'action') {
    const action = parseAction(data.action);
    return action && { type, rev, action };
  }
  return null;
}

// Checks shape, types and ranges only. The host is trusted to follow the rules.
function parseGame(data: unknown): Game | null {
  if (!isObject(data)) return null;
  const { board, turn, starter, round, scores, rematch, declined } = data;
  if (!Array.isArray(board) || board.length !== 9) return null;
  if (!board.every((c): c is Cell => c === null || isMark(c))) return null;
  if (!isMark(turn) || !isMark(starter)) return null;
  if (!isInt(round, 1, MAX_ROUND) || !isObject(scores)) return null;
  if (rematch !== null && !isMark(rematch)) return null;
  if (typeof declined !== 'boolean') return null;
  const { X, O, draws } = scores;
  if (!isInt(X, 0, round) || !isInt(O, 0, round) || !isInt(draws, 0, round)) {
    return null;
  }
  return {
    board,
    turn,
    starter,
    round,
    scores: { X, O, draws },
    rematch,
    declined,
  };
}

function parseAction(data: unknown): Action | null {
  if (!isObject(data)) return null;
  const { kind, cell } = data;
  if (kind === 'move') return isInt(cell, 0, 8) ? { kind, cell } : null;
  if (kind === 'rematch' || kind === 'accept' || kind === 'decline') {
    return { kind };
  }
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

function isText(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

function isMark(v: unknown): v is Mark {
  return v === 'X' || v === 'O';
}
