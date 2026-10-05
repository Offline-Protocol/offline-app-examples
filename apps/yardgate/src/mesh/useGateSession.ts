import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GateSession, type YardCallbacks } from './gateSession';

export function useGateSession(appId: string, callbacks: YardCallbacks) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const [session] = useState(() => new GateSession(appId, () => latest.current));

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
    submitCheckIn: session.submitCheckIn,
    respondToCheckIn: session.respondToCheckIn,
  };
}
