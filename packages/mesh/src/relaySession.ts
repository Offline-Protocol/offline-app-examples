import { cleanName } from './hosts';
import { requestNearbyPermissions } from './permissions';
import { bluetoothMeshProtocolConfig, pause, poll, waitForBluetooth } from './runtime';
import OfflineProtocol, { type ProtocolEvent } from '@offline-protocol/mesh-sdk';

export type RelayStatus = 'idle' | 'starting' | 'active' | 'error';

export type RelaySnapshot = {
  status: RelayStatus;
  error: string;
  localId: string;
  displayName: string;
  neighborCount: number;
};

export type RelayCallbacks = {
  onProtocolEvent?: (event: ProtocolEvent) => void;
};

const RELAY_HOPS = 3;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const IDLE: RelaySnapshot = {
  status: 'idle',
  error: '',
  localId: '',
  displayName: '',
  neighborCount: 0,
};

/** Bluetooth mesh relay only — forwards traffic, no app room or service registration. */
export class MeshRelaySession {
  private snapshot: RelaySnapshot = { ...IDLE };
  private listeners = new Set<() => void>();
  private protocol: OfflineProtocol | null = null;
  private generation = 0;
  private stopping: Promise<void> = Promise.resolve();
  private neighbors = new Set<string>();

  constructor(
    private readonly appId: string,
    private getCallbacks: () => RelayCallbacks,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RelaySnapshot => this.snapshot;

  start = async (displayName: string): Promise<void> => {
    if (this.snapshot.status !== 'idle' && this.snapshot.status !== 'error') return;
    const label = cleanName(displayName, 'Relay');
    this.update({ ...IDLE, status: 'starting', displayName: label });
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
      this.update({ localId, status: 'active' });
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  };

  leave = async (): Promise<void> => {
    this.stop();
    this.update({ ...IDLE });
    await this.stopping;
  };

  private fail(error: unknown) {
    if (__DEV__) console.warn(`[${this.appId}:relay]`, errorMessage(error));
    this.stop();
    this.update({ ...IDLE, status: 'error', error: errorMessage(error) });
  }

  private stop() {
    const p = this.protocol;
    this.protocol = null;
    ++this.generation;
    this.stopping = (async () => {
      if (p) await p.stop().catch(() => {});
    })();
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
        break;
      case 'neighbor_lost':
        this.neighbors.delete(event.peer_id);
        this.update({ neighborCount: this.neighbors.size });
        break;
    }
  };

  private update(patch: Partial<RelaySnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
