export { NearbyRoom } from './room';
export type { RoomOptions, RoomPeer, RoomSnapshot, RoomStatus } from './room';
export type { NearbyHost } from './hosts';
export { useNearbyRoom } from './useNearbyRoom';
export type { UseNearbyRoomOptions } from './useNearbyRoom';

// For group mode: replicated documents live in the room's MLS group (space id = groupId).
export { DataStore } from '@offline-protocol/mesh-sdk';
export type { DataValue, ProtocolEvent } from '@offline-protocol/mesh-sdk';
