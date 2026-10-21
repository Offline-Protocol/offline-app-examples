import '@offline-app-examples/ui/global.css';
import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CHARGER_IDS, DEMO_SITE, type ChargerId } from './src/domain/cards';
import { ChargeFlow, type ChargeRole } from './src/flows/ChargeFlow';
import { ChargeHero } from './src/ui/illustrations';

type Setup = { role: ChargeRole; displayName: string; chargerId: ChargerId };

export default function App() {
  const [setup, setSetup] = useState<Setup | null>(null);

  if (setup) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <ChargeFlow
          role={setup.role}
          displayName={setup.displayName}
          chargerId={setup.chargerId}
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
  const [role, setRole] = useState<ChargeRole>('hub');
  const [name, setName] = useState('North site hub');
  const [chargerId, setChargerId] = useState<ChargerId>('CP-A');

  const defaults: Record<ChargeRole, string> = {
    hub: 'North site hub',
    charger: 'Charge point A',
    tech: 'Field tech',
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="font-serif text-4xl">ChargeCatch</Text>
        <Text className="text-muted-foreground mt-2 text-base leading-6">
          {DEMO_SITE.name} — charge sessions stay on devices when head office is offline, hop to the
          site hub over Bluetooth mesh, then reconcile to a mock CMS when connectivity returns (SDK
          0.30).
        </Text>
        <View className="my-6 items-center">
          <ChargeHero size={160} />
        </View>
        <RolePick
          options={[
            {
              id: 'hub',
              title: 'Site hub',
              hint: 'Ledger for all charge points; upload to mock CMS',
            },
            {
              id: 'charger',
              title: 'Charge point',
              hint: 'Run sessions; queue locally on comms fault',
            },
            {
              id: 'tech',
              title: 'Field tech',
              hint: 'Clear charger comms faults after repair',
            },
          ]}
          selected={role}
          onSelect={(id) => {
            const r = id as ChargeRole;
            setRole(r);
            setName(defaults[r]);
          }}
        />
        {role === 'charger' ? (
          <>
            <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
              Charger id
            </Text>
            <View className="mb-4 flex-row gap-2">
              {CHARGER_IDS.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => {
                    setChargerId(id);
                    setName(id === 'CP-A' ? 'Charge point A' : 'Charge point B');
                  }}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 ${chargerId === id ? 'border-foreground bg-muted' : 'border-muted'}`}
                >
                  <Text className="text-center font-serif text-lg">{id}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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
            onStart({
              role,
              displayName: name.trim() || defaults[role],
              chargerId: role === 'charger' ? chargerId : 'CP-A',
            })
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
