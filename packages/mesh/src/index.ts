export { useNearbyRoom } from './useNearbyRoom';
export {
  cleanName,
  hostFromAnnouncement,
  pruneHosts,
  SERVICE_VERSION,
  upsertHost,
  type NearbyHost,
} from './hosts';
export { requestNearbyPermissions } from './permissions';
export { bluetoothMeshProtocolConfig, pause, poll, waitForBluetooth } from './runtime';

// For group mode: replicated documents live in the room's MLS group (space id = groupId).
export { DataStore } from '@offline-protocol/mesh-sdk';
export type { ProtocolEvent } from '@offline-protocol/mesh-sdk';
