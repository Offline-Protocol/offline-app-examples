import '@offline-app-examples/ui/global.css';
import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AgriFlow, type AgriRole } from './src/flows/AgriFlow';
import { DEMO_FARM } from './src/domain/plots';
import { AgriHero } from './src/ui/illustrations';

type Setup = { role: AgriRole; displayName: string };

export default function App() {
  const [setup, setSetup] = useState<Setup | null>(null);

  if (setup) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AgriFlow
          role={setup.role}
          displayName={setup.displayName}
          onLeave={() => setSetup(null)}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <HomeLobby onStart={setSetup} />
    </SafeAreaProvider>
  );
}

function HomeLobby({ onStart }: { onStart: (setup: Setup) => void }) {
  const [role, setRole] = useState<AgriRole>('office');
  const [name, setName] = useState('North office edge');

  const defaults: Record<AgriRole, string> = {
    office: 'North office edge',
    field: 'Plot walker A',
    relay: 'Field relay',
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="font-serif text-4xl">AgriMesh</Text>
        <Text className="text-muted-foreground mt-2 text-base leading-6">
          {DEMO_FARM.name} — field readings hop across Bluetooth mesh to the farm office edge,
          then sync once to a mock farm system (SDK 0.28).
        </Text>
        <View className="my-6 items-center">
          <AgriHero size={160} />
        </View>
        <RolePick
          options={[
            {
              id: 'office',
              title: 'Office edge',
              hint: 'Hosts the batch ledger; uploads when online',
            },
            {
              id: 'field',
              title: 'Field collector',
              hint: 'Logs readings; proposes batches over mesh',
            },
            {
              id: 'relay',
              title: 'Relay worker',
              hint: 'Store-and-forward hop between field and office',
            },
          ]}
          selected={role}
          onSelect={(id) => {
            const r = id as AgriRole;
            setRole(r);
            setName(defaults[r]);
          }}
        />
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Device label
        </Text>
        <TextInput
          className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3"
          value={name}
          onChangeText={setName}
          placeholder={defaults[role]}
        />
        <Button
          onPress={() =>
            onStart({ role, displayName: name.trim() || defaults[role] })
          }
        >
          <Text>Start</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function RolePick({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; title: string; hint: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="my-4 gap-2">
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onSelect(o.id)}
          className={`rounded-xl border-2 px-4 py-3 ${selected === o.id ? 'border-foreground bg-muted' : 'border-muted'}`}
        >
          <Text className="font-serif text-xl">{o.title}</Text>
          <Text className="text-muted-foreground text-sm">{o.hint}</Text>
        </Pressable>
      ))}
    </View>
  );
}
