import { Action, DomainState, initialDomainState, transition } from './domain';
import { decode, Wire } from './wire';
export type Phase =
  'waiting' | 'browsing' | 'connecting' | 'active' | 'disconnected';
export interface SessionView {
  phase: Phase;
  domain: DomainState;
  round: number;
  syncing: boolean;
  notice: string;
  recoverable: boolean;
}
export interface SessionIO {
  send(peer: string, message: Wire): void;
  changed(): void;
  id(): string;
  now(): number;
}
/** The host is the sole board writer. Revision + ACK makes retries idempotent. */
export class Session {
  view: SessionView;
  readonly lobby: string;
  private peer = '';
  private joinId = '';
  private session = '';
  private pending?: Wire;
  private lastSeen = 0;
  private started = 0;
  private lastPing = 0;
  private seq = 0;
  private recovery = false;
  constructor(
    public host: boolean,
    private io: SessionIO,
  ) {
    this.lobby = io.id();
    this.view = {
      phase: host ? 'waiting' : 'browsing',
      domain: initialDomainState(),
      round: 0,
      syncing: false,
      notice: '',
      recoverable: false,
    };
  }
  get joinToken() {
    return this.joinId;
  }
  isOpponent(peer: string) {
    return peer === this.peer;
  }
  opponentPeer() {
    return this.peer;
  }
  waitAsHost() {
    this.host = true;
    this.pending = undefined;
    this.peer = '';
    this.view.phase = 'waiting';
    this.changed();
  }
  connect(peer: string, lobby: string) {
    if (this.view.phase !== 'browsing') return;
    this.host = false;
    this.peer = peer;
    this.joinId = this.io.id();
    this.started = this.io.now();
    this.view.phase = 'connecting';
    this.pending = { v: 1, type: 'join', lobby, join: this.joinId };
    this.send(this.pending);
    this.changed();
  }
  hostAccept(peer: string, join: string) {
    if (!this.host || this.view.phase !== 'waiting') return;
    this.peer = peer;
    this.joinId = join;
    this.session = this.io.id();
    this.view.phase = 'active';
    this.lastSeen = this.io.now();
    this.publish();
  }
  connectionAccepted() {
    // Keep join retries until state arrives — first snapshot may be lost on BLE.
    if (this.view.phase === 'active') {
      this.pending = undefined;
    }
  }
  /** BLE canonical id differs from the id used in connect() — rebind opponent. */
  rebindOpponent(peer: string) {
    if (
      !peer ||
      peer === this.peer ||
      !this.peer ||
      !['connecting', 'active'].includes(this.view.phase)
    ) {
      return;
    }
    this.peer = peer;
    this.changed();
  }
  onRejected(message: string) {
    if (this.view.phase === 'connecting') this.disconnect(message, false);
  }
  action(a: Action) {
    if (this.view.phase !== 'active' || this.view.syncing) return;
    if (!transition(this.view.domain, this.host ? 'X' : 'O', a)) return;
    if (this.host) this.commit('X', a);
    else {
      this.pending = {
        v: 1,
        type: 'app',
        session: this.session,
        round: this.view.domain.round,
        rev: this.view.round,
        payload: a,
      };
      this.view.syncing = true;
      this.send(this.pending);
      this.changed();
    }
  }
  private commit(actor: 'X' | 'O', a: Action) {
    const next = transition(this.view.domain, actor, a);
    if (next) {
      this.view.domain = next;
      this.view.round++;
      this.publish();
    } else this.send(this.snapshot());
  }
  receive(peer: string, content: string) {
    const m = decode(content);
    if (!m || peer !== this.peer) return;
    if (m.type === 'join') {
      // New joins are queued by mesh.ts for explicit acceptance.
      if (this.host && m.join === this.joinId && this.session)
        this.send(this.snapshot());
      return;
    }
    if (m.type === 'busy') {
      if (m.join === this.joinId)
        this.onRejected('That player is already in a game.');
      return;
    }
    if (!('session' in m)) return;
    if (
      m.type === 'state' &&
      !this.host &&
      this.view.phase === 'connecting' &&
      m.join === this.joinId &&
      m.round === 0
    ) {
      this.session = m.session;
      this.view.phase = 'active';
      this.pending = undefined;
      this.view.syncing = false;
      this.lastSeen = this.io.now();
    }
    if (!this.session || m.session !== this.session) return;
    if (this.view.phase === 'disconnected' && !this.view.recoverable) return;
    this.lastSeen = this.io.now();
    if (m.type === 'leave') {
      this.disconnect('Your opponent left the game.', false);
      return;
    }
    if (this.view.phase === 'disconnected') {
      if (!this.recovery) return;
      this.view.phase = 'active';
      this.view.notice = '';
      this.recovery = false;
      if (this.host) this.publish();
      this.changed();
    }
    if (m.type === 'ping') {
      this.send({ v: 1, type: 'pong', session: this.session, seq: m.seq });
      return;
    }
    if (m.type === 'pong') return;
    if (m.type === 'state' && !this.host && m.join === this.joinId) {
      if (m.round >= this.view.round) {
        // An old state must not clear a newer outstanding proposal.
        const resolves =
          !this.pending ||
          this.pending.type !== 'app' ||
          m.round > this.pending.rev;
        this.view.round = m.round;
        this.view.domain = m.payload;
        if (resolves) {
          this.pending = undefined;
          this.view.syncing = false;
        }
        this.send({
          v: 1,
          type: 'ack',
          session: this.session,
          round: m.payload.round,
          rev: m.round,
        });
        this.changed();
      }
      return;
    }
    if (!this.host) return;
    if (
      m.type === 'ack' &&
      m.rev === this.view.round &&
      m.round === this.view.domain.round
    ) {
      this.pending = undefined;
      this.view.syncing = false;
      this.changed();
    }
    if (m.type === 'app') {
      if (m.rev === this.view.round && m.round === this.view.domain.round)
        this.commit('O', m.payload);
      else this.send(this.snapshot());
    }
  }
  tick() {
    const now = this.io.now();
    if (this.view.phase === 'connecting' && now - this.started > 45000)
      this.disconnect(
        'Couldn’t connect. Keep both phones nearby and try again.',
        false,
      );
    if (this.view.phase === 'active' && now - this.lastSeen > 45000)
      this.disconnect('Opponent disconnected');
    if (
      this.session &&
      (this.view.phase === 'active' || this.recovery) &&
      now - this.lastPing >= 4000
    ) {
      this.lastPing = now;
      this.send({ v: 1, type: 'ping', session: this.session, seq: ++this.seq });
      if (this.recovery && this.host) this.send(this.snapshot());
    }
    if (this.pending && this.view.phase !== 'disconnected')
      this.send(this.pending);
  }
  waitForOpponent() {
    if (!this.view.recoverable) return;
    this.recovery = true;
    this.view.notice = 'Waiting for your opponent…';
    this.lastPing = 0;
    this.tick();
    this.changed();
  }
  leave() {
    if (this.session) this.send({ v: 1, type: 'leave', session: this.session });
    this.disconnect('You left the game.', false);
  }
  disconnect(notice: string, recoverable = !!this.session) {
    this.view.phase = 'disconnected';
    this.view.notice = notice;
    this.view.recoverable = recoverable;
    this.recovery = recoverable;
    this.changed();
  }
  private snapshot(): Wire {
    return {
      v: 1,
      type: 'state',
      session: this.session,
      join: this.joinId,
      round: this.view.round,
      payload: this.view.domain,
    };
  }
  private publish() {
    this.pending = this.snapshot();
    this.view.syncing = true;
    this.send(this.pending);
    this.changed();
  }
  /** Extra snapshot sends after accept (mesh layer may call several times). */
  resendSnapshot() {
    if (this.view.phase !== 'active' || !this.peer || !this.session) {
      return;
    }
    this.send(this.snapshot());
  }
  private send(m: Wire) {
    if (this.peer) this.io.send(this.peer, m);
  }
  private changed() {
    this.view = { ...this.view };
    this.io.changed();
  }
}
