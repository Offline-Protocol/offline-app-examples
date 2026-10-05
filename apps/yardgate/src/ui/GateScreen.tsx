import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GateState, PendingCheckIn } from '../domain/checkin';
import { DebugStrip, TopBar, useNow } from './common';

export function GateScreen({
  gateName,
  gate,
  gateActionError,
  neighbors,
  me,
  onApprove,
  onDeny,
  onLeave,
}: {
  gateName: string;
  gate: GateState;
  gateActionError: string;
  neighbors: number;
  me: { id: string; name: string };
  onApprove: (item: PendingCheckIn) => void;
  onDeny: (item: PendingCheckIn) => void;
  onLeave: () => void;
}) {
  const now = useNow();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Gate officer" title={gateName} people={[me]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={gate.pending}
        keyExtractor={(item) => item.requestId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm">
              Check-in requests arrive over Bluetooth mesh. Approve or deny — the driver sees your
              decision on their phone.
            </Text>
            {gateActionError ? (
              <Text className="text-destructive text-sm">{gateActionError}</Text>
            ) : null}
            {gate.pending.length === 0 ? (
              <View className="border-foreground bg-muted/30 rounded-xl border-2 border-dashed px-4 py-8">
                <Text className="text-center font-serif text-xl">Waiting for drivers</Text>
                <Text className="text-muted-foreground mt-2 text-center text-sm">
                  Keep this device at the gate with Bluetooth on.
                </Text>
              </View>
            ) : null}
            {gate.decided.length > 0 ? (
              <View className="gap-2">
                <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  Recent decisions
                </Text>
                {gate.decided.slice(-3).reverse().map((d) => (
                  <Text key={d.checkInId} className="font-mono text-xs">
                    {d.checkInId} → {d.decision} ({Math.round((now - d.at) / 1000)}s ago)
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="border-foreground mx-5 mb-3 rounded-xl border-2 p-4">
            <Text className="font-serif text-2xl">{item.loadId}</Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              Trailer {item.trailerId} · {item.driverName}
            </Text>
            <Text className="text-muted-foreground mt-1 font-mono text-[10px]">{item.checkInId}</Text>
            <View className="mt-4 flex-row gap-2">
              <Button className="flex-1" onPress={() => onDeny(item)}>
                <Text>Deny</Text>
              </Button>
              <Button variant="default" className="flex-1" onPress={() => onApprove(item)}>
                <Text>Approve</Text>
              </Button>
            </View>
          </View>
        )}
      />
      <DebugStrip
        pending={gate.pending.length}
        decided={gate.decided.length}
        duplicateResponses={gate.duplicateResponses}
        neighbors={neighbors}
      />
    </SafeAreaView>
  );
}
