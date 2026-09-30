import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby } from '@offline-app-examples/ui';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  emptyKitchen,
  emptyWaiter,
  kitchenReducer,
  parseMessage,
  snapshotOf,
  unconfirmed,
  waiterReducer,
  type KitchenAction,
  type NewOrder,
  type WaiterAction,
} from './src/domain/orders';
import { BellArt } from './src/ui/illustrations';
import { KitchenScreen } from './src/ui/KitchenScreen';
import { OrderScreen } from './src/ui/OrderScreen';

const APP_ID = 'orderup';
const RESEND_MS = 10_000;

// The kitchen display hosts the room; waiters' devices join it.
// All sync logic is in src/domain/orders.ts; this file only wires it to the room.
export default function App() {
  const [name, setName] = useState('');
  // State lives in refs too, so room callbacks always read the latest value.
  const [kitchen, setKitchen] = useState(emptyKitchen);
  const [waiter, setWaiter] = useState(emptyWaiter);
  const kitchenRef = useRef(kitchen);
  const waiterRef = useRef(waiter);

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (from, data) => {
      const msg = parseMessage(data); // never trust the radio
      if (msg?.type === 'place' && room.role === 'host') {
        const changed = updateKitchen({
          type: 'place',
          order: msg.order,
          now: Date.now(),
        });
        // A resend we already have: this waiter probably missed a snapshot.
        if (!changed) send(from, snapshotOf(kitchenRef.current));
      } else if (msg?.type === 'snapshot' && room.role === 'member') {
        updateWaiter(msg);
        resend();
      }
    },
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, snapshotOf(kitchenRef.current));
      else resend(); // the kitchen is back: send whatever it has not confirmed
    },
  });

  const send = (peerId: string, data: unknown) =>
    room.send(peerId, data).catch((e) => console.warn('send failed', e));
  const broadcast = (data: unknown) =>
    room.broadcast(data).catch((e) => console.warn('broadcast failed', e));

  /** Kitchen: apply an action, and tell every waiter if something changed. */
  function updateKitchen(action: KitchenAction) {
    const next = kitchenReducer(kitchenRef.current, action);
    if (next === kitchenRef.current) return false;
    kitchenRef.current = next;
    setKitchen(next);
    broadcast(snapshotOf(next));
    return true;
  }

  function updateWaiter(action: WaiterAction) {
    waiterRef.current = waiterReducer(waiterRef.current, action);
    setWaiter(waiterRef.current);
  }

  /** Waiter: (re)send every order no snapshot has confirmed. The kitchen ignores duplicates. */
  function resend() {
    unconfirmed(waiterRef.current).forEach((order) =>
      broadcast({ type: 'place', order }),
    );
  }

  function placeOrder(draft: Pick<NewOrder, 'table' | 'items' | 'note'>) {
    const order: NewOrder = {
      ...draft,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      waiter: name.trim().slice(0, 30) || 'Waiter',
      placedAt: Date.now(),
    };
    updateWaiter({ type: 'sent', order });
    broadcast({ type: 'place', order });
  }

  // Safety net for a message lost on the radio while the link still looked fine.
  const isWaiter = room.status === 'connected';
  useEffect(() => {
    if (!isWaiter) return;
    const timer = setInterval(resend, RESEND_MS);
    return () => clearInterval(timer);
    // resend() only reads refs, so the first one stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaiter]);

  function start(action: () => void) {
    kitchenRef.current = emptyKitchen;
    waiterRef.current = emptyWaiter;
    setKitchen(emptyKitchen);
    setWaiter(emptyWaiter);
    action();
  }

  let screen: React.ReactNode;
  if (room.status === 'hosting') {
    screen = (
      <KitchenScreen
        name={name.trim() || 'Kitchen'}
        kitchen={kitchen}
        waiters={room.peers}
        onAdvance={(id, from) => updateKitchen({ type: 'advance', id, from })}
        onLeave={room.leave}
      />
    );
  } else if (room.status === 'connected') {
    const kitchenName =
      room.peers[0]?.name ??
      room.hosts.find((h) => h.id === room.hostId)?.name ??
      'Kitchen';
    screen = (
      <OrderScreen
        kitchenName={kitchenName}
        peers={room.peers}
        waiter={waiter}
        onSend={placeOrder}
        onLeave={room.leave}
      />
    );
  } else {
    screen = (
      <NearbyLobby
        title="Order Up"
        tagline="Open the kitchen on the tablet by the pass. Waiters join it and send orders over Bluetooth, no Wi-Fi needed."
        illustration={<BellArt size={180} />}
        accentColor="#FF385C"
        status={room.status}
        error={room.error}
        hosts={room.hosts}
        peers={room.peers}
        joiningId={room.hostId ?? undefined}
        name={name}
        onNameChange={setName}
        onHost={() => start(() => room.host(name.trim() || 'Kitchen'))}
        onDiscover={() => start(room.discover)}
        onJoin={(host) => room.join(host.id, name.trim() || 'Waiter')}
        onCancel={room.leave}
        labels={{
          host: 'Open the kitchen',
          join: 'Join a kitchen',
          namePlaceholder: 'Your name, or the kitchen’s',
          scanningTitle: 'Nearby kitchens',
          scanningHint:
            'Kitchens show up here once they are open. Keep both devices close.',
          starting: 'Opening…',
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
