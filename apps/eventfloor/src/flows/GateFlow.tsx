import { useMeshRelay, useNearbyRoom } from '@offline-app-examples/mesh';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  admissionByTicket,
  buildScanProposal,
  emptyHost,
  emptyScanner,
  hostReducer,
  parseGateMessage,
  pendingResend,
  scannerReducer,
  snapshotOf,
  type AdmissionRecord,
} from '../domain/admission';
import { ingestToPlatform, unsyncedScanIds } from '../domain/platform';
import { DEMO_EVENT } from '../domain/tickets';
import { loadPersisted, savePersisted, sanitizeHost, sanitizeScanner } from '../services/persist';
import { ConnectingScreen } from '../ui/common';
import { HostGateScreen } from '../ui/HostGateScreen';
import { RelayScreen } from '../ui/RelayScreen';
import { ScannerGateScreen } from '../ui/ScannerGateScreen';

const APP_ID = 'eventfloor';
const RESEND_MS = 8_000;

export type GateRole = 'host' | 'scanner' | 'relay';

export function GateFlow({
  role,
  gateName,
  onLeave,
}: {
  role: GateRole;
  gateName: string;
  onLeave: () => void;
}) {
  const [host, setHost] = useState(emptyHost);
  const [scanner, setScanner] = useState(emptyScanner);
  const [platformStored, setPlatformStored] = useState<Set<string>>(new Set());
  const hostRef = useRef(host);
  const scannerRef = useRef(scanner);
  const platformRef = useRef(platformStored);
  const pendingRecords = useRef<Map<string, AdmissionRecord>>(new Map());

  hostRef.current = host;
  scannerRef.current = scanner;
  platformRef.current = platformStored;

  useEffect(() => {
    loadPersisted().then((p) => {
      if (p.host) setHost(sanitizeHost(p.host));
      if (p.scanner) setScanner(sanitizeScanner(p.scanner));
      if (p.platformStoredScanIds) setPlatformStored(new Set(p.platformStoredScanIds));
    });
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      host: hostRef.current,
      scanner: scannerRef.current,
      platformStoredScanIds: [...platformRef.current],
    });
  }, []);

  const relay = useMeshRelay(APP_ID);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => {
      const msg = parseGateMessage(data);
      if (!msg) return;

      if (room.role === 'host') {
        if (msg.type === 'propose') {
          const existing = admissionByTicket(hostRef.current.admissions, msg.record.ticketId);
          if (existing) return;
          const next = hostReducer(hostRef.current, { type: 'propose', record: msg.record });
          if (next !== hostRef.current) {
            hostRef.current = next;
            setHost(next);
            broadcast(snapshotOf(next));
            persist();
          }
        }
      } else if (msg.type === 'snapshot') {
        scannerRef.current = scannerReducer(scannerRef.current, {
          type: 'snapshot',
          rev: msg.rev,
          admissions: msg.admissions,
          syncedScanIds: msg.syncedScanIds,
          platformDuplicatesDropped: msg.platformDuplicatesDropped,
        });
        for (const [scanId] of pendingRecords.current.entries()) {
          const confirmed = msg.admissions.find((a) => a.scanId === scanId);
          if (confirmed) {
            scannerRef.current = scannerReducer(scannerRef.current, {
              type: 'scan_result',
              result: { outcome: 'admitted', record: confirmed },
            });
            pendingRecords.current.delete(scanId);
          }
        }
        setScanner(scannerRef.current);
        persist();
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(hostRef.current));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  function resend() {
    for (const id of pendingResend(scannerRef.current)) {
      const record = pendingRecords.current.get(id);
      if (record) broadcast({ type: 'propose', record });
    }
  }

  useEffect(() => {
    if (role === 'relay') {
      void relay.start(gateName || 'Gate relay');
      return () => {
        void relay.leave();
      };
    }
    if (role === 'host') {
      void room.host(gateName || 'Lead gate');
    } else if (role === 'scanner') {
      void room.discover();
    }
    return () => {
      void room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'scanner' || room.status !== 'discovering') return;
    const lead = room.hosts[0];
    if (lead) void room.join(lead.id, gateName || 'Gate');
  }, [role, room.status, room.hosts, gateName, room]);

  useEffect(() => {
    if (role !== 'scanner' || room.status !== 'connected') return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, room.status]);

  function syncPlatform() {
    const ids = unsyncedScanIds(hostRef.current.admissions, hostRef.current.syncedScanIds);
    const batch = ids.length > 0 ? ids : hostRef.current.admissions.map((a) => a.scanId);
    const { next, result } = ingestToPlatform(platformRef.current, batch);
    platformRef.current = next;
    setPlatformStored(next);
    const hostNext = hostReducer(hostRef.current, {
      type: 'mark_synced',
      scanIds: result.accepted,
      duplicatesDropped: result.duplicatesDropped,
    });
    hostRef.current = hostNext;
    setHost(hostNext);
    broadcast(snapshotOf(hostNext));
    persist();
  }

  function scanTicket(ticketId: string) {
    const existing = admissionByTicket(scannerRef.current.admissions, ticketId);
    if (existing) {
      scannerRef.current = scannerReducer(scannerRef.current, {
        type: 'scan_result',
        result: { outcome: 'already_used', record: existing },
      });
      setScanner(scannerRef.current);
      return;
    }

    const built = buildScanProposal({
      ticketId,
      eventId: DEMO_EVENT.eventId,
      gateId: room.localId || 'scanner',
      gateName,
      deviceId: room.localId || 'scanner',
      now: Date.now(),
    });

    if ('error' in built) {
      scannerRef.current = scannerReducer(scannerRef.current, {
        type: 'scan_result',
        result: { outcome: 'unknown_ticket', ticketId: ticketId.trim().toUpperCase() },
      });
      setScanner(scannerRef.current);
      return;
    }

    if (room.role === 'host') {
      const next = hostReducer(hostRef.current, { type: 'propose', record: built.record });
      hostRef.current = next;
      setHost(next);
      broadcast(snapshotOf(next));
      scannerRef.current = scannerReducer(scannerRef.current, {
        type: 'scan_result',
        result: { outcome: 'admitted', record: built.record },
      });
      setScanner(scannerRef.current);
      persist();
      return;
    }

    pendingRecords.current.set(built.record.scanId, built.record);
    scannerRef.current = scannerReducer(scannerRef.current, {
      type: 'queue',
      scanId: built.record.scanId,
    });
    setScanner(scannerRef.current);
    broadcast({ type: 'propose', record: built.record });
    persist();
  }

  const me = { id: room.localId || relay.localId || 'me', name: gateName || 'Gate' };

  if (role === 'relay') {
    return (
      <RelayScreen
        relayName={gateName || 'Gate relay'}
        neighbors={relay.neighborCount}
        me={me}
        hint="Place between gate scanners when entrances are farther apart than direct Bluetooth range."
        onLeave={() => {
          void relay.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'host' && room.status === 'hosting') {
    return (
      <HostGateScreen
        gateName={gateName}
        host={host}
        platformTotal={platformStored.size}
        people={room.peers}
        onSyncPlatform={syncPlatform}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'scanner' && (room.status === 'connected' || room.status === 'joining')) {
    return (
      <ScannerGateScreen
        gateName={gateName}
        scanner={scanner}
        people={room.peers}
        onScan={scanTicket}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
        me={me}
      />
    );
  }

  const leaveSession = () => {
    void room.leave();
    onLeave();
  };

  let message = 'Turn on Bluetooth and keep devices in range.';
  if (role === 'host') {
    message = 'Starting the lead scanner and advertising over Bluetooth…';
  } else if (role === 'scanner') {
    if (room.status === 'discovering' && room.hosts.length === 0) {
      message = 'Looking for the lead scanner nearby. Start the lead gate on another phone first.';
    } else if (room.status === 'joining') {
      message = 'Joining the lead scanner…';
    } else {
      message = 'Connecting to the lead scanner…';
    }
  }

  return (
    <ConnectingScreen
      message={message}
      error={room.status === 'error' ? room.error : undefined}
      onLeave={leaveSession}
    />
  );
}
