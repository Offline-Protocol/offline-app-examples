import { Action, DomainState, validAction, validState } from './domain';
/**
 * Versioned wire protocol — extend message types for your app.
 * Always validate bounds in decode(); reject oversize payloads.
 */

type Base = { v: 1 };

export type Wire = Base &
  (
    | { type: 'join'; lobby: string; join: string }
    | { type: 'busy'; join: string }
    | {
        type: 'state';
        session: string;
        join: string;
        round: number;
        payload: DomainState;
      }
    | { type: 'ack'; session: string; round: number; rev: number }
    | {
        type: 'app';
        session: string;
        round: number;
        rev: number;
        payload: Action;
      }
    | { type: 'leave'; session: string }
    | { type: 'ping' | 'pong'; session: string; seq: number }
  );

const id = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(s);
const integer = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;

export function decode(content: string): Wire | null {
  if (content.length > 4096) {
    return null;
  }
  try {
    const m = JSON.parse(content);
    if (!m || m.v !== 1) {
      return null;
    }
    switch (m.type) {
      case 'join':
        return id(m.lobby) && id(m.join) ? m : null;
      case 'busy':
        return id(m.join) ? m : null;
      case 'state':
        return id(m.session) &&
          id(m.join) &&
          integer(m.round, 1e9) &&
          validState(m.payload)
          ? m
          : null;
      case 'app':
        return id(m.session) &&
          integer(m.round, 1e9) &&
          integer(m.rev, 1e9) &&
          validAction(m.payload)
          ? m
          : null;
      case 'ack':
        return id(m.session) && integer(m.round, 1e9) && integer(m.rev, 1e9)
          ? m
          : null;
      case 'leave':
        return id(m.session) ? m : null;
      case 'ping':
      case 'pong':
        return id(m.session) && integer(m.seq, Number.MAX_SAFE_INTEGER)
          ? m
          : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
