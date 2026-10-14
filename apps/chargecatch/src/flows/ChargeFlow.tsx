import { useNearbyRoom } from '@offline-app-examples/mesh';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CHARGER_IDS, DEMO_SITE, type ChargerId } from '../domain/cards';
import { ingestToCms, unsyncedSessionIds } from '../domain/cms';
import {
  buildSession,
  chargerHasFault,
  chargerReducer,
  emptyCharger,
  emptyHub,
  hubReducer,
  parseMeshMessage,
  pendingResend,
  snapshotOf,
  type ChargeSession,
} from '../domain/sessions';
import { loadPersisted, savePersisted, sanitizeCharger, sanitizeHub } from '../services/persist';
import { ChargerScreen } from '../ui/ChargerScreen';
import { HubScreen } from '../ui/HubScreen';
import { TechScreen } from '../ui/TechScreen';
import { ConnectingScreen } from '../ui/common';

const APP_ID = 'chargecatch';
const RESEND_MS = 8_000;

export type ChargeRole = 'hub' | 'charger' | 'tech';

export function ChargeFlow({
  role,
  displayName,
  chargerId,
  onLeave,
}: {
  role: ChargeRole;
  displayName: string;
  chargerId: ChargerId;
  onLeave: () => void;
}) {
  const [hub, setHub] = useState(emptyHub);
  const [charger, setCharger] = useState(emptyCharger);
  const [cmsStored, setCmsStored] = useState<Set<string>>(new Set());
  const [activeCharge, setActiveCharge] = useState<{
    cardId: string;
    startedAt: number;
  } | null>(null);

  const hubRef = useRef(hub);
  const chargerRef = useRef(charger);
  const cmsRef = useRef(cmsStored);
  const pendingRecords = useRef<Map<string, ChargeSession>>(new Map());

  hubRef.current = hub;
  chargerRef.current = charger;
  cmsRef.current = cmsStored;

  useEffect(() => {
    loadPersisted().then((p) => {
      if (p.hub) setHub(sanitizeHub(p.hub));
      if (p.charger) setCharger(sanitizeCharger(p.charger));
      if (p.cmsStoredSessionIds) setCmsStored(new Set(p.cmsStoredSessionIds));
    });
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      hub: hubRef.current,
      charger: chargerRef.current,
      cmsStoredSessionIds: [...cmsRef.current],
    });
  }, []);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => {
      const msg = parseMeshMessage(data);
      if (!msg) return;

      if (room.role === 'host') {
        if (msg.type === 'propose') {
          if (hubRef.current.sessions.some((s) => s.sessionId === msg.record.sessionId)) return;
          const next = hubReducer(hubRef.current, { type: 'propose', record: msg.record });
          if (next !== hubRef.current) {
            hubRef.current = next;
            setHub(next);
            broadcast(snapshotOf(next));
            persist();
          }
        } else if (msg.type === 'clear_fault') {
          if (!CHARGER_IDS.includes(msg.chargerId as ChargerId)) return;
          const next = hubReducer(hubRef.current, { type: 'clear_fault', chargerId: msg.chargerId });
          hubRef.current = next;
          setHub(next);
          broadcast(snapshotOf(next));
          persist();
        }
      } else if (msg.type === 'snapshot') {
        chargerRef.current = chargerReducer(chargerRef.current, {
          type: 'snapshot',
          rev: msg.rev,
          sessions: msg.sessions,
          syncedSessionIds: msg.syncedSessionIds,
          cmsDuplicatesDropped: msg.cmsDuplicatesDropped,
          chargerFaults: msg.chargerFaults,
          headOfficeOnline: msg.headOfficeOnline,
        });
        for (const [sessionId] of pendingRecords.current.entries()) {
          const confirmed = msg.sessions.find((s) => s.sessionId === sessionId);
          if (confirmed) {
            chargerRef.current = chargerReducer(chargerRef.current, {
              type: 'completed',
              record: confirmed,
            });
            pendingRecords.current.delete(sessionId);
          }
        }
        setCharger(chargerRef.current);
        persist();
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(hubRef.current));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  function resend() {
    for (const id of pendingResend(chargerRef.current)) {
      const record = pendingRecords.current.get(id);
      if (record) broadcast({ type: 'propose', record });
    }
  }

  useEffect(() => {
    if (role === 'hub') {
      void room.host(displayName || 'Site hub');
    } else {
      void room.discover();
    }
    return () => {
      void room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role === 'hub' || room.status !== 'discovering') return;
    const host = room.hosts[0];
    if (host) void room.join(host.id, displayName || 'Device');
  }, [role, room.status, room.hosts, displayName, room]);

  useEffect(() => {
    if (role !== 'charger' || room.status !== 'connected') return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, room.status]);

  function syncCms() {
    const ids = unsyncedSessionIds(hubRef.current.sessions, hubRef.current.syncedSessionIds);
    const batch = ids.length > 0 ? ids : hubRef.current.sessions.map((s) => s.sessionId);
    const { next, result } = ingestToCms(cmsRef.current, batch);
    cmsRef.current = next;
    setCmsStored(next);
    const hubNext = hubReducer(hubRef.current, {
      type: 'mark_synced',
      sessionIds: result.accepted,
      duplicatesDropped: result.duplicatesDropped,
    });
    hubRef.current = hubNext;
    setHub(hubNext);
    broadcast(snapshotOf(hubNext));
    persist();
  }

  function setHeadOfficeOnline(online: boolean) {
    const hubNext = hubReducer(hubRef.current, { type: 'set_head_office_online', online });
    hubRef.current = hubNext;
    setHub(hubNext);
    broadcast(snapshotOf(hubNext));
    persist();
  }

  function setChargerFault(chargerId: string, fault: boolean) {
    const hubNext = hubReducer(hubRef.current, { type: 'set_fault', chargerId, fault });
    hubRef.current = hubNext;
    setHub(hubNext);
    broadcast(snapshotOf(hubNext));
    persist();
  }

  function clearFaultRemote(chargerId: string) {
    const hostId = room.hostId;
    if (hostId) {
      send(hostId, { type: 'clear_fault', chargerId }).catch(() =>
        broadcast({ type: 'clear_fault', chargerId }),
      );
    }
  }

  function proposeSession(record: ChargeSession) {
    const fault = chargerHasFault(hubRef.current, record.chargerId);
    const canMesh =
      role === 'charger' &&
      room.status === 'connected' &&
      !fault &&
      !chargerHasFault(chargerRef.current, record.chargerId);

    if (canMesh && room.role === 'member') {
      pendingRecords.current.set(record.sessionId, record);
      chargerRef.current = chargerReducer(chargerRef.current, {
        type: 'queue',
        sessionId: record.sessionId,
      });
      setCharger(chargerRef.current);
      broadcast({ type: 'propose', record });
      persist();
      return;
    }

    pendingRecords.current.set(record.sessionId, record);
    chargerRef.current = chargerReducer(chargerRef.current, {
      type: 'queue',
      sessionId: record.sessionId,
    });
    setCharger(chargerRef.current);
    persist();
  }

  function startCharge(cardId: string) {
    if (activeCharge) return;
    setActiveCharge({ cardId, startedAt: Date.now() });
  }

  function stopCharge(energyKwh: number) {
    if (!activeCharge) return;
    const built = buildSession({
      siteId: DEMO_SITE.siteId,
      chargerId,
      chargerLabel: displayName,
      cardId: activeCharge.cardId,
      energyKwh,
      startedAt: activeCharge.startedAt,
      endedAt: Date.now(),
    });
    setActiveCharge(null);
    if ('error' in built) return;
    proposeSession(built.record);
    chargerRef.current = { ...chargerRef.current, lastSession: built.record };
    setCharger(chargerRef.current);
    persist();
  }

  const me = { id: room.localId || 'me', name: displayName || 'Device' };

  if (role === 'hub' && room.status === 'hosting') {
    return (
      <HubScreen
        siteName={DEMO_SITE.name}
        hub={hub}
        cmsTotal={cmsStored.size}
        people={room.peers}
        me={me}
        onSyncCms={syncCms}
        onHeadOfficeOnline={setHeadOfficeOnline}
        onSetFault={setChargerFault}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'charger' && (room.status === 'connected' || room.status === 'joining')) {
    return (
      <ChargerScreen
        chargerId={chargerId}
        label={displayName}
        charger={charger}
        activeCharge={activeCharge}
        people={room.peers}
        me={me}
        onStart={startCharge}
        onStop={stopCharge}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'tech' && (room.status === 'connected' || room.status === 'joining')) {
    return (
      <TechScreen
        label={displayName}
        hubView={charger}
        people={room.peers}
        me={me}
        onClearFault={clearFaultRemote}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  const leaveSession = () => {
    void room.leave();
    onLeave();
  };

  let message = 'Turn on Bluetooth and keep devices in range.';
  if (role === 'hub') {
    message = 'Starting the site hub — chargers and tech will join here.';
  } else if (room.status === 'discovering' && room.hosts.length === 0) {
    message = 'Looking for the site hub. Start the hub on another phone first.';
  } else if (room.status === 'joining') {
    message = 'Joining the site hub…';
  }

  return <ConnectingScreen message={message} onLeave={leaveSession} />;
}
