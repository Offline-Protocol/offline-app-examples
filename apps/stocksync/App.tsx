import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby } from '@offline-app-examples/ui';
import React, { useEffect, useReducer, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  changedIds,
  INITIAL_STATE,
  parseMessage,
  stockReducer,
  toSnapshot,
  type ProductId,
} from './src/domain/stock';
import { StoreHero } from './src/ui/illustrations';
import { InventoryScreen } from './src/ui/inventory';

const APP_ID = 'stocksync';

export default function App() {
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [state, dispatch] = useReducer(stockReducer, INITIAL_STATE);
  const [flashes, setFlashes] = useState<Partial<Record<ProductId, number>>>(
    {},
  );

  const flash = (ids: ProductId[]) =>
    setFlashes((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = (next[id] ?? 0) + 1;
      return next;
    });

  const room = useNearbyRoom({
    appId: APP_ID,
    onMessage: (_from, data) => {
      const message = parseMessage(data);
      if (!message) return;
      if (room.role === 'host' && message.type === 'adjust') {
        dispatch(message);
        flash([message.productId]);
      } else if (room.role === 'member' && message.type === 'snapshot') {
        if (message.rev >= state.rev)
          flash(changedIds(state.stock, message.stock));
        dispatch(message);
      }
    },
    // Also fires when a member comes back into range, so it always gets the latest stock.
    onPeerJoined: (peer) => {
      if (room.role === 'host') send(peer.id, toSnapshot(state));
    },
  });

  const send = (peerId: string, data: unknown) =>
    room
      .send(peerId, data)
      .catch((error) => console.warn('[stocksync] send failed', error));

  // Host: every new revision goes out to everyone as a full snapshot.
  const { role, broadcast } = room;
  useEffect(() => {
    if (role !== 'host' || state.rev === 0) return;
    broadcast(toSnapshot(state)).catch((error) =>
      console.warn('[stocksync] broadcast failed', error),
    );
  }, [role, broadcast, state]);

  const adjust = (productId: ProductId, delta: number) => {
    if (room.role === 'host') {
      dispatch({ type: 'adjust', productId, delta });
    } else if (room.hostId) {
      dispatch({ type: 'predict', productId, delta });
      send(room.hostId, { type: 'adjust', productId, delta });
    }
  };

  const openStore = () => {
    const store = name.trim() || 'Corner Store';
    dispatch({ type: 'reset' });
    setStoreName(store);
    room.host(store);
  };

  const joinStore = (host: { id: string; name: string }) => {
    dispatch({ type: 'reset' });
    setStoreName(host.name);
    room.join(host.id, name);
  };

  const inStore = room.status === 'hosting' || room.status === 'connected';
  const me = {
    id: room.localId || 'me',
    name: room.role === 'host' ? storeName : name.trim() || 'Guest',
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {inStore ? (
        <InventoryScreen
          storeName={storeName}
          isHost={room.role === 'host'}
          people={[me, ...room.peers]}
          reconnecting={room.role === 'member' && room.peers.length === 0}
          stock={state.stock}
          flashes={flashes}
          onAdjust={adjust}
          onLeave={room.leave}
        />
      ) : (
        <NearbyLobby
          title="Stock Sync"
          tagline="Count stock together, even with no signal."
          illustration={<StoreHero />}
          accentColor="#10C683"
          status={room.status}
          error={room.error}
          hosts={room.hosts}
          peers={room.peers}
          joiningId={room.hostId ?? undefined}
          name={name}
          onNameChange={setName}
          onHost={openStore}
          onDiscover={room.discover}
          onJoin={joinStore}
          onCancel={room.leave}
          labels={{
            host: 'Open a store',
            join: 'Join a store',
            namePlaceholder: 'Store name or your name',
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
