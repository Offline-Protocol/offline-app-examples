import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHARGER_IDS } from '../domain/cards';
import type { ChargerState } from '../domain/sessions';
import { DebugStrip, TopBar } from './common';

export function TechScreen({
  label,
  hubView,
  people,
  me,
  onClearFault,
  onLeave,
}: {
  label: string;
  hubView: ChargerState;
  people: { id: string; name: string }[];
  me: { id: string; name: string };
  onClearFault: (chargerId: string) => void;
  onLeave: () => void;
}) {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Field tech" title={label} people={[me, ...people]} onLeave={onLeave} />
      <View className="flex-1 gap-4 px-5 py-4">
        <Text className="text-muted-foreground text-sm leading-5">
          Clear communications faults reported by the site hub. After repair, chargers retry pending
          sessions over mesh automatically.
        </Text>
        <Text className="text-muted-foreground text-xs leading-4">
          Head office link: {hubView.headOfficeOnline ? 'online (on hub)' : 'offline (on hub)'}
        </Text>
        {CHARGER_IDS.map((id) => {
          const fault = Boolean(hubView.chargerFaults[id]);
          return (
            <View
              key={id}
              className={`rounded-xl border-2 px-4 py-4 ${fault ? 'border-amber-600 bg-amber-50' : 'border-foreground'}`}
            >
              <Text className="font-serif text-2xl">{id}</Text>
              <Text className="text-muted-foreground mt-1 text-sm">
                {fault ? 'Fault — queue on charger' : 'No fault'}
              </Text>
              {fault ? (
                <Button className="mt-3" onPress={() => onClearFault(id)}>
                  <Text>Mark comms repaired</Text>
                </Button>
              ) : null}
            </View>
          );
        })}
      </View>
      <DebugStrip
        lines={[
          `hub sessions visible: ${hubView.sessions.length}`,
          `cms synced on hub: ${hubView.syncedSessionIds.length}`,
        ]}
      />
    </SafeAreaView>
  );
}
