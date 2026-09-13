import OfflineProtocol, {
  MeshServices,
  MessagePriority,
  ProtocolEvent,
  ServiceDiscoveredEvent,
} from '@offline-protocol/mesh-sdk';
import { Platform } from 'react-native';
import {
  APP_ID,
  DIRECT_LOBBY,
  NEIGHBOR_SETTLE_MS,
  SERVICE_NAME,
} from './constants';
import { meshError, meshLog, meshWarn, shortPeer } from './debug';
import { requestBluetoothPermissions } from './permissions';
import { Session } from './session';
import { decode, Wire } from './wire';

const SESSION_WIRE_TYPES = new Set<Wire['type']>([
  'join',
  'busy',
  'state',
  'ack',
  'app',
  'leave',
  'ping',
  'pong',
]);

/** Let native BLE + MLS identity settle after start (see chat-app ProtocolContext). */
const PROTOCOL_START_DELAY_MS = 500;
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

let sequence = 0;
const id = () =>
  `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;

export interface NearbySession {
  peer: string;
  lobby: string;
  name: string;
  seen: number;
  reachable: boolean;
}

export interface JoinRequest {
  peer: string;
  name: string;
  lobby: string;
  joinId: string;
  keyPackage?: number[];
  seen: number;
}

/** Only connectivity adapter — do not add app logic here. */
export class MeshSession {
  readonly session: Session;
  nearby: NearbySession[] = [];
  incomingRequests: JoinRequest[] = [];
  error = '';
  ready = false;
  discoveryError = '';
  joiningPeer = '';
  localPeer = '';
  private accepting = false;
  private requesting = false;
  private joinLobby = DIRECT_LOBBY;
  /** Last 6 chars of this device’s mesh id (shown in discovery UI). */
  localSessionCode(): string {
    return this.localPeer.slice(-6).toUpperCase();
  }
  peerReadyForJoin(peer: string): boolean {
    const seen = this.neighborFirstSeen.get(peer);
    return seen !== undefined && Date.now() - seen >= NEIGHBOR_SETTLE_MS;
  }
  get nearbyPeerCount() {
    return this.nearbyPeers.length;
  }
  get nearbyPeers(): string[] {
    return [...this.neighbors].filter(
      (peer) => peer.length > 0 && peer !== this.localPeer,
    );
  }

  private protocol?: OfflineProtocol;
  private services = new MeshServices();
  private timer?: ReturnType<typeof setInterval>;
  private closing = false;
  private closingTask?: Promise<void>;
  private startTask?: Promise<void>;
  private neighbors = new Set<string>();
  private discoveryInFlight = false;
  private neighborRevision = 0;
  private announcements = new Map<string, ServiceDiscoveredEvent>();
  private sends = new Set<string>();
  private ticks = 0;
  private advertised = false;
  private neighborFirstSeen = new Map<string, number>();
  private pendingJoinByPeer = new Map<
    string,
    { lobby: string; joinId: string }
  >();
  private joinTransportEpoch = 0;
  private joinAccepted = false;

  constructor(
    host: boolean,
    private changed: () => void,
  ) {
    this.session = new Session(host, {
      id,
      now: Date.now,
      changed,
      send: (peer, message) => this.send(peer, message),
    });
    meshLog('MeshSession created', { role: host ? 'host' : 'guest' });
  }

  start(): Promise<void> {
    this.startTask ??= this.startInternal();
    return this.startTask;
  }

  private displayName(suffix: string) {
    return `Player ${suffix.slice(-4).toUpperCase()}`;
  }

  private async ensureMlsReady(): Promise<boolean> {
    if (!this.protocol) {
      meshWarn('ensureMlsReady: no protocol instance');
      return false;
    }
    if (await this.protocol.isMlsInitialized().catch(() => false)) {
      return true;
    }
    meshLog('MLS not ready — calling initializeMlsWithSecureStorage');
    try {
      await this.protocol.initializeMlsWithSecureStorage();
    } catch (error) {
      meshWarn('initializeMlsWithSecureStorage failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const ready = await this.protocol.isMlsInitialized().catch(() => false);
    meshLog('MLS ready check', { ready });
    return ready;
  }

  private async localKeyPackage(): Promise<number[] | undefined> {
    if (!this.protocol) {
      return undefined;
    }
    try {
      const pkg = await this.protocol.mlsGetOrCreateKeyPackage();
      return pkg.keyPackageData;
    } catch {
      return undefined;
    }
  }

  private async waitForLocalAddress(p: OfflineProtocol): Promise<string> {
    for (let attempt = 0; attempt < 30 && !this.closing; attempt++) {
      const address = (await p.localAddress()) ?? '';
      if (address) {
        meshLog('localAddress ready', { attempt, peer: shortPeer(address) });
        return address;
      }
      await pause(500);
    }
    meshWarn('localAddress timed out after polling');
    return '';
  }

  private async startInternal() {
    meshLog('startInternal begin', {
      role: this.session.host ? 'host' : 'guest',
      platform: Platform.OS,
    });
    try {
      await requestBluetoothPermissions();
      if (this.closing) {
        return;
      }
      const p = new OfflineProtocol({
        appId: APP_ID,
        profile: `${APP_ID}-local`,
        transports: {
          ble: { enabled: true },

          wifiDirect: { enabled: false },
          internet: { enabled: false },

          nostr: { enabled: false },
          reticulum: { enabled: false },
        },
        network: { initialTtl: 1 },
        meshRelay: { maxTtl: 1, denseMaxTtl: 1 },
        relay: { allowRelay: false, relayPriority: 'never' },
        group: { relayEnabled: false, relayBroadcastEnabled: false },
        encryption: {
          enabled: true,
          autoKeyExchange: true,
          requireEncryption: false,
          storePending: true,
        },
        reliability: {
          retry: {
            maxRetries: 3,
            outboxMaxLifetimeMs: 15000,
            pendingMessageMaxLifetimeMs: 15000,
          },
        },
      });
      this.protocol = p;
      p.on('all', this.onEvent);
      await p.start();
      await pause(PROTOCOL_START_DELAY_MS);
      if (!(await this.ensureMlsReady())) {
        meshError('MLS failed to initialize after start');
        throw new Error(
          'Encryption identity failed to initialize. Force-quit and reopen the app.',
        );
      }
      this.localPeer = await this.waitForLocalAddress(p);
      meshLog('identity', { localPeer: shortPeer(this.localPeer) });
      if (!this.localPeer) {
        throw new Error(
          'Mesh identity is not ready yet. Keep Bluetooth on and stay on this screen.',
        );
      }
      if (this.closing) {
        return;
      }
      let enabled = await p.isBluetoothEnabled();
      if (!enabled && Platform.OS === 'android') {
        enabled = await p.requestEnableBluetooth();
      }
      for (
        let attempt = 0;
        !enabled && attempt < 30 && !this.closing;
        attempt++
      ) {
        await pause(1000);
        enabled = await p.isBluetoothEnabled();
      }
      if (this.closing) {
        return;
      }
      if (!enabled) {
        throw new Error(
          'Turn on Bluetooth and allow Bluetooth access in Settings, then try again.',
        );
      }

      if (this.session.host) {
        await this.services.registerService(SERVICE_NAME, '1', {
          lobby: this.session.lobby,
          name: this.displayName(this.localPeer),
        });
        meshLog('host service registered', {
          service: SERVICE_NAME,
          lobby: this.session.lobby,
        });
        this.advertised = true;
      }

      this.ready = true;
      meshLog('mesh ready', {
        role: this.session.host ? 'host' : 'guest',
        phase: this.session.view.phase,
        localPeer: shortPeer(this.localPeer),
      });
      this.changed();
      this.discover();
      this.timer = setInterval(() => {
        this.session.tick();
        if (this.advertised && this.session.view.phase !== 'waiting') {
          this.advertised = false;
          void this.services.unregisterService(SERVICE_NAME).catch(() => {
            this.advertised = true;
          });
        }
        this.nearby = this.nearby.filter((s) => Date.now() - s.seen < 20000);
        this.incomingRequests = this.incomingRequests.filter(
          (r) => Date.now() - r.seen < 20000,
        );

        if (
          this.session.host &&
          this.session.view.phase === 'waiting' &&
          this.advertised &&
          this.ticks % 4 === 0
        ) {
          void this.services
            .registerService(SERVICE_NAME, '1', {
              lobby: this.session.lobby,
              name: this.displayName(this.localPeer),
            })
            .catch(() => {});
        }

        if (
          !this.session.host &&
          !this.joinAccepted &&
          this.session.view.phase === 'connecting' &&
          this.ticks % 4 === 0
        ) {
          const peer = this.session.opponentPeer();
          if (peer.startsWith('off1')) {
            void this.resendJoinTransport(peer, this.joinLobby);
          }
        }
        if (++this.ticks % 3 === 0) {
          if (['browsing', 'waiting'].includes(this.session.view.phase)) {
            this.discover();
          }
          void p
            .isBluetoothEnabled()
            .then((on) => {
              if (!on && !this.closing) {
                this.session.disconnect('Bluetooth was turned off.');
              }
            })
            .catch(() => {});
        }
        this.changed();
      }, 2000);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Unable to start Bluetooth.';
      meshError('startInternal failed', { error: this.error });
      this.changed();
      if (this.protocol) {
        try {
          await this.protocol.stop();
        } catch {
          /* surfaced above */
        }
      }
    }
  }

  private send(peer: string, message: object) {
    const content = JSON.stringify(message);
    const key = peer + content;
    if (!this.protocol || this.closing || this.sends.has(key)) {
      return;
    }
    this.sends.add(key);
    void this.protocol
      .sendMessage({ recipient: peer, content, priority: MessagePriority.High })
      .then((messageId) => {
        meshLog('sendMessage ok', {
          to: shortPeer(peer),
          type: (message as { type?: string }).type,
          messageId,
        });
      })
      .catch((error) => {
        meshWarn('sendMessage failed', {
          to: shortPeer(peer),
          type: (message as { type?: string }).type,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => this.sends.delete(key));
  }

  private stopJoinTransport() {
    this.joinAccepted = true;
    this.joinTransportEpoch++;
  }

  private joinTransportActive(epoch: number, peer: string): boolean {
    return (
      !this.closing &&
      epoch === this.joinTransportEpoch &&
      !this.joinAccepted &&
      this.session.view.phase === 'connecting' &&
      this.session.isOpponent(peer)
    );
  }

  private async sendStateBurst(peer: string) {
    if (!this.protocol || this.closing) {
      return;
    }
    for (let attempt = 0; attempt < 4 && !this.closing; attempt++) {
      if (this.session.view.phase !== 'active') {
        break;
      }
      this.session.resendSnapshot();
      await pause(350);
    }
    meshLog('sendStateBurst done', { to: shortPeer(peer) });
  }

  private async sendJoinBurst(
    peer: string,
    joinEnvelope: object,
    epoch: number,
  ) {
    if (!this.protocol || !this.joinTransportActive(epoch, peer)) {
      return;
    }
    const content = JSON.stringify(joinEnvelope);
    for (
      let attempt = 0;
      attempt < 3 && this.joinTransportActive(epoch, peer);
      attempt++
    ) {
      try {
        await this.protocol.sendMessage({
          recipient: peer,
          content,
          priority: MessagePriority.Critical,
        });
        meshLog('sendJoinBurst ok', { to: shortPeer(peer), attempt });
      } catch (error) {
        meshWarn('sendJoinBurst failed', {
          to: shortPeer(peer),
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await pause(350);
    }
  }

  private async resendJoinTransport(peer: string, lobby: string) {
    if (
      !this.protocol ||
      this.closing ||
      !this.session.isOpponent(peer) ||
      this.session.view.phase !== 'connecting'
    ) {
      return;
    }
    const epoch = this.joinTransportEpoch;
    const joinEnvelope = {
      v: 1 as const,
      type: 'join' as const,
      lobby,
      join: this.session.joinToken,
    };
    void this.sendJoinBurst(peer, joinEnvelope, epoch);
    if (!this.joinTransportActive(epoch, peer)) {
      return;
    }
    try {
      const keyPackage = await this.localKeyPackage();
      await this.protocol.sendConnectionRequest({
        recipient: peer,
        senderName: this.displayName(this.localPeer),
        initialMessage: JSON.stringify(joinEnvelope),
        keyPackage,
      });
    } catch (error) {
      meshWarn('resendJoinTransport failed', {
        to: shortPeer(peer),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private promoteVerifiedHost(canonical: string) {
    if (this.session.host) {
      return;
    }
    for (const peer of [...this.neighbors]) {
      if (peer !== canonical) {
        this.neighbors.delete(peer);
        this.neighborFirstSeen.delete(peer);
      }
    }
    this.neighbors.add(canonical);
    this.neighborFirstSeen.set(canonical, Date.now());
    const announcement = this.announcements.get(canonical);
    this.rememberHost(
      canonical,
      announcement?.capabilities.lobby ?? DIRECT_LOBBY,
      typeof announcement?.capabilities.name === 'string'
        ? announcement.capabilities.name
        : `Player ${canonical.slice(-4).toUpperCase()}`,
    );
    this.discoveryError =
      'Verified player — tap Connect when the button is ready.';
    this.discover();
  }

  /** Guest join: list settled BLE peers when MeshServices is slow. */
  private listSettledNeighborsAsPlayers() {
    if (this.session.host || this.session.view.phase !== 'browsing') {
      return;
    }
    for (const peer of this.nearbyPeers) {
      if (!peer.startsWith('off1')) {
        continue;
      }
      if (this.nearby.some((s) => s.peer === peer)) {
        continue;
      }
      if (!this.peerReadyForJoin(peer)) {
        continue;
      }
      const announcement = this.announcements.get(peer);
      if (announcement) {
        this.rememberHost(
          peer,
          announcement.capabilities.lobby,
          announcement.capabilities.name,
        );
      } else {
        this.rememberHost(
          peer,
          DIRECT_LOBBY,
          `Player ${peer.slice(-4).toUpperCase()}`,
        );
      }
    }
  }

  private resolvePeerId(event: Record<string, unknown>): string {
    const raw =
      event.sender ??
      event.peer_id ??
      event.peerId ??
      event.from_user_id ??
      event.fromUserId;
    return typeof raw === 'string' ? raw : '';
  }

  private resolveSenderName(
    event: Record<string, unknown>,
    peerId: string,
  ): string {
    const raw =
      event.sender_name ?? event.user_name ?? event.userName ?? peerId;
    return typeof raw === 'string' ? raw.slice(0, 30) : peerId.slice(0, 30);
  }

  private resolveCrossedJoin(peer: string) {
    if (
      this.session.view.phase === 'connecting' &&
      this.session.isOpponent(peer) &&
      this.localPeer > peer
    ) {
      this.stopJoinTransport();
      this.session.waitAsHost();
    }
  }

  private queueJoinRequest(
    peer: string,
    join: { lobby: string; joinId: string },
    name: string,
    keyPackage?: number[],
  ) {
    if (join.joinId) {
      this.pendingJoinByPeer.set(peer, join);
    }
    if (keyPackage?.length) {
      void this.protocol?.mlsImportKeyPackage(peer, keyPackage).catch(() => {});
    }
    const prior = this.incomingRequests.find((r) => r.peer === peer);
    this.incomingRequests = [
      ...this.incomingRequests.filter((r) => r.peer !== peer),
      {
        peer,
        name: name.slice(0, 30),
        lobby: join.lobby || prior?.lobby || DIRECT_LOBBY,
        joinId: join.joinId || prior?.joinId || '',
        keyPackage: keyPackage ?? prior?.keyPackage,
        seen: Date.now(),
      },
    ];
  }

  private connectionInitialMessage(
    event: ProtocolEvent & { type: 'connection_request_received' },
  ): string | undefined {
    return (
      event.initial_message ??
      (event as { initialMessage?: string }).initialMessage
    );
  }

  async requestJoin(peer: string) {
    if (this.requesting) return;
    this.requesting = true;
    try {
      await this.requestJoinInternal(peer);
    } finally {
      this.requesting = false;
    }
  }

  private async requestJoinInternal(peer: string) {
    meshLog('requestJoin', {
      peer: shortPeer(peer),
      phase: this.session.view.phase,
      neighbors: this.neighbors.size,
    });
    if (
      this.session.host ||
      this.session.view.phase !== 'browsing' ||
      this.accepting
    ) {
      meshWarn('requestJoin skipped — wrong phase or role', {
        host: this.session.host,
        phase: this.session.view.phase,
      });
      return;
    }
    const target = this.nearby.find((s) => s.peer === peer);
    if (!target) {
      meshWarn('requestJoin blocked — host not in verified session list', {
        peer: shortPeer(peer),
        nearby: this.nearby.map((s) => shortPeer(s.peer)),
      });
      this.discoveryError =
        'This player is still getting ready. Give them a moment.';
      this.changed();
      return;
    }
    if (!this.nearbyPeers.includes(peer) || !this.protocol) {
      meshWarn('requestJoin waiting for neighbor', {
        peer,
        inNeighbors: this.nearbyPeers.includes(peer),
      });
      this.joiningPeer = peer;
      this.discover();
      this.changed();
      return;
    }
    if (!peer.startsWith('off1')) {
      meshWarn('requestJoin blocked — peer is not off1', { peer });
      this.discoveryError =
        'This player is still getting ready. Try again in a moment.';
      this.changed();
      return;
    }
    if (!(await this.ensureMlsReady())) {
      meshWarn('requestJoin blocked — MLS not ready');
      this.discoveryError = 'Almost ready. Try connecting again in a moment.';
      this.changed();
      return;
    }
    if (!this.peerReadyForJoin(peer)) {
      this.discoveryError =
        'Getting closer… give the connection a few seconds.';
      this.changed();
      return;
    }
    const lobby = target.lobby ?? DIRECT_LOBBY;
    this.joinLobby = lobby;
    this.joiningPeer = peer;
    this.discoveryError = '';
    this.changed();
    this.incomingRequests = [];
    this.joinAccepted = false;
    this.session.connect(peer, lobby);
    if (this.session.view.phase !== 'connecting') {
      meshWarn('requestJoin failed to enter connecting phase');
      this.joiningPeer = '';
      this.changed();
      return;
    }
    try {
      await this.services.discoverServices(SERVICE_NAME).catch(() => {});

      const joinEnvelope = {
        v: 1 as const,
        type: 'join' as const,
        lobby,
        join: this.session.joinToken,
      };
      const keyPackage = await this.localKeyPackage();
      meshLog('sendConnectionRequest', {
        to: shortPeer(peer),
        lobby,
        join: joinEnvelope.join,
        keyPackageBytes: keyPackage?.length ?? 0,
      });
      const joinEpoch = this.joinTransportEpoch;
      void this.sendJoinBurst(peer, joinEnvelope, joinEpoch);
      const messageId = await this.protocol.sendConnectionRequest({
        recipient: peer,
        senderName: this.displayName(this.localPeer),
        initialMessage: JSON.stringify(joinEnvelope),
        keyPackage,
      });
      meshLog('sendConnectionRequest ok', { to: shortPeer(peer), messageId });
    } catch (error) {
      meshError('sendConnectionRequest failed', {
        to: shortPeer(peer),
        error: error instanceof Error ? error.message : String(error),
      });
      this.session.onRejected('Could not send join request. Try again.');
    } finally {
      this.joiningPeer = '';
      this.changed();
    }
  }

  async acceptRequest(peer: string) {
    meshLog('acceptRequest', {
      peer: shortPeer(peer),
      phase: this.session.view.phase,
      queue: this.incomingRequests.length,
    });
    const request = this.incomingRequests.find((r) => r.peer === peer);
    const joinId =
      request?.joinId || this.pendingJoinByPeer.get(peer)?.joinId || '';
    if (
      !request ||
      !joinId ||
      !this.protocol ||
      !this.session.host ||
      this.accepting ||
      this.session.view.phase !== 'waiting'
    ) {
      meshWarn('acceptRequest skipped', {
        found: !!request,
        joinId: joinId || '(missing)',
        host: this.session.host,
        accepting: this.accepting,
        phase: this.session.view.phase,
      });
      if (request && !joinId) {
        this.discoveryError =
          'Join data still syncing — wait a second and tap Accept again.';
        this.changed();
      }
      return;
    }
    this.accepting = true;
    this.incomingRequests = this.incomingRequests.filter(
      (r) => r.peer !== peer,
    );
    this.changed();
    try {
      if (!(await this.ensureMlsReady())) {
        throw new Error('MLS not ready');
      }
      if (request.keyPackage?.length) {
        await this.protocol
          .mlsImportKeyPackage(peer, request.keyPackage)
          .catch((error) => {
            meshWarn('mlsImportKeyPackage failed', {
              from: shortPeer(peer),
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
      const keyPackage = await this.localKeyPackage();
      try {
        await this.protocol.acceptConnectionRequest({
          recipient: peer,
          accepterName: this.displayName(this.localPeer),
          keyPackage,
        });
      } catch (error) {
        meshWarn('acceptConnectionRequest failed — continuing with app join', {
          peer: shortPeer(peer),
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!this.closing) {
        meshLog('hostAccept + publish state', {
          peer: shortPeer(peer),
          joinId,
        });
        this.session.hostAccept(peer, joinId);
        void this.sendStateBurst(peer);
      }
    } catch (error) {
      meshError('acceptRequest failed', {
        peer: shortPeer(peer),
        error: error instanceof Error ? error.message : String(error),
      });
      this.incomingRequests = [...this.incomingRequests, request];
      this.discoveryError = 'Could not accept. Please try Accept again.';
      this.changed();
    } finally {
      this.accepting = false;
    }
  }

  async rejectRequest(peer: string) {
    this.incomingRequests = this.incomingRequests.filter(
      (r) => r.peer !== peer,
    );
    this.changed();
    if (!this.protocol) {
      return;
    }
    try {
      await this.protocol.rejectConnectionRequest({ recipient: peer });
    } catch {
      /* best effort */
    }
  }

  private parseJoinMessage(initialMessage?: string) {
    if (!initialMessage) {
      return null;
    }
    const message = decode(initialMessage);
    return message?.type === 'join'
      ? { lobby: message.lobby, joinId: message.join }
      : null;
  }

  private rememberHost(peer: string, lobby: unknown, name: unknown) {
    if (
      this.session.host ||
      peer === this.localPeer ||
      typeof lobby !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(lobby)
    ) {
      return;
    }
    this.nearby = [
      ...this.nearby.filter((s) => s.peer !== peer),
      {
        peer,
        lobby,
        name: typeof name === 'string' ? name.slice(0, 30) : 'Nearby peer',
        seen: Date.now(),
        reachable: this.neighbors.has(peer),
      },
    ];
    this.discoveryError = '';
  }

  private updateNeighbors() {
    this.nearby = this.nearby.map((s) => ({
      ...s,
      reachable: this.neighbors.has(s.peer),
    }));
    for (const [peer, event] of this.announcements) {
      if (this.neighbors.has(peer)) {
        this.rememberHost(
          peer,
          event.capabilities.lobby,
          event.capabilities.name,
        );
        this.announcements.delete(peer);
      }
    }
    this.listSettledNeighborsAsPlayers();
    this.changed();
  }

  private discover() {
    if (!this.protocol || this.discoveryInFlight || this.closing) {
      return;
    }
    this.discoveryInFlight = true;
    void this.refreshDiscovery().finally(() => {
      this.discoveryInFlight = false;
    });
  }

  private async refreshDiscovery() {
    const p = this.protocol!;
    const revision = this.neighborRevision;
    try {
      const topology = await p.getTopology();
      if (this.closing) {
        return;
      }
      if (revision === this.neighborRevision) {
        for (const link of topology.links) {
          if (link.transport.toLowerCase() !== 'ble') {
            continue;
          }
          if (link.from === topology.local_user_id) {
            this.neighbors.add(link.to);
          }
          if (link.to === topology.local_user_id) {
            this.neighbors.add(link.from);
          }
        }
        this.neighbors.delete(topology.local_user_id);
        for (const peer of this.neighbors)
          if (!this.neighborFirstSeen.has(peer))
            this.neighborFirstSeen.set(peer, Date.now());
        this.updateNeighbors();
      }
    } catch {
      if (!this.closing) {
        this.discoveryError = 'Unable to refresh nearby phones. Retrying…';
      }
    }
    if (this.closing || this.session.host) {
      if (!this.closing) {
        this.changed();
      }
      return;
    }

    try {
      meshLog('discoverServices', {
        service: SERVICE_NAME,
        neighbors: [...this.neighbors],
      });
      await this.services.discoverServices(SERVICE_NAME);
    } catch {
      if (!this.closing) {
        this.discoveryError =
          'Still looking. Keep both apps open and move a little closer.';
      }
    }

    if (!this.closing) {
      this.changed();
    }
  }

  private onEvent = (event: ProtocolEvent) => {
    if (this.closing) {
      return;
    }
    const logEvent = [
      'connection_request_received',
      'connection_accepted',
      'connection_rejected',
      'connection_request_undeliverable',
      'message_received',
      'message_failed',
      'identity_ready',
    ].includes(event.type);
    if (logEvent) {
      meshLog(`event:${event.type}`, this.eventSummary(event));
    }
    switch (event.type) {
      case 'identity_ready':
        if (typeof event.address === 'string' && event.address.length > 0) {
          this.localPeer = event.address;
          meshLog('identity_ready', { localPeer: shortPeer(event.address) });
        }
        break;
      case 'neighbor_discovered':
        if (event.transport.toLowerCase() !== 'ble') {
          return;
        }
        meshLog('neighbor_discovered', {
          peer: event.peer_id,
          shortPeer: shortPeer(event.peer_id),
          transport: event.transport,
        });
        this.neighborRevision++;
        this.neighbors.add(event.peer_id);
        if (!this.neighborFirstSeen.has(event.peer_id)) {
          this.neighborFirstSeen.set(event.peer_id, Date.now());
        }
        this.updateNeighbors();
        this.nearby = this.nearby.map((s) =>
          s.peer === event.peer_id ? { ...s, reachable: true } : s,
        );
        if (this.ready) {
          this.discover();
        }
        break;
      case 'neighbor_lost':
        meshLog('neighbor_lost', { peer: shortPeer(event.peer_id) });
        this.neighborRevision++;
        this.neighbors.delete(event.peer_id);
        if (this.session.isOpponent(event.peer_id)) {
          this.session.disconnect('Opponent disconnected');
        }
        this.nearby = this.nearby.map((s) =>
          s.peer === event.peer_id ? { ...s, reachable: false } : s,
        );
        break;
      case 'service_discovered': {
        const lobby = event.capabilities.lobby ?? '';
        if (
          event.service_id !== SERVICE_NAME ||
          event.version !== '1' ||
          event.hop_count > 2 ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(lobby)
        ) {
          return;
        }
        if (!this.neighbors.has(event.provider_peer_id)) {
          if (this.announcements.size >= 64) {
            this.announcements.clear();
          }
          this.announcements.set(event.provider_peer_id, event);
          meshLog('service_discovered buffered (no neighbor yet)', {
            provider: event.provider_peer_id,
            lobby,
            name: event.capabilities.name,
          });
          return;
        }
        meshLog('service_discovered → session listed', {
          provider: event.provider_peer_id,
          lobby,
          name: event.capabilities.name,
        });
        this.rememberHost(
          event.provider_peer_id,
          event.capabilities.lobby,
          event.capabilities.name,
        );
        break;
      }
      case 'security_warning': {
        meshWarn('security_warning', {
          peer: shortPeer(event.peer_id),
          code: event.reason_code,
          reason: event.reason,
        });
        if (
          event.reason_code === 'TRANSPORT_IDENTITY_MISMATCH' &&
          event.peer_id.startsWith('off1')
        ) {
          this.promoteVerifiedHost(event.peer_id);
        }
        break;
      }
      case 'connection_request_received': {
        this.resolveCrossedJoin(event.sender);
        if (!this.session.host) {
          return;
        }
        const peerId = this.resolvePeerId(
          event as unknown as Record<string, unknown>,
        );
        if (!peerId || peerId === this.localPeer) {
          return;
        }
        if (this.session.view.phase !== 'waiting') {
          if (
            this.session.view.phase === 'active' &&
            this.session.isOpponent(peerId)
          ) {
            meshLog(
              'connection_request_received ignored — already in session',
              {
                from: shortPeer(peerId),
              },
            );
            return;
          }
          void this.protocol
            ?.rejectConnectionRequest({ recipient: peerId })
            .catch(() => {});
          return;
        }
        const parsed = this.parseJoinMessage(
          this.connectionInitialMessage(event),
        );
        const join =
          parsed &&
          (parsed.lobby === this.session.lobby || parsed.lobby === DIRECT_LOBBY)
            ? parsed
            : (this.pendingJoinByPeer.get(peerId) ?? {
                lobby: DIRECT_LOBBY,
                joinId: parsed?.joinId ?? '',
              });
        const keyPackage =
          event.key_package ?? (event as { keyPackage?: number[] }).keyPackage;
        this.queueJoinRequest(
          peerId,
          join,
          this.resolveSenderName(
            event as unknown as Record<string, unknown>,
            peerId,
          ),
          Array.isArray(keyPackage) ? keyPackage : undefined,
        );
        break;
      }
      case 'connection_accepted':
        if (!this.session.host && this.session.isOpponent(event.accepted_by)) {
          if (
            Array.isArray(event.key_package) &&
            event.key_package.length > 0
          ) {
            void this.protocol
              ?.mlsImportKeyPackage(event.accepted_by, event.key_package)
              .catch(() => {});
          }
          this.discoveryError =
            'You’re connected! Getting your board ready…';
        }
        break;
      case 'connection_rejected':
        if (
          !this.session.host &&
          this.session.isOpponent(event.rejected_by) &&
          this.session.view.phase === 'connecting'
        ) {
          this.session.onRejected(
            'That player declined. Let’s find another rival.',
          );
        }
        break;
      case 'connection_request_undeliverable':
        if (
          !this.session.host &&
          this.session.view.phase === 'connecting' &&
          this.session.isOpponent(event.recipient)
        ) {
          this.discoveryError =
            'Still connecting… your friend needs to tap Accept.';
        }
        break;
      case 'message_failed':
        meshWarn('message_failed', {
          messageId: event.message_id,
          reason: event.reason,
          retries: event.retry_count,
        });
        break;
      case 'message_received': {
        const join = this.parseJoinMessage(event.content);
        if (join) this.resolveCrossedJoin(event.sender);
        if (
          this.session.host &&
          this.session.view.phase === 'waiting' &&
          join &&
          (join.lobby === this.session.lobby || join.lobby === DIRECT_LOBBY)
        ) {
          this.queueJoinRequest(
            event.sender,
            join,
            `Nearby peer ${event.sender.slice(-6).toUpperCase()}`,
          );
          break;
        }
        const wire = decode(event.content);
        const trusted =
          this.neighbors.has(event.sender) ||
          this.session.isOpponent(event.sender);
        const sessionWire =
          wire !== null && SESSION_WIRE_TYPES.has(wire.type) && trusted;
        const directBle =
          event.transport.toLowerCase() === 'ble' && event.hop_count <= 1;
        if (!sessionWire && !directBle) {
          return;
        }
        this.neighborRevision++;
        this.neighbors.add(event.sender);
        if (!this.neighborFirstSeen.has(event.sender)) {
          this.neighborFirstSeen.set(event.sender, Date.now());
        }
        this.updateNeighbors();
        const opponent = this.session.opponentPeer();
        if (
          opponent &&
          event.sender !== opponent &&
          event.sender.startsWith('off1') &&
          this.neighbors.has(event.sender)
        ) {
          this.session.rebindOpponent(event.sender);
        }
        const wasConnecting = this.session.view.phase === 'connecting';
        this.session.receive(event.sender, event.content);
        if (
          !this.session.host &&
          wasConnecting &&
          this.session.view.phase === 'active'
        ) {
          this.stopJoinTransport();
          this.session.connectionAccepted();
        }
        break;
      }
      default:
        return;
    }
    this.changed();
  };

  private eventSummary(event: ProtocolEvent): Record<string, unknown> {
    switch (event.type) {
      case 'connection_request_received':
        return {
          from: shortPeer(event.sender),
          name: event.sender_name,
          hasInitialMessage: !!event.initial_message,
          keyPackageBytes: event.key_package?.length ?? 0,
        };
      case 'connection_accepted':
        return {
          by: shortPeer(event.accepted_by),
          keyPackageBytes: event.key_package?.length ?? 0,
        };
      case 'connection_rejected':
        return { by: shortPeer(event.rejected_by) };
      case 'connection_request_undeliverable':
        return {
          recipient: shortPeer(event.recipient),
          reason: event.reason,
          messageId: event.message_id,
        };
      case 'message_received':
        return {
          from: shortPeer(event.sender),
          transport: event.transport,
          hops: event.hop_count,
          preview: event.content?.slice(0, 80),
        };
      case 'identity_ready':
        return { address: shortPeer(event.address) };
      case 'message_failed':
        return {
          messageId: event.message_id,
          reason: event.reason,
          retries: event.retry_count,
        };
      default:
        return {};
    }
  }

  close(): Promise<void> {
    this.closingTask ??= this.closeInternal();
    return this.closingTask;
  }

  private async closeInternal() {
    meshLog('close begin', { phase: this.session.view.phase });
    this.session.leave();
    this.closing = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.startTask;
    const p = this.protocol;
    if (!p) {
      return;
    }
    try {
      if (this.ready) {
        await this.services.unregisterService(SERVICE_NAME);
      }

      await pause(200);
    } finally {
      p.off('all', this.onEvent);
      try {
        await p.stop();
      } finally {
        await pause(Platform.OS === 'android' ? 3000 : 500);
        await p.destroy();
      }
    }
  }
}
