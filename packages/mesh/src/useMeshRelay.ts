import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MeshRelaySession, type RelayCallbacks } from './relaySession';

export function useMeshRelay(appId: string, callbacks: RelayCallbacks = {}) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const [session] = useState(() => new MeshRelaySession(appId, () => latest.current));

  useEffect(
    () => () => {
      void session.leave();
    },
    [session],
  );

  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);

  return {
    ...state,
    start: session.start,
    leave: session.leave,
  };
}
