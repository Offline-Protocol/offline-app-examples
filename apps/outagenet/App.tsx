import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby } from '@offline-app-examples/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ingestToHq, unsyncedOperationIds } from './src/domain/hq';
import {
  commandReducer,
  emptyCommand,
  emptyField,
  fieldReducer,
  newOperationId,
  parseMessage,
  snapshotOf,
  pendingResend,
  type FieldRecord,
  type HandoffRecord,
  type Sector,
  type StatusRecord,
} from './src/domain/ops';
import {
  loadPersisted,
  savePersisted,
  sanitizeCommand,
  sanitizeField,
} from './src/services/persist';
import { CommandScreen } from './src/ui/CommandScreen';
import { FieldScreen } from './src/ui/FieldScreen';
import { OutageHero } from './src/ui/illustrations';

const APP_ID = 'outagenet';
const RESEND_MS = 8_000;

export default function App() {
  const [name, setName] = useState('');
  const [postName, setPostName] = useState('');
  const [command, setCommand] = useState(emptyCommand);
  const [field, setField] = useState(emptyField);
  const [hqStoredIds, setHqStoredIds] = useState<Set<string>>(new Set());
  const commandRef = useRef(command);
  const fieldRef = useRef(field);
  const hqRef = useRef(hqStoredIds);
  const pendingPayloads = useRef<Map<string, FieldRecord>>(new Map());

  commandRef.current = command;
  fieldRef.current = field;
  hqRef.current = hqStoredIds;

  useEffect(() => {
    loadPersisted().then((p) => {
      if (p.command) setCommand(sanitizeCommand(p.command));
      if (p.field) setField(sanitizeField(p.field));
      if (p.hqStoredIds) setHqStoredIds(new Set(p.hqStoredIds));
    });
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      command: commandRef.current,
      field: fieldRef.current,
      hqStoredIds: [...hqRef.current],
    });
  }, []);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => {
      const msg = parseMessage(data);
      if (!msg) return;

      if (room.role === 'host') {
        if (msg.type === 'propose') {
          const next = commandReducer(commandRef.current, {
            type: 'propose',
            record: msg.record,
          });
          if (next !== commandRef.current) {
            commandRef.current = next;
            setCommand(next);
            broadcast(snapshotOf(next));
            persist();
          }
        } else if (msg.type === 'accept_handoff') {
          const next = commandReducer(commandRef.current, msg);
          if (next !== commandRef.current) {
            commandRef.current = next;
            setCommand(next);
            broadcast(snapshotOf(next));
            persist();
          }
        }
      } else if (msg.type === 'snapshot') {
        updateField(msg);
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(commandRef.current));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  function updateField(action: {
    type: 'snapshot';
    rev: number;
    records: FieldRecord[];
    syncedIds: string[];
    hqDuplicatesDropped: number;
  }) {
    fieldRef.current = fieldReducer(fieldRef.current, action);
    setField(fieldRef.current);
    const known = new Set(action.records.map((r) => r.operationId));
    for (const id of known) pendingPayloads.current.delete(id);
    persist();
  }

  function propose(record: FieldRecord) {
    pendingPayloads.current.set(record.operationId, record);
    fieldRef.current = fieldReducer(fieldRef.current, {
      type: 'queue',
      operationId: record.operationId,
    });
    setField(fieldRef.current);
    broadcast({ type: 'propose', record });
    persist();
  }

  function resend() {
    const ids = pendingResend(fieldRef.current);
    for (const id of ids) {
      const record = pendingPayloads.current.get(id);
      if (record) broadcast({ type: 'propose', record });
    }
  }

  function postStatus(sector: Sector, text: string) {
    if (!text) return;
    const record: StatusRecord = {
      kind: 'status',
      operationId: newOperationId('status'),
      sector,
      text: text.slice(0, 200),
      authorId: room.localId,
      authorName: name.trim().slice(0, 30) || 'Field',
      createdAt: Date.now(),
    };
    if (room.role === 'host') {
      const next = commandReducer(commandRef.current, { type: 'propose', record });
      commandRef.current = next;
      setCommand(next);
      broadcast(snapshotOf(next));
      persist();
    } else propose(record);
  }

  function postHandoff(sector: Sector, note: string) {
    if (!note) return;
    const record: HandoffRecord = {
      kind: 'handoff',
      operationId: newOperationId('handoff'),
      sector,
      note: note.slice(0, 200),
      authorId: room.localId,
      authorName: name.trim().slice(0, 30) || 'Field',
      createdAt: Date.now(),
      state: 'pending',
    };
    if (room.role === 'host') {
      const next = commandReducer(commandRef.current, { type: 'propose', record });
      commandRef.current = next;
      setCommand(next);
      broadcast(snapshotOf(next));
      persist();
    } else propose(record);
  }

  function acceptHandoff(operationId: string) {
    const msg = {
      type: 'accept_handoff' as const,
      operationId,
      acceptorId: room.localId,
      acceptorName: name.trim().slice(0, 30) || 'Field',
      at: Date.now(),
    };
    if (room.role === 'host') {
      const next = commandReducer(commandRef.current, msg);
      commandRef.current = next;
      setCommand(next);
      broadcast(snapshotOf(next));
      persist();
    } else broadcast(msg);
  }

  function syncToHq() {
    const ids = unsyncedOperationIds(
      commandRef.current.records,
      commandRef.current.syncedIds,
    );
    if (ids.length === 0) {
      const retry = commandRef.current.records.map((r) => r.operationId);
      const { next, result } = ingestToHq(hqRef.current, retry);
      hqRef.current = next;
      setHqStoredIds(next);
      const cmd = commandReducer(commandRef.current, {
        type: 'mark_synced',
        operationIds: [],
        duplicatesDropped: result.duplicatesDropped,
      });
      commandRef.current = cmd;
      setCommand(cmd);
      broadcast(snapshotOf(cmd));
      persist();
      return;
    }
    const { next, result } = ingestToHq(hqRef.current, ids);
    hqRef.current = next;
    setHqStoredIds(next);
    const cmd = commandReducer(commandRef.current, {
      type: 'mark_synced',
      operationIds: result.accepted,
      duplicatesDropped: result.duplicatesDropped,
    });
    commandRef.current = cmd;
    setCommand(cmd);
    broadcast(snapshotOf(cmd));
    persist();
  }

  const isField = room.status === 'connected';
  useEffect(() => {
    if (!isField) return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isField]);

  function start(action: () => void) {
    pendingPayloads.current.clear();
    action();
  }

  function openPost() {
    const label = name.trim() || 'Command Post';
    setPostName(label);
    room.host(label);
  }

  const me = {
    id: room.localId || 'me',
    name:
      room.role === 'host'
        ? postName || name.trim() || 'Command'
        : name.trim() || 'Field',
  };

  let screen: React.ReactNode;
  if (room.status === 'hosting') {
    screen = (
      <CommandScreen
        postName={postName || 'Command Post'}
        command={command}
        hqTotal={hqStoredIds.size}
        people={[me, ...room.peers]}
        onSyncHq={syncToHq}
        onAcceptHandoff={acceptHandoff}
        onLeave={room.leave}
      />
    );
  } else if (room.status === 'connected') {
    const title =
      room.peers[0]?.name ??
      room.hosts.find((h) => h.id === room.hostId)?.name ??
      'Command Post';
    screen = (
      <FieldScreen
        postName={title}
        me={me}
        field={field}
        people={[me, ...room.peers]}
        reconnecting={room.peers.length === 0}
        onStatus={postStatus}
        onHandoff={postHandoff}
        onAccept={acceptHandoff}
        onLeave={room.leave}
      />
    );
  } else {
    screen = (
      <NearbyLobby
        title="OutageNet"
        tagline="Coordinate field teams over Bluetooth when towers are down. Open the command post on one phone; field units join nearby."
        illustration={<OutageHero size={180} />}
        accentColor="#0ea5e9"
        status={room.status}
        error={room.error}
        hosts={room.hosts}
        peers={room.peers}
        joiningId={room.hostId ?? undefined}
        name={name}
        onNameChange={setName}
        onHost={() => start(openPost)}
        onDiscover={() => start(room.discover)}
        onJoin={(host) => {
          setPostName(host.name);
          room.join(host.id, name.trim() || 'Field');
        }}
        onCancel={room.leave}
        labels={{
          host: 'Open command post',
          join: 'Join as field unit',
          namePlaceholder: 'Your name or post name',
          scanningTitle: 'Nearby command posts',
          scanningHint: 'Keep both phones close. Bluetooth mesh only.',
          starting: 'Starting…',
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {screen}
    </SafeAreaProvider>
  );
}
