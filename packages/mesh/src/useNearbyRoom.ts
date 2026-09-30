import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NearbyRoom, type RoomCallbacks, type RoomOptions } from './room';

/**
 * One NearbyRoom for the lifetime of the component, as reactive state plus actions.
 * Options are read once; callbacks always see their latest version. Leaves on unmount.
 */
export function useNearbyRoom(options: RoomOptions & RoomCallbacks) {
  const latest = useRef(options);
  latest.current = options;
  const [room] = useState(() => new NearbyRoom(options, () => latest.current));

  useEffect(
    () => () => {
      void room.leave();
    },
    [room],
  );

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
