import type { ProtocolEvent } from '@offline-protocol/mesh-sdk';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NearbyRoom, type RoomOptions, type RoomPeer } from './room';

export type UseNearbyRoomOptions = RoomOptions & {
  onMessage?: (from: string, data: unknown) => void;
  onPeerJoined?: (peer: RoomPeer) => void;
  onPeerLeft?: (peer: RoomPeer) => void;
  /** Every raw SDK event, e.g. `data_changed` for DataStore. */
  onProtocolEvent?: (event: ProtocolEvent) => void;
};

/**
 * One NearbyRoom for the lifetime of the component, as reactive state plus actions.
 * Options are read once; callbacks always see their latest version. Leaves on unmount.
 */
export function useNearbyRoom(options: UseNearbyRoomOptions) {
  const [room] = useState(() => new NearbyRoom(options));
  const callbacks = useRef(options);
  callbacks.current = options;

  useEffect(() => {
    const unsubscribe = [
      room.on('message', (from, data) => callbacks.current.onMessage?.(from, data)),
      room.on('peerJoined', peer => callbacks.current.onPeerJoined?.(peer)),
      room.on('peerLeft', peer => callbacks.current.onPeerLeft?.(peer)),
      room.on('protocolEvent', event => callbacks.current.onProtocolEvent?.(event)),
    ];
    return () => {
      unsubscribe.forEach(off => off());
      void room.leave();
    };
  }, [room]);

  const state = useSyncExternalStore(room.subscribe, room.getSnapshot);

  return {
    ...state,
    host: room.host,
    discover: room.discover,
    join: room.join,
    send: room.send,
    broadcast: room.broadcast,
    leave: room.leave,
  };
}
