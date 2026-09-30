import '@offline-app-examples/ui/global.css';
import { useNearbyRoom } from '@offline-app-examples/mesh';
import { NearbyLobby, PortalHost } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorScreen } from './src/ui/EditorScreen';
import { HeroIllustration } from './src/ui/illustrations';

const APP_ID = 'cowrite';
const GRAPE = '#8A5CD6';

export default function App() {
  const [name, setName] = useState('');
  // How many times each document changed (`data_changed`), so the editor knows to re-read it.
  const [changes, setChanges] = useState<Record<string, number>>({});

  // Group mode: the host creates an MLS group and adds everyone who joins. That group is
  // the DataStore "space" the document lives in.
  const room = useNearbyRoom({
    appId: APP_ID,
    group: true,
    onProtocolEvent: (event) => {
      if (event.type === 'data_changed' && event.space_id === room.groupId) {
        setChanges((c) => ({
          ...c,
          [event.doc_id]: (c[event.doc_id] ?? 0) + 1,
        }));
      }
    },
  });

  const displayName = name.trim() || 'Someone';
  const inRoom =
    (room.status === 'hosting' || room.status === 'connected') && room.groupId;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {inRoom ? (
        <EditorScreen
          key={room.groupId}
          space={room.groupId!}
          me={{ id: room.localId, name: displayName }}
          changes={changes}
          online={room.peers.length > 0}
          onLeave={room.leave}
        />
      ) : (
        <NearbyLobby
          title="Cowrite"
          tagline="One document, everyone nearby. No internet needed."
          illustration={<HeroIllustration />}
          accentColor={GRAPE}
          status={room.status}
          error={room.error}
          hosts={room.hosts}
          peers={room.peers}
          joiningId={room.hostId ?? undefined}
          name={name}
          onNameChange={setName}
          onHost={() => room.host(displayName)}
          onDiscover={room.discover}
          onJoin={(host) => room.join(host.id, displayName)}
          onCancel={room.leave}
          labels={{
            host: 'Start a document',
            join: 'Join a document',
            scanningTitle: 'Documents nearby',
            scanningHint:
              'Documents started on phones around you show up here. Keep both apps open and close together.',
          }}
        />
      )}
      <PortalHost />
    </SafeAreaProvider>
  );
}
