import {
  bluetoothMeshProtocolConfig,
  cleanName,
  pause,
  poll,
  requestNearbyPermissions,
  SERVICE_VERSION,
  waitForBluetooth,
  type NearbyHost,
} from '@offline-app-examples/mesh';
import OfflineProtocol, { MeshServices, type ProtocolEvent } from '@offline-protocol/mesh-sdk';
import { CHECKIN_METHOD, SERVICE_SUFFIX } from '../domain/checkin';

export type YardRole = 'gate' | 'driver' | 'relay';

export type GateProvider = NearbyHost & { hopCount: number };

export type YardStatus = 'idle' | 'starting' | 'active' | 'error';

export type YardSnapshot = {
  status: YardStatus;
  error: string;
  role: YardRole | null;
  localId: string;
  displayName: string;
  providers: GateProvider[];
  neighborCount: number;
};

export type YardCallbacks = {
  onCheckInRequest?: (args: {
    requestId: string;
    sender: string;
    method: string;
    body: string;
  }) => void;
  onCheckInResponse?: (args: {
    requestId: string;
    status: string;
    body: string;
    providerId: string;
  }) => void;
  onProtocolEvent?: (event: ProtocolEvent) => void;
};

const TICK_MS = 2000;
const PROVIDER_TTL_MS = 25_000;
const DISCOVER_MIN_INTERVAL_MS = 6000;
const RELAY_HOPS = 3;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function providerFromEvent(
  event: {
    service_id: string;
    version: string;
    provider_peer_id: string;
    capabilities: Record<string, string>;
    hop_count: number;
  },
  serviceId: string,
  localId: string,
  now: number,
): GateProvider | null {
  const id = event.provider_peer_id;
  if (
    event.service_id !== serviceId ||
    event.version !== SERVICE_VERSION ||
    id === localId ||
    !id.startsWith('off1')
  ) {
    return null;
  }
  return {
    id,
    name: cleanName(event.capabilities?.name, 'Gate'),
    seenAt: now,
    hopCount: event.hop_count,
  };
}

function pruneProviders(providers: GateProvider[], now: number): GateProvider[] {
  const fresh = providers.filter((p) => now - p.seenAt < PROVIDER_TTL_MS);
  return fresh.length === providers.length ? providers : fresh;
}

function upsertProvider(providers: GateProvider[], provider: GateProvider): GateProvider[] {
  const index = providers.findIndex((p) => p.id === provider.id);
  if (index === -1) return [...providers, provider];
  const next = providers.slice();
  next[index] = provider;
  return next;
}

const IDLE: YardSnapshot = {
  status: 'idle',
  error: '',
  role: null,
  localId: '',
  displayName: '',
  providers: [],
  neighborCount: 0,
};

export class GateSession {
  private snapshot: YardSnapshot = { ...IDLE };
  private listeners = new Set<() => void>();
  private protocol: OfflineProtocol | null = null;
  private readonly services = new MeshServices();
  private readonly serviceId: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private stopping: Promise<void> = Promise.resolve();
  private neighbors = new Set<string>();
  private lastDiscoverAt = 0;
  private discoveryInFlight = false;
  private displayName = '';

  constructor(
    private readonly appId: string,
    private getCallbacks: () => YardCallbacks,
  ) {
    this.serviceId = `${appId}${SERVICE_SUFFIX}`;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): YardSnapshot => this.snapshot;

  start = async (role: YardRole, displayName: string): Promise<void> => {
    if (this.snapshot.status !== 'idle' && this.snapshot.status !== 'error') return;
    this.displayName = cleanName(displayName, role === 'gate' ? 'Gate' : role === 'driver' ? 'Driver' : 'Relay');
    this.update({ ...IDLE, status: 'starting', role, displayName: this.displayName });
    const generation = ++this.generation;
    await this.stopping;
    this.neighbors.clear();
    try {
      await requestNearbyPermissions();
      if (generation !== this.generation) return;
      const p = new OfflineProtocol(bluetoothMeshProtocolConfig(this.appId, RELAY_HOPS));
      p.on('all', this.onEvent);
      this.protocol = p;
      await p.start();
      await pause(500);
      if (!(await p.isMlsInitialized())) await p.initializeMlsWithSecureStorage();
      const localId = await poll(() => p.localAddress(), 15_000);
      if (!localId) throw new Error('Mesh identity is not ready. Close and reopen the app.');
      if (!(await waitForBluetooth(p))) {
        throw new Error('Turn on Bluetooth and allow access in Settings, then try again.');
      }
      if (generation !== this.generation) return;
      this.update({ localId });
      if (role === 'gate') {
        await this.services.registerService(this.serviceId, SERVICE_VERSION, { name: this.displayName });
      }
      this.timer = setInterval(this.tick, TICK_MS);
      this.update({ status: 'active' });
      if (role === 'driver') void this.runDiscovery();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  };

  leave = async (): Promise<void> => {
    this.stop();
    this.update({ ...IDLE });
    await this.stopping;
  };

  submitCheckIn = async (providerId: string, body: string): Promise<string> => {
    const p = this.protocol;
    if (!p || this.snapshot.role !== 'driver') throw new Error('Not in driver mode.');
    return this.services.sendServiceRequest(providerId, this.serviceId, CHECKIN_METHOD, body);
  };

  respondToCheckIn = async (
    requestId: string,
    requester: string,
    status: string,
    body: string,
  ): Promise<void> => {
    if (this.snapshot.role !== 'gate') throw new Error('Not in gate mode.');
    await this.services.respondToServiceRequest(requestId, requester, this.serviceId, status, body);
  };

  private fail(error: unknown) {
    if (__DEV__) console.warn('[yardgate]', errorMessage(error));
    this.stop();
    this.update({ ...IDLE, status: 'error', error: errorMessage(error) });
  }

  private stop() {
    const p = this.protocol;
    const role = this.snapshot.role;
    this.protocol = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    ++this.generation;
    this.stopping = (async () => {
      if (role === 'gate') await this.services.unregisterService(this.serviceId).catch(() => {});
      if (p) await p.stop().catch(() => {});
    })();
  }

  private tick = () => {
    const { role, status } = this.snapshot;
    if (status !== 'active') return;
    if (role === 'gate') {
      void this.services
        .registerService(this.serviceId, SERVICE_VERSION, { name: this.displayName })
        .catch(() => {});
    } else if (role === 'driver') {
      const providers = pruneProviders(this.snapshot.providers, Date.now());
      if (providers !== this.snapshot.providers) this.update({ providers });
      void this.runDiscovery();
    }
  };

  private async runDiscovery() {
    if (this.discoveryInFlight || this.snapshot.role !== 'driver') return;
    const due = Date.now() - this.lastDiscoverAt >= DISCOVER_MIN_INTERVAL_MS;
    if (!due && this.neighbors.size === 0) return;
    this.discoveryInFlight = true;
    try {
      this.lastDiscoverAt = Date.now();
      await this.services.discoverServices(this.serviceId);
    } catch (error) {
      if (__DEV__) console.warn('[yardgate] discovery', errorMessage(error));
    } finally {
      this.discoveryInFlight = false;
    }
  }

  private onEvent = (event: ProtocolEvent) => {
    if (!this.protocol) return;
    this.getCallbacks().onProtocolEvent?.(event);
    switch (event.type) {
      case 'identity_ready':
        if (event.address) this.update({ localId: event.address });
        break;
      case 'neighbor_discovered':
        if (event.transport.toLowerCase() !== 'ble') return;
        this.neighbors.add(event.peer_id);
        this.update({ neighborCount: this.neighbors.size });
        if (this.snapshot.role === 'driver') void this.runDiscovery();
        break;
      case 'neighbor_lost':
        this.neighbors.delete(event.peer_id);
        this.update({ neighborCount: this.neighbors.size });
        break;
      case 'service_discovered':
        if (this.snapshot.role !== 'driver') return;
        {
          const provider = providerFromEvent(
            event,
            this.serviceId,
            this.snapshot.localId,
            Date.now(),
          );
          if (provider) {
            this.update({ providers: upsertProvider(this.snapshot.providers, provider) });
          }
        }
        break;
      case 'service_request_received':
        if (this.snapshot.role !== 'gate' || event.service_id !== this.serviceId) return;
        this.getCallbacks().onCheckInRequest?.({
          requestId: event.request_id,
          sender: event.sender,
          method: event.method,
          body: event.body,
        });
        break;
      case 'service_response_received':
        if (this.snapshot.role !== 'driver' || event.service_id !== this.serviceId) return;
        this.getCallbacks().onCheckInResponse?.({
          requestId: event.request_id,
          status: event.status,
          body: event.body,
          providerId: event.provider_peer_id,
        });
        break;
    }
  };

  private update(patch: Partial<YardSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
