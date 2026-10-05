import OfflineProtocol, { type ProtocolConfig } from '@offline-protocol/mesh-sdk';
import { Platform } from 'react-native';

export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(
  read: () => Promise<T | null | undefined>,
  timeoutMs: number,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read().catch(() => null);
    if (value) return value;
    await pause(500);
  }
  return null;
}

/** iOS reports Bluetooth as off briefly after start; wait before failing. */
export async function waitForBluetooth(p: OfflineProtocol): Promise<boolean> {
  if (await p.isBluetoothEnabled()) return true;
  if (Platform.OS === 'android' && (await p.requestEnableBluetooth().catch(() => false))) return true;
  return (await poll(async () => ((await p.isBluetoothEnabled()) ? true : null), 10_000)) === true;
}

/** Bluetooth-only mesh config; `relayHops` > 1 enables store-and-forward for multi-hop demos. */
export function bluetoothMeshProtocolConfig(appId: string, relayHops: number): ProtocolConfig {
  const hops = Math.max(1, relayHops);
  const relay = hops > 1;
  return {
    appId,
    profile: 'default',
    transports: {
      ble: { enabled: true },
      wifiDirect: { enabled: false },
      internet: { enabled: false },
      nostr: { enabled: false },
      reticulum: { enabled: false },
    },
    network: { initialTtl: hops },
    meshRelay: { maxTtl: hops, denseMaxTtl: hops },
    relay: relay
      ? { allowRelay: true, relayPriority: 'always' }
      : { allowRelay: false, relayPriority: 'never' },
    group: { relayEnabled: false, relayBroadcastEnabled: false },
    encryption: { enabled: true, autoKeyExchange: true, storePending: true },
    reliability: {
      ack: { defaultTimeoutMs: relay ? 12_000 : 10_000 },
      retry: {
        maxRetries: 8,
        initialDelayMs: relay ? 400 : 300,
        maxDelayMs: relay ? 6000 : 5000,
        outboxMaxLifetimeMs: 180_000,
        pendingMessageMaxLifetimeMs: 180_000,
      },
    },
  };
}
