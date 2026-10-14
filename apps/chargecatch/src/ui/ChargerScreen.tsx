import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SEEDED_CARDS, type ChargerId } from '../domain/cards';
import { chargerHasFault, type ChargerState } from '../domain/sessions';
import { DebugStrip, TopBar } from './common';

export function ChargerScreen({
  chargerId,
  label,
  charger,
  activeCharge,
  people,
  me,
  onStart,
  onStop,
  onLeave,
}: {
  chargerId: ChargerId;
  label: string;
  charger: ChargerState;
  activeCharge: { cardId: string; startedAt: number } | null;
  people: { id: string; name: string }[];
  me: { id: string; name: string };
  onStart: (cardId: string) => void;
  onStop: (kwh: number) => void;
  onLeave: () => void;
}) {
  const [demoKwh, setDemoKwh] = useState(12.4);
  const fault = chargerHasFault(charger, chargerId);
  const pending = charger.pendingSessionIds.length;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Charge point" title={`${chargerId} · ${label}`} people={[me, ...people]} onLeave={onLeave} />
      <ScrollView className="flex-1 px-5 py-4" contentContainerClassName="pb-8">
        <Text className="text-muted-foreground mb-4 text-sm leading-5">
          Charging continues on-device when comms fail. Sessions queue locally, then upstream to the
          site hub over Bluetooth mesh when the link is back.
        </Text>
        {fault ? (
          <View className="border-amber-600 bg-amber-50 mb-4 rounded-xl border-2 px-4 py-3">
            <Text className="font-serif text-xl">Comms fault</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              Sessions save on this charger until a field tech clears the fault and mesh catches up.
            </Text>
          </View>
        ) : null}
        {activeCharge ? (
          <View className="border-emerald-600 bg-emerald-50 mb-4 rounded-xl border-2 px-4 py-4">
            <Text className="font-serif text-2xl">Charging…</Text>
            <Text className="text-muted-foreground mt-1 text-sm">Card {activeCharge.cardId}</Text>
            <Text className="text-muted-foreground mt-2 text-sm">Demo energy (kWh): {demoKwh.toFixed(1)}</Text>
            <View className="mt-3 flex-row gap-2">
              <Button variant="outline" onPress={() => setDemoKwh((k) => Math.max(0.5, k - 2))}>
                <Text>−2 kWh</Text>
              </Button>
              <Button variant="outline" onPress={() => setDemoKwh((k) => k + 2)}>
                <Text>+2 kWh</Text>
              </Button>
            </View>
            <Button className="mt-3" onPress={() => onStop(demoKwh)}>
              <Text>Stop charge & record session</Text>
            </Button>
          </View>
        ) : charger.lastSession ? (
          <View className="border-foreground mb-4 rounded-xl border-2 px-4 py-3">
            <Text className="font-serif text-xl">Last session recorded</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              {charger.lastSession.energyKwh.toFixed(1)} kWh · {charger.lastSession.cardLabel}
            </Text>
            {pending > 0 ? (
              <Text className="text-amber-800 mt-2 text-sm">
                {pending} session(s) not confirmed on hub yet — will retry on mesh.
              </Text>
            ) : (
              <Text className="text-muted-foreground mt-2 text-sm">On hub ledger.</Text>
            )}
          </View>
        ) : null}
        {!activeCharge ? (
          <>
            <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
              Tap a card to start
            </Text>
            <View className="gap-2">
              {SEEDED_CARDS.map((c) => (
                <Pressable
                  key={c.cardId}
                  onPress={() => onStart(c.cardId)}
                  className="border-foreground rounded-xl border-2 px-4 py-3"
                >
                  <Text className="font-serif text-xl">{c.cardId}</Text>
                  <Text className="text-muted-foreground text-sm">{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      <DebugStrip
        lines={[
          fault ? 'comms: fault' : 'comms: ok',
          `pending hub: ${pending}`,
          `hub synced ids: ${charger.syncedSessionIds.length}`,
          `cms dupes: ${charger.cmsDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
