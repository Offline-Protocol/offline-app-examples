import OfflineProtocol, {
  MeshServices,
  MessagePriority,
  type ProtocolConfig,
  type ProtocolEvent,
} from '@offline-protocol/mesh-sdk';
import { Platform } from 'react-native';
import { decodeEnvelope, encodeEnvelope, type Envelope } from './envelope';
import {
  cleanName,
  hostFromAnnouncement,
  pruneHosts,
  SERVICE_VERSION,
  upsertHost,
  type NearbyHost,
} from './hosts';
import { requestNearbyPermissions } from './permissions';

export type RoomStatus =
  | 'idle' // nothing running
  | 'starting' // permissions, Bluetooth and encryption identity
  | 'hosting' // advertising the room, auto-accepting joiners
  | 'discovering' // listing nearby hosts
  | 'joining' // asked a host to join (and, in group mode, waiting for the group)
  | 'connected' // joined a host
  | 'error'; // see `error`; call host() or discover() to try again

export type RoomPeer = { id: string; name: string };

export type RoomOptions = {
  /** Must be identical on every device of the app. Scopes BLE, discovery and storage. */
  appId: string;
  /** Host creates an MLS group and adds every joiner, for the SDK's DataStore. */
  group?: boolean;
};

/** App callbacks. useNearbyRoom always hands the room their latest version. */
export type RoomCallbacks = {
  onMessage?: (from: string, data: unknown) => void;
  onPeerJoined?: (peer: RoomPeer) => void;
  onPeerLeft?: (peer: RoomPeer) => void;
  /** Every raw SDK event, e.g. `data_changed` for DataStore. */
  onProtocolEvent?: (event: ProtocolEvent) => void;
};

export type RoomSnapshot = {
  status: RoomStatus;
  error: string;
  role: 'host' | 'member' | null;
  localId: string;
  /** Host: its own id. Member: the host it joined (or is joining). */
  hostId: string | null;
  /** Nearby hosts (members, while discovering or joining). */
  hosts: NearbyHost[];
  /** Connected peers. Host: its members. Member: just the host. */
  peers: RoomPeer[];
  /** Group mode: the MLS group id, usable as a DataStore space id. */
  groupId: string | null;
};

const TICK_MS = 2000;
const HOST_TTL_MS = 20_000; // a host that stops answering discovery disappears from the list
const DISCOVER_MIN_INTERVAL_MS = 6000; // discovery queries flood BLE, so throttle them
const NEIGHBOR_SETTLE_MS = 2000; // a fresh BLE link needs a moment before a join request survives
const JOIN_RETRY_MS = 8000;
const JOIN_TIMEOUT_MS = 90_000;
const PEER_LOST_GRACE_MS = 20_000; // BLE links flap; only drop a peer that stays gone
const MAX_MESSAGE_BYTES = 16 * 1024; // one message, in bytes of JSON

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One nearby session over Bluetooth: a host advertises a room, members find it,
 * ask to join and are accepted automatically. Afterwards everybody exchanges JSON.
 *
 * Owns the only OfflineProtocol instance while active. `leave()` stops it.
 */
export class NearbyRoom {
  private snapshot: RoomSnapshot = {
    status: 'idle',
    error: '',
    role: null,
    localId: '',
    hostId: null,
    hosts: [],
    peers: [],
    groupId: null,
  };
  private listeners = new Set<() => void>();
  /** The running SDK instance. Null when idle. */
  private protocol: OfflineProtocol | null = null;
  private readonly serviceId: string;
  private readonly services = new MeshServices();
  private name = '';
  private timer?: ReturnType<typeof setInterval>;
  private ticks = 0;
  private stopping: Promise<void> = Promise.resolve();
  /** Bumped on every start and stop, so work from an older session can tell it is stale. */
  private generation = 0;
  /** Direct BLE neighbors -> when first seen. */
  private neighbors = new Map<string, number>();
  private neighborsChanged = false;
  /** Announcements from devices that are not (yet) direct neighbors. */
  private pendingHosts = new Map<string, NearbyHost>();
  /** Everybody accepted into this session, even if currently out of range. */
  private accepted = new Map<string, string>();
  private lostTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private invited = new Set<string>();
  private discoveryInFlight = false;
  private invitesInFlight = false;
  private adoptingGroup = false;
  private lastDiscoverAt = 0;
  private joinStartedAt = 0;
  private lastJoinRequestAt = 0;

  constructor(
    private readonly options: RoomOptions,
    private readonly callbacks: () => RoomCallbacks,
  ) {
    this.serviceId = `${options.appId}-room`;
  }

  // ---------------------------------------------------------------- public API

  getSnapshot = (): RoomSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * Starts advertising a room called `displayName`. Joiners are accepted automatically.
   * Group mode: creates an MLS group, so `groupId` is set as soon as the status is 'hosting'.
   */
  host = async (displayName: string): Promise<void> => {
    const p = await this.start('host', cleanName(displayName, 'Host'));
    if (!p) return;
    try {
      const groupId = this.options.group ? (await p.meshCreateGroup(this.name)).groupId : null;
      await this.advertise();
      if (this.protocol !== p) return; // left meanwhile
      this.update({ status: 'hosting', hostId: this.snapshot.localId, groupId });
    } catch (error) {
      if (this.protocol === p) this.fail(error);
    }
  };

  /** Starts looking for nearby hosts. They appear in `hosts`. */
  discover = async (): Promise<void> => {
    const p = await this.start('member', '');
    if (!p) return;
    this.update({ status: 'discovering' });
    void this.refreshDiscovery();
  };

  /** Asks a discovered host to join. Status goes 'joining' -> 'connected'. */
  join = async (hostId: string, displayName: string): Promise<void> => {
    const { status, hosts } = this.snapshot;
    if (status !== 'discovering' || !hosts.some(h => h.id === hostId)) return;
    this.name = cleanName(displayName, 'Guest');
    this.joinStartedAt = Date.now();
    this.lastJoinRequestAt = 0;
    this.update({ status: 'joining', hostId });
    await this.sendJoinRequest();
  };

  /** Sends JSON-serializable `data` to one connected peer. Throws if it is over the size limit. */
  send = async (peerId: string, data: unknown): Promise<void> => {
    await this.sendEnvelope(peerId, { t: 'app', d: data });
  };

  /** Sends `data` to every connected peer: the host to all members, a member to its host. */
  broadcast = async (data: unknown): Promise<void> => {
    const content = encodeEnvelope({ t: 'app', d: data }, MAX_MESSAGE_BYTES);
    await Promise.all(this.snapshot.peers.map(peer => this.sendRaw(peer.id, content)));
  };

  /** Says goodbye to peers, stops the protocol and returns to 'idle'. */
  leave = async (): Promise<void> => {
    this.stop(this.snapshot.peers);
    this.update({ ...IDLE });
    await this.stopping;
  };

  // ------------------------------------------------------------ start / stop

  private async start(role: 'host' | 'member', name: string): Promise<OfflineProtocol | null> {
    const { status } = this.snapshot;
    if (status !== 'idle' && status !== 'error') return null;
    this.update({ ...IDLE, status: 'starting', role });
    const generation = ++this.generation; // leave() bumps it; every check below bails out then
    await this.stopping; // the previous instance must be gone before a new one starts
    this.resetSession();
    this.name = name;
    try {
      await requestNearbyPermissions();
      if (generation !== this.generation) return null;
      const p = new OfflineProtocol(protocolConfig(this.options));
      p.on('all', this.onEvent); // before start(), so no message event is missed
      this.protocol = p;
      await p.start();
      await pause(500); // let native BLE and the MLS identity settle
      if (!(await p.isMlsInitialized())) await p.initializeMlsWithSecureStorage();
      const localId = await poll(() => p.localAddress(), 15_000);
      if (!localId) throw new Error('This device’s mesh identity is not ready. Close and reopen the app.');
      if (!(await waitForBluetooth(p))) {
        throw new Error('Turn on Bluetooth and allow Bluetooth access in Settings, then try again.');
      }
      if (generation !== this.generation) return null; // left while starting
      this.update({ localId });
      this.timer = setInterval(this.tick, TICK_MS);
      return p;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
      return null;
    }
  }

  private fail(error: unknown) {
    log(this.options.appId, 'error', errorMessage(error));
    this.stop();
    this.update({ ...IDLE, status: 'error', error: errorMessage(error) });
  }

  /** Tears the protocol down in the background; `this.stopping` settles when done. */
  private stop(sayByeTo: RoomPeer[] = []) {
    const p = this.protocol;
    const wasHost = this.snapshot.role === 'host';
    this.generation++;
    clearInterval(this.timer);
    this.lostTimers.forEach(clearTimeout);
    this.resetSession();
    this.protocol = null;
    if (!p) return;
    const bye = encodeEnvelope({ t: 'bye' }, MAX_MESSAGE_BYTES);
    this.stopping = (async () => {
      p.off('all', this.onEvent);
      if (sayByeTo.length) {
        await Promise.all(sayByeTo.map(peer => p.sendMessage({ recipient: peer.id, content: bye }).catch(() => {})));
        await pause(500); // give the goodbyes a moment on the radio
      }
      if (wasHost) await this.services.unregisterService(this.serviceId).catch(() => {});
      await p.stop().catch(() => {});
      await pause(Platform.OS === 'android' ? 3000 : 500); // native BLE teardown is not awaited by stop()
      await p.destroy().catch(() => {});
    })();
  }

  private resetSession() {
    this.neighbors.clear();
    this.pendingHosts.clear();
    this.accepted.clear();
    this.lostTimers.clear();
    this.invited.clear();
    this.ticks = 0;
    this.lastDiscoverAt = 0;
  }

  // ------------------------------------------------------------------ events

  private onEvent = (event: ProtocolEvent) => {
    if (!this.protocol) return;
    this.callbacks().onProtocolEvent?.(event);
    switch (event.type) {
      case 'identity_ready':
        if (event.address) this.update({ localId: event.address });
        break;
      case 'neighbor_discovered':
        if (event.transport.toLowerCase() !== 'ble') return;
        this.noteNeighbor(event.peer_id);
        if (this.snapshot.status === 'discovering') void this.refreshDiscovery();
        break;
      case 'neighbor_lost':
        this.neighbors.delete(event.peer_id);
        this.neighborsChanged = true;
        this.schedulePeerLost(event.peer_id);
        break;
      case 'service_discovered':
        this.onAnnouncement(event);
        break;
      case 'connection_request_received':
        void this.onJoinRequest(event.sender, event.sender_name);
        break;
      case 'connection_accepted':
        if (this.isJoining(event.accepted_by)) this.onAccepted();
        break;
      case 'connection_rejected':
        if (this.isJoining(event.rejected_by)) this.fail(new Error('The host turned down the request.'));
        break;
      case 'message_received':
        this.onMessage(event.sender, event.content);
        break;
      case 'group_member_added':
        // Fired on a member when the host's Welcome has been processed.
        if (event.user_id === this.snapshot.localId && event.added_by === this.snapshot.hostId) {
          void this.adoptGroup(event.group_id);
        }
        break;
    }
  };

  private tick = () => {
    const { role, status } = this.snapshot;
    this.ticks++;
    if (role === 'host') {
      if (this.ticks % 4 === 0) void this.advertise().catch(() => {}); // re-register, survives BLE restarts
      if (this.options.group) void this.inviteMembers();
    } else if (status === 'discovering') {
      const hosts = pruneHosts(this.snapshot.hosts, Date.now(), HOST_TTL_MS);
      if (hosts !== this.snapshot.hosts) this.update({ hosts });
      void this.refreshDiscovery();
    } else if (status === 'joining') {
      if (Date.now() - this.joinStartedAt > JOIN_TIMEOUT_MS) {
        this.fail(new Error(this.accepted.size ? 'Joined, but the shared group never arrived. Try again.' : 'The host did not answer. Move closer and try again.'));
      } else if (!this.accepted.has(this.snapshot.hostId ?? '') && Date.now() - this.lastJoinRequestAt > JOIN_RETRY_MS) {
        void this.sendJoinRequest(); // requests can be lost on a fresh link, so repeat until accepted
      }
    }
  };

  // --------------------------------------------------------------- neighbors

  private noteNeighbor(id: string) {
    if (!id || id === this.snapshot.localId) return;
    if (!this.neighbors.has(id)) {
      this.neighbors.set(id, Date.now());
      this.neighborsChanged = true;
    }
    this.backInRange(id);
    const pending = this.pendingHosts.get(id);
    if (pending) {
      this.pendingHosts.delete(id);
      this.update({ hosts: upsertHost(this.snapshot.hosts, { ...pending, seenAt: Date.now() }) });
    }
    if (this.snapshot.role === 'host') void this.primeSession(id);
  }

  /** Gives the auto key exchange a nudge so the encrypted 1:1 session is ready sooner. */
  private async primeSession(peerId: string) {
    const p = this.protocol;
    for (let attempt = 0, delay = 100; p && attempt < 6; attempt++, delay = Math.min(delay * 2, 400)) {
      const state = await p.getEstablishmentState(peerId).catch(() => null);
      if (state === 'SessionConfirmed' || state === 'SessionPending') return;
      if (state === 'HaveKeyPackage') await p.establishSecureSession(peerId).catch(() => {});
      await pause(delay);
    }
  }

  // ---------------------------------------------------------------- discovery

  private async advertise() {
    await this.services.registerService(this.serviceId, SERVICE_VERSION, { name: this.name });
  }

  private async refreshDiscovery() {
    const p = this.protocol;
    if (!p || this.discoveryInFlight) return;
    this.discoveryInFlight = true;
    try {
      // Neighbor events can be missed, so reconcile with the topology.
      const topology = await p.getTopology();
      for (const link of topology.links) {
        if (link.transport.toLowerCase() !== 'ble') continue;
        if (link.from === topology.local_user_id) this.noteNeighbor(link.to);
        if (link.to === topology.local_user_id) this.noteNeighbor(link.from);
      }
      const due = this.neighborsChanged || Date.now() - this.lastDiscoverAt >= DISCOVER_MIN_INTERVAL_MS;
      if (due && this.neighbors.size > 0 && this.snapshot.status === 'discovering') {
        this.neighborsChanged = false;
        this.lastDiscoverAt = Date.now();
        await this.services.discoverServices(this.serviceId);
      }
    } catch (error) {
      log(this.options.appId, 'discovery retrying', errorMessage(error));
    } finally {
      this.discoveryInFlight = false;
    }
  }

  private onAnnouncement(event: Parameters<typeof hostFromAnnouncement>[0]) {
    if (this.snapshot.status !== 'discovering') return;
    const host = hostFromAnnouncement(event, this.serviceId, this.snapshot.localId, Date.now());
    if (!host) return;
    // Discovery gossips across hops; only list hosts we have a direct link to.
    if (this.neighbors.has(host.id)) {
      this.update({ hosts: upsertHost(this.snapshot.hosts, host) });
    } else if (this.pendingHosts.size < 32) {
      this.pendingHosts.set(host.id, host);
    }
  }

  // ------------------------------------------------------------------ joining

  private isJoining(peerId: string) {
    return this.snapshot.role === 'member' && this.snapshot.status === 'joining' && peerId === this.snapshot.hostId;
  }

  private async sendJoinRequest() {
    const p = this.protocol;
    const { hostId } = this.snapshot;
    if (!p || !hostId || this.snapshot.status !== 'joining') return;
    const firstSeen = this.neighbors.get(hostId);
    if (firstSeen === undefined || Date.now() - firstSeen < NEIGHBOR_SETTLE_MS) return; // the tick retries
    this.lastJoinRequestAt = Date.now();
    await p.sendConnectionRequest({ recipient: hostId, senderName: this.name }).catch(error => {
      log(this.options.appId, 'join request failed', errorMessage(error));
    });
  }

  /** Host side: every join request is accepted (again, if it is a retry). */
  private async onJoinRequest(peerId: string, peerName: string) {
    const p = this.protocol;
    if (!p || !peerId || peerId === this.snapshot.localId) return;
    if (this.snapshot.role !== 'host') {
      await p.rejectConnectionRequest({ recipient: peerId }).catch(() => {});
      return;
    }
    if (this.snapshot.status !== 'hosting') return; // still starting; the joiner retries
    await p.acceptConnectionRequest({ recipient: peerId, accepterName: this.name }).catch(error => {
      log(this.options.appId, 'accept failed', errorMessage(error));
    });
    this.accepted.set(peerId, cleanName(peerName, 'Guest'));
    this.backInRange(peerId);
    void this.primeSession(peerId);
  }

  /** Member side: the host accepted (or already sent us something, which implies it). */
  private onAccepted() {
    const hostId = this.snapshot.hostId!;
    const name = this.snapshot.hosts.find(h => h.id === hostId)?.name ?? 'Host';
    this.accepted.set(hostId, name);
    this.backInRange(hostId);
    void this.primeSession(hostId);
    if (!this.options.group || this.snapshot.groupId) this.update({ status: 'connected' });
  }

  // ------------------------------------------------------------------- groups

  /** Host side: add each member to the group once the SDK holds a key package for them. */
  private async inviteMembers() {
    const p = this.protocol;
    const { groupId } = this.snapshot;
    if (!p || !groupId || this.invitesInFlight) return;
    this.invitesInFlight = true;
    try {
      for (const peer of this.snapshot.peers) {
        if (this.invited.has(peer.id)) continue;
        try {
          const info = await p.meshGetGroupInfo(groupId);
          if (!info?.memberIds.includes(peer.id)) {
            // After the 1:1 session forms, the SDK sends each side a fresh key package for this.
            if (!(await p.hasPendingKeyPackage(peer.id))) continue;
            await p.meshInviteToGroup(groupId, peer.id);
          }
          this.invited.add(peer.id);
          await this.sendEnvelope(peer.id, { t: 'group', id: groupId });
        } catch (error) {
          log(this.options.appId, 'group invite retrying', errorMessage(error));
        }
      }
    } finally {
      this.invitesInFlight = false;
    }
  }

  /** Member side: wait until the Welcome for `groupId` has been processed locally. */
  private async adoptGroup(groupId: string) {
    const p = this.protocol;
    if (!p || !this.options.group || this.snapshot.groupId || this.adoptingGroup) return;
    this.adoptingGroup = true;
    try {
      for (let attempt = 0; attempt < 30 && this.protocol === p; attempt++) {
        if (await p.meshGetGroupInfo(groupId).catch(() => null)) {
          this.update({ groupId, status: this.accepted.size ? 'connected' : this.snapshot.status });
          return;
        }
        await pause(1000);
      }
    } finally {
      this.adoptingGroup = false;
    }
  }

  // ----------------------------------------------------------------- messages

  private onMessage(from: string, content: string) {
    const envelope = decodeEnvelope(content, MAX_MESSAGE_BYTES);
    if (!envelope) return;
    if (!this.accepted.has(from)) {
      if (!this.isJoining(from)) return; // not part of this room
      this.onAccepted();
    }
    this.backInRange(from);
    if (envelope.t === 'app') {
      this.callbacks().onMessage?.(from, envelope.d);
    } else if (envelope.t === 'bye') {
      this.accepted.delete(from);
      this.removePeer(from);
      if (this.snapshot.role === 'member') this.fail(new Error('The host ended the session.'));
    } else if (envelope.t === 'group' && this.snapshot.role === 'member') {
      void this.adoptGroup(envelope.id);
    }
  }

  private async sendEnvelope(peerId: string, envelope: Envelope) {
    await this.sendRaw(peerId, encodeEnvelope(envelope, MAX_MESSAGE_BYTES));
  }

  private async sendRaw(peerId: string, content: string) {
    const p = this.protocol;
    if (!p) throw new Error('The room is not running.');
    // Queued by the SDK until the encrypted session is ready, then retried until acknowledged.
    await p.sendMessage({ recipient: peerId, content, priority: MessagePriority.High });
  }

  // -------------------------------------------------------------------- peers

  /** An accepted peer is (again) reachable: list it and cancel any pending removal. */
  private backInRange(id: string) {
    clearTimeout(this.lostTimers.get(id));
    this.lostTimers.delete(id);
    const name = this.accepted.get(id);
    if (name === undefined || this.snapshot.peers.some(p => p.id === id)) return;
    const peer = { id, name };
    this.update({ peers: [...this.snapshot.peers, peer] });
    this.callbacks().onPeerJoined?.(peer);
  }

  private schedulePeerLost(id: string) {
    if (!this.snapshot.peers.some(p => p.id === id) || this.lostTimers.has(id)) return;
    this.lostTimers.set(
      id,
      setTimeout(() => {
        this.lostTimers.delete(id);
        this.removePeer(id);
      }, PEER_LOST_GRACE_MS),
    );
  }

  private removePeer(id: string) {
    const peer = this.snapshot.peers.find(p => p.id === id);
    if (!peer) return;
    this.update({ peers: this.snapshot.peers.filter(p => p.id !== id) });
    this.callbacks().onPeerLeft?.(peer);
  }

  // ------------------------------------------------------------------ helpers

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
}

const IDLE: Omit<RoomSnapshot, 'localId'> = {
  status: 'idle',
  error: '',
  role: null,
  hostId: null,
  hosts: [],
  peers: [],
  groupId: null,
};

/** Bluetooth only: internet, Nostr, Reticulum and relay servers are off. */
function protocolConfig({ appId, group = false }: RoomOptions): ProtocolConfig {
  // Star rooms only talk to direct neighbors. Group mode lets the host forward
  // group traffic between members that are not in Bluetooth range of each other.
  const hops = group ? 3 : 1;
  return {
    appId,
    profile: 'default',
    transports: {
      ble: { enabled: true },
      // The phone Wi-Fi Direct transport carries no traffic in SDK 0.27, so it stays off.
      wifiDirect: { enabled: false },
      internet: { enabled: false },
      nostr: { enabled: false },
      reticulum: { enabled: false },
    },
    network: { initialTtl: hops },
    meshRelay: { maxTtl: hops, denseMaxTtl: hops },
    relay: group ? { allowRelay: true, relayPriority: 'always' } : { allowRelay: false, relayPriority: 'never' },
    group: { relayEnabled: false, relayBroadcastEnabled: false },
    encryption: { enabled: true, autoKeyExchange: true, storePending: true },
    reliability: {
      ack: { defaultTimeoutMs: 10_000 },
      retry: {
        maxRetries: 8,
        initialDelayMs: 300,
        maxDelayMs: 5000,
        outboxMaxLifetimeMs: 180_000,
        pendingMessageMaxLifetimeMs: 180_000,
      },
    },
  };
}

async function poll<T>(read: () => Promise<T | null | undefined>, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read().catch(() => null);
    if (value) return value;
    await pause(500);
  }
  return null;
}

/** iOS reports Bluetooth as off for a moment after start, so wait a little. */
async function waitForBluetooth(p: OfflineProtocol): Promise<boolean> {
  if (await p.isBluetoothEnabled()) return true;
  if (Platform.OS === 'android' && (await p.requestEnableBluetooth().catch(() => false))) return true;
  return (await poll(async () => ((await p.isBluetoothEnabled()) ? true : null), 10_000)) === true;
}

function log(appId: string, ...args: unknown[]) {
  if (__DEV__) console.log(`[${appId}]`, ...args);
}
