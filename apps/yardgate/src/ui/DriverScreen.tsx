import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DriverState } from '../domain/checkin';
import type { GateProvider } from '../mesh/gateSession';
import { SEEDED_LOADS } from '../domain/checkin';
import { DebugStrip, TopBar } from './common';

export function DriverScreen({
  driverName,
  providers,
  driver,
  neighbors,
  selectedLoadIndex,
  onSelectLoad,
  selectedProviderId,
  onSelectProvider,
  onSubmit,
  onLeave,
  me,
}: {
  driverName: string;
  providers: GateProvider[];
  driver: DriverState;
  neighbors: number;
  selectedLoadIndex: number;
  onSelectLoad: (index: number) => void;
  selectedProviderId: string | null;
  onSelectProvider: (id: string) => void;
  onSubmit: () => void;
  onLeave: () => void;
  me: { id: string; name: string };
}) {
  const load = SEEDED_LOADS[selectedLoadIndex] ?? SEEDED_LOADS[0];
  const busy = driver.status === 'submitting' || driver.status === 'waiting';

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Driver" title={driverName} people={[me]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={providers}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View className="gap-4 px-5 py-4">
            <Text className="text-muted-foreground text-sm">
              Discover the yard gate service over Bluetooth mesh (use a relay phone if you are not
              in range of the gate).
            </Text>
            <View>
              <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
                Load (seeded)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SEEDED_LOADS.map((seed, i) => (
                  <Pressable
                    key={seed.loadId}
                    onPress={() => onSelectLoad(i)}
                    className={`rounded-lg border-2 px-3 py-2 ${
                      i === selectedLoadIndex ? 'border-foreground bg-muted' : 'border-muted'
                    }`}
                  >
                    <Text className="font-mono text-sm">{seed.loadId}</Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-muted-foreground mt-2 text-sm">Trailer {load.trailerId}</Text>
            </View>
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              Nearby gates
            </Text>
            {providers.length === 0 ? (
              <Text className="text-muted-foreground text-sm">Scanning… keep phones close.</Text>
            ) : null}
            {driver.lastDecision ? (
              <View
                className={`rounded-xl border-2 px-4 py-3 ${
                  driver.lastDecision.decision === 'approved'
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-red-600 bg-red-50'
                }`}
              >
                <Text className="font-serif text-xl capitalize">{driver.lastDecision.decision}</Text>
                <Text className="text-muted-foreground mt-1 text-sm">
                  Gate: {driver.lastDecision.gateOfficer}
                </Text>
              </View>
            ) : null}
            {driver.error ? <Text className="text-destructive text-sm">{driver.error}</Text> : null}
            <Button disabled={busy || !selectedProviderId} onPress={onSubmit}>
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text>Submit check-in</Text>
              )}
            </Button>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelectProvider(item.id)}
            className={`border-foreground mx-5 mb-2 rounded-xl border-2 px-4 py-3 ${
              selectedProviderId === item.id ? 'bg-muted' : ''
            }`}
          >
            <Text className="font-serif text-xl">{item.name}</Text>
            <Text className="text-muted-foreground font-mono text-xs">
              {item.hopCount === 0 ? 'Direct BLE' : `${item.hopCount} hop${item.hopCount === 1 ? '' : 's'}`}
            </Text>
          </Pressable>
        )}
      />
      <DebugStrip pending={0} decided={driver.lastDecision ? 1 : 0} duplicateResponses={0} neighbors={neighbors} />
    </SafeAreaView>
  );
}
