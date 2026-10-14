import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby } from '@offline-app-examples/ui';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  addHandoff,
  assign,
  assignmentText,
  awaitingYard,
  checkInText,
  DEMO_VEHICLES,
  newHandoffId,
  parseMessage,
  yoursFor,
  type Dock,
  type Handoff,
  type Load,
} from './src/domain/handoff';
import {
  isDemoVehicle,
  mockIngest,
  nearestFix,
  toDetails,
  unsynced,
} from './src/domain/sync';
import {
  goFixesAround,
  listVehicles,
  pushHandoff,
  SessionExpired,
  signIn,
} from './src/services/mygeotab';
import {
  emptyPersisted,
  loadPersisted,
  savePersisted,
  type Persisted,
} from './src/services/persist';
import { DriverScreen } from './src/ui/DriverScreen';
import { GeotabBar, GeotabSheet } from './src/ui/GeotabBar';
import { DockHero } from './src/ui/illustrations';
import { YardScreen } from './src/ui/YardScreen';

const APP_ID = 'dockhand';
const RESEND_MS = 8_000;
/** No signal is the normal case, so sync just keeps trying while there is work. */
const AUTO_SYNC_MS = 15_000;

export default function App() {
  const [name, setName] = useState('');
  const [yardName, setYardName] = useState('');
  const [state, setState] = useState<Persisted>(emptyPersisted);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const ref = useRef(state);
  /** Driver: handoffIds the yard has acknowledged this session, so they are not resent. */
  const yardHas = useRef(new Set<string>());
  const syncing = useRef(false);

  useEffect(() => {
    loadPersisted().then((p) => {
      ref.current = p;
      setState(p);
    });
  }, []);

  function update(patch: Partial<Persisted>) {
    ref.current = { ...ref.current, ...patch };
    setState(ref.current);
    void savePersisted(ref.current);
  }

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => void handleMessage(from, data),
    onPeerJoined: (peer) => {
      if (room.role === 'host')
        send(peer.id, yoursFor(ref.current.handoffs, peer.id));
      else resend();
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));

  async function handleMessage(from: string, data: unknown) {
    const msg = parseMessage(data);
    if (!msg) return;

    if (room.role === 'host' && msg.type === 'checkin') {
      const h = msg.handoff;
      if (!ref.current.handoffs.some((x) => x.handoffId === h.handoffId)) {
        // A check-in counts only if the phone that sent it signed it.
        if (
          h.driverId !== from ||
          !(await room.verify(from, checkInText(h), h.driverSig))
        )
          return;
        update({ handoffs: addHandoff(ref.current.handoffs, h) });
      }
      send(from, yoursFor(ref.current.handoffs, from)); // the acknowledgement, repeats included
    } else if (
      room.role === 'member' &&
      msg.type === 'yours' &&
      from === room.hostId
    ) {
      for (const remote of msg.handoffs) {
        yardHas.current.add(remote.handoffId);
        const a = remote.assignment;
        const local = ref.current.handoffs.find(
          (x) => x.handoffId === remote.handoffId,
        );
        if (
          !a ||
          !local ||
          local.assignment ||
          local.driverId !== room.localId ||
          a.yardId !== from
        )
          continue;
        // Verified against this phone's own copy, so the yard signed what the driver actually sent.
        if (await room.verify(from, assignmentText(local, a), a.yardSig)) {
          update({
            handoffs: assign(ref.current.handoffs, local.handoffId, a),
          });
        }
      }
    }
  }

  async function checkIn(load: Load) {
    const vehicle =
      vehicles.find((v) => v.id === ref.current.vehicleId) ?? vehicles[0];
    const base = {
      handoffId: newHandoffId(),
      vehicle,
      driverId: room.localId,
      driverName: name.trim().slice(0, 40) || 'Driver',
      load,
      checkedInAt: Date.now(),
    };
    const h: Handoff = {
      ...base,
      driverSig: await room.sign(checkInText(base)),
    };
    update({ handoffs: addHandoff(ref.current.handoffs, h) });
    if (room.hostId) send(room.hostId, { type: 'checkin', handoff: h });
  }

  function resend() {
    if (!room.hostId) return;
    for (const h of awaitingYard(
      ref.current.handoffs,
      room.localId,
      yardHas.current,
    )) {
      send(room.hostId, { type: 'checkin', handoff: h });
    }
  }

  async function assignDock(handoffId: string, dock: Dock) {
    const h = ref.current.handoffs.find((x) => x.handoffId === handoffId);
    if (!h || h.assignment) return;
    const base = {
      dock,
      yardId: room.localId,
      yardName: yardName || 'Yard',
      assignedAt: Date.now(),
    };
    const yardSig = await room.sign(assignmentText(h, base));
    update({
      handoffs: assign(ref.current.handoffs, handoffId, { ...base, yardSig }),
    });
    send(h.driverId, yoursFor(ref.current.handoffs, h.driverId));
  }

  /**
   * Pushes completed handoffs to MyGeotab, or to the mock when not signed in.
   * A manual sync with nothing new re-sends everything, to show the duplicate check.
   */
  async function sync(manual: boolean) {
    const s = ref.current.session;
    const todo = unsynced(ref.current.handoffs, ref.current.syncedIds);
    if (syncing.current || (!manual && (!s || todo.length === 0))) return;
    const batch =
      todo.length > 0 ? todo : ref.current.handoffs.filter((h) => h.assignment);
    const synced = (ids: string[]) => [
      ...new Set([...ref.current.syncedIds, ...ids]),
    ];

    if (!s) {
      const r = mockIngest(
        ref.current.mockStored,
        batch.map((h) => h.handoffId),
      );
      update({
        mockStored: r.stored,
        syncedIds: synced(batch.map((h) => h.handoffId)),
        lastSync: {
          at: Date.now(),
          target: 'mock',
          added: r.added.length,
          duplicates: r.duplicates,
        },
      });
      return;
    }

    syncing.current = true;
    setSyncBusy(true);
    let added = 0;
    let duplicates = 0;
    try {
      for (const h of batch) {
        const fixes = isDemoVehicle(h.vehicle.id)
          ? []
          : await goFixesAround(s, h.vehicle.id, h.checkedInAt).catch(() => []);
        const result = await pushHandoff(
          s,
          toDetails(h, nearestFix(fixes, h.checkedInAt)),
        );
        if (result === 'added') added++;
        else duplicates++;
        update({ syncedIds: synced([h.handoffId]) }); // per record, so a dropped connection loses nothing
      }
      update({
        lastSync: { at: Date.now(), target: 'mygeotab', added, duplicates },
      });
    } catch (e) {
      const expired = e instanceof SessionExpired;
      const offline = e instanceof TypeError; // fetch's "Network request failed"
      update({
        session: expired ? null : ref.current.session,
        lastSync: {
          at: Date.now(),
          target: 'mygeotab',
          added,
          duplicates,
          error: expired
            ? 'Session expired, sign in again'
            : offline
              ? 'No connection, retrying'
              : e instanceof Error
                ? e.message
                : String(e),
        },
      });
    } finally {
      syncing.current = false;
      setSyncBusy(false);
    }
  }

  async function geotabSignIn(
    server: string,
    database: string,
    user: string,
    password: string,
  ) {
    const session = await signIn(server, database, user, password);
    const list = await listVehicles(session).catch(() => []);
    update({ session, vehicles: list, vehicleId: list[0]?.id ?? '' });
  }

  // `sync` and `resend` only read refs, so the first render's copies stay correct.
  useEffect(() => {
    const timer = setInterval(() => void sync(false), AUTO_SYNC_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDriver = room.status === 'connected';
  useEffect(() => {
    if (!isDriver) return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriver]);

  const vehicles = state.vehicles.length > 0 ? state.vehicles : DEMO_VEHICLES;
  const vehicleId = vehicles.some((v) => v.id === state.vehicleId)
    ? state.vehicleId
    : vehicles[0].id;
  const me = {
    id: room.localId || 'me',
    name: (room.role === 'host' ? yardName : name.trim()) || 'Me',
  };

  function start(action: () => void) {
    yardHas.current.clear();
    action();
  }

  let screen: React.ReactNode;
  if (room.status === 'hosting') {
    screen = (
      <YardScreen
        yardName={yardName || 'Yard'}
        people={[me, ...room.peers]}
        handoffs={state.handoffs}
        syncedIds={state.syncedIds}
        onAssign={(id, dock) => void assignDock(id, dock)}
        onLeave={room.leave}
      />
    );
  } else if (room.status === 'connected') {
    screen = (
      <DriverScreen
        yardName={room.hosts.find((h) => h.id === room.hostId)?.name ?? 'Yard'}
        people={[me, ...room.peers]}
        reconnecting={room.peers.length === 0}
        vehicles={vehicles}
        vehicleId={vehicleId}
        onVehicle={(id) => update({ vehicleId: id })}
        handoffs={state.handoffs.filter((h) => h.driverId === room.localId)}
        syncedIds={state.syncedIds}
        onCheckIn={checkIn}
        onLeave={room.leave}
      />
    );
  } else {
    screen = (
      <NearbyLobby
        title="DockHand"
        tagline="Drivers hand load details to the dock office over Bluetooth and get a signed dock assignment back, with no signal. Handoffs sync to MyGeotab when a phone is back online."
        illustration={<DockHero size={180} />}
        accentColor="#fbbf24"
        status={room.status}
        error={room.error}
        hosts={room.hosts}
        peers={room.peers}
        joiningId={room.hostId ?? undefined}
        name={name}
        onNameChange={setName}
        onHost={() =>
          start(() => {
            const label = name.trim() || 'Dock office';
            setYardName(label);
            room.host(label);
          })
        }
        onDiscover={() => start(room.discover)}
        onJoin={(host) => room.join(host.id, name.trim() || 'Driver')}
        onCancel={room.leave}
        labels={{
          host: 'Open dock office',
          join: 'Check in as driver',
          namePlaceholder: 'Your name, or the yard name',
          scanningTitle: 'Nearby dock offices',
          scanningHint:
            'Keep the phones close. Bluetooth only, no signal needed.',
          starting: 'Starting…',
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <View className="bg-background flex-1">
        <View className="flex-1">{screen}</View>
        <GeotabBar
          session={state.session}
          toSync={unsynced(state.handoffs, state.syncedIds).length}
          lastSync={state.lastSync}
          busy={syncBusy}
          onSync={() => void sync(true)}
          onOpen={() => setSheetOpen(true)}
        />
      </View>
      <GeotabSheet
        visible={sheetOpen}
        session={state.session}
        vehicleCount={state.vehicles.length}
        onSignIn={geotabSignIn}
        onSignOut={() => update({ session: null, vehicles: [], vehicleId: '' })}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaProvider>
  );
}
