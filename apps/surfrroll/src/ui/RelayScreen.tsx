import { Text } from '@offline-app-examples/ui';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DebugStrip, TopBar } from './common';

export function RelayScreen({
  relayName,
  neighbors,
  me,
  onLeave,
}: {
  relayName: string;
  neighbors: number;
  me: { id: string; name: string };
  onLeave: () => void;
}) {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Mesh relay" title={relayName} people={[me]} onLeave={onLeave} />
      <View className="flex-1 justify-center gap-4 px-8">
        <Text className="font-serif text-center text-3xl">Relay active</Text>
        <Text className="text-muted-foreground text-center text-base leading-6">
          Place between the SOC console and staff handsets when only one phone has internet — alert
          and roll-call packets hop across floors or campus blocks without showing message bodies here.
        </Text>
        <Text className="text-muted-foreground text-center font-mono text-sm">
          {neighbors} BLE neighbor{neighbors === 1 ? '' : 's'}
        </Text>
      </View>
      <DebugStrip lines={[`neighbors: ${neighbors}`, 'relay: forward only']} />
    </SafeAreaView>
  );
}
