import { useMeshRelay, useNearbyRoom } from '@offline-app-examples/mesh';
import { Text } from '@offline-app-examples/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ingestToFarm, unsyncedReadingIds } from '../domain/farm';
import {
  buildReadingProposal,
  emptyField,
  emptyOffice,
  fieldReducer,
  officeReducer,
  parseMeshMessage,
  pendingResend,
  snapshotOf,
  type ReadingRecord,
} from '../domain/ledger';
import { DEMO_FARM, type DemoReadingTemplate } from '../domain/plots';
import { loadPersisted, savePersisted, sanitizeField, sanitizeOffice } from '../services/persist';
import { FieldCollectorScreen } from '../ui/FieldCollectorScreen';
import { OfficeEdgeScreen } from '../ui/OfficeEdgeScreen';
import { RelayScreen } from '../ui/RelayScreen';

const APP_ID = 'agrimesh';
const RESEND_MS = 8_000;

export type AgriRole = 'office' | 'field' | 'relay';

export function AgriFlow({
  role,
  displayName,
  onLeave,
}: {
  role: AgriRole;
  displayName: string;
  onLeave: () => void;
}) {
  const [office, setOffice] = useState(emptyOffice);
  const [field, setField] = useState(emptyField);
  const [farmStored, setFarmStored] = useState<Set<string>>(new Set());
  const officeRef = useRef(office);
  const fieldRef = useRef(field);
  const farmRef = useRef(farmStored);
  const pendingRecords = useRef<Map<string, ReadingRecord>>(new Map());

  officeRef.current = office;
  fieldRef.current = field;
  farmRef.current = farmStored;

  useEffect(() => {
    loadPersisted().then((p) => {
      if (p.office) setOffice(sanitizeOffice(p.office));
      if (p.field) setField(sanitizeField(p.field));
      if (p.farmStoredReadingIds) setFarmStored(new Set(p.farmStoredReadingIds));
    });
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      office: officeRef.current,
      field: fieldRef.current,
      farmStoredReadingIds: [...farmRef.current],
    });
  }, []);

  const relay = useMeshRelay(APP_ID);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (_from, data) => {
      const msg = parseMeshMessage(data);
      if (!msg) return;

      if (room.role === 'host') {
        if (msg.type === 'propose') {
          if (officeRef.current.readings.some((r) => r.readingId === msg.record.readingId)) {
            return;
          }
          const next = officeReducer(officeRef.current, { type: 'propose', record: msg.record });
          if (next !== officeRef.current) {
            officeRef.current = next;
            setOffice(next);
            broadcast(snapshotOf(next));
            persist();
          }
        }
      } else if (msg.type === 'snapshot') {
        fieldRef.current = fieldReducer(fieldRef.current, {
          type: 'snapshot',
          rev: msg.rev,
          readings: msg.readings,
          syncedReadingIds: msg.syncedReadingIds,
          farmDuplicatesDropped: msg.farmDuplicatesDropped,
        });
        for (const [readingId] of pendingRecords.current.entries()) {
          const confirmed = msg.readings.find((r) => r.readingId === readingId);
          if (confirmed) {
            fieldRef.current = fieldReducer(fieldRef.current, {
              type: 'logged',
              record: confirmed,
            });
            pendingRecords.current.delete(readingId);
          }
        }
        setField(fieldRef.current);
        persist();
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(officeRef.current));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  function resend() {
    for (const id of pendingResend(fieldRef.current)) {
      const record = pendingRecords.current.get(id);
      if (record) broadcast({ type: 'propose', record });
    }
  }

  useEffect(() => {
    if (role === 'relay') {
      void relay.start(displayName || 'Field relay');
      return () => {
        void relay.leave();
      };
    }
    if (role === 'office') {
      void room.host(displayName || 'Farm office edge');
    } else if (role === 'field') {
      void room.discover();
    }
    return () => {
      void room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'field' || room.status !== 'discovering') return;
    const host = room.hosts[0];
    if (host) void room.join(host.id, displayName || 'Field collector');
  }, [role, room.status, room.hosts, displayName, room]);

  useEffect(() => {
    if (role !== 'field' || room.status !== 'connected') return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, room.status]);

  function syncFarm() {
    const ids = unsyncedReadingIds(officeRef.current.readings, officeRef.current.syncedReadingIds);
    const batch = ids.length > 0 ? ids : officeRef.current.readings.map((r) => r.readingId);
    const { next, result } = ingestToFarm(farmRef.current, batch);
    farmRef.current = next;
    setFarmStored(next);
    const officeNext = officeReducer(officeRef.current, {
      type: 'mark_synced',
      readingIds: result.accepted,
      duplicatesDropped: result.duplicatesDropped,
    });
    officeRef.current = officeNext;
    setOffice(officeNext);
    broadcast(snapshotOf(officeNext));
    persist();
  }

  function logReading(template: DemoReadingTemplate) {
    const built = buildReadingProposal({
      plotId: template.plotId,
      kind: template.kind,
      value: template.value,
      unit: template.unit,
      farmId: DEMO_FARM.farmId,
      collectorId: room.localId || 'field',
      collectorName: displayName,
      now: Date.now(),
    });

    if ('error' in built) {
      console.warn(built.error);
      return;
    }

    if (room.role === 'host') {
      const next = officeReducer(officeRef.current, { type: 'propose', record: built.record });
      officeRef.current = next;
      setOffice(next);
      broadcast(snapshotOf(next));
      persist();
      return;
    }

    pendingRecords.current.set(built.record.readingId, built.record);
    fieldRef.current = fieldReducer(fieldRef.current, {
      type: 'queue',
      readingId: built.record.readingId,
    });
    fieldRef.current = fieldReducer(fieldRef.current, {
      type: 'logged',
      record: built.record,
    });
    setField(fieldRef.current);
    broadcast({ type: 'propose', record: built.record });
    persist();
  }

  const me = { id: room.localId || relay.localId || 'me', name: displayName || 'AgriMesh' };

  if (role === 'relay') {
    return (
      <RelayScreen
        relayName={displayName || 'Field relay'}
        neighbors={relay.neighborCount}
        me={me}
        hint="Place between the field collector and the office-edge phone when the plot is beyond direct Bluetooth range."
        onLeave={() => {
          void relay.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'office' && room.status === 'hosting') {
    return (
      <OfficeEdgeScreen
        officeName={displayName}
        office={office}
        farmTotal={farmStored.size}
        people={room.peers}
        onSyncFarm={syncFarm}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
      />
    );
  }

  if (role === 'field' && (room.status === 'connected' || room.status === 'joining')) {
    return (
      <FieldCollectorScreen
        collectorName={displayName}
        field={field}
        people={room.peers}
        onLog={logReading}
        onLeave={() => {
          void room.leave();
          onLeave();
        }}
        me={me}
      />
    );
  }

  const status =
    role === 'office'
      ? room.status
      : role === 'field'
        ? room.status
        : relay.status;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="font-serif text-center text-2xl">Connecting…</Text>
        <Text className="text-muted-foreground mt-2 text-center text-sm">
          Turn on Bluetooth and keep devices in range{role === 'field' ? ' of the office edge host' : ''}.
          Status: {status}
        </Text>
      </View>
    </SafeAreaView>
  );
}
