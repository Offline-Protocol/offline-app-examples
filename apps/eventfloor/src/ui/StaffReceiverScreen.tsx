import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StaffAlert, StaffSession } from '../domain/staff';
import { DebugStrip, TopBar, useNow } from './common';

export function StaffReceiverScreen({
  session,
  me,
  people,
  alerts,
  ackedIds,
  onAck,
  onLeave,
}: {
  session: StaffSession;
  me: { id: string; name: string };
  people: { id: string; name: string }[];
  alerts: StaffAlert[];
  ackedIds: Set<string>;
  onAck: (alert: StaffAlert) => void;
  onLeave: () => void;
}) {
  const now = useNow();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Staff receiver" title={session.displayName} people={[me, ...people]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={alerts}
        keyExtractor={(a) => a.alertId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm">
              Encrypted staff alerts appear here when cell is saturated. Tap Ack when your unit is
              responding.
            </Text>
            {alerts.length === 0 ? (
              <Text className="text-muted-foreground text-center text-sm">No alerts yet.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const acked = ackedIds.has(item.alertId);
          return (
            <View className="border-foreground mx-5 mb-3 rounded-xl border-2 p-4">
              <Text className="font-serif text-2xl">{item.section}</Text>
              <Text className="mt-2 text-base">{item.body}</Text>
              <Text className="text-muted-foreground mt-2 text-sm">
                From {item.senderName} ({item.senderUnit}) · {Math.round((now - item.createdAt) / 1000)}s ago
              </Text>
              <Button
                className="mt-3"
                disabled={acked}
                onPress={() => onAck(item)}
              >
                <Text>{acked ? 'Acknowledged' : 'Ack'}</Text>
              </Button>
            </View>
          );
        }}
      />
      <DebugStrip
        lines={[
          `staff unit: ${session.unit}`,
          `peers: ${people.length}`,
          `open alerts: ${alerts.filter((a) => !ackedIds.has(a.alertId)).length}`,
        ]}
      />
    </SafeAreaView>
  );
}
