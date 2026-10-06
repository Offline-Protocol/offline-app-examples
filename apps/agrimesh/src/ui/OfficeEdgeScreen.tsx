import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { OfficeState, ReadingRecord } from '../domain/ledger';
import { DebugStrip, TopBar, useNow } from './common';

function formatReading(r: ReadingRecord): string {
  if (r.kind === 'equipment_ok') return 'Equipment check — OK';
  if (r.kind === 'equipment_issue') return `Issue: ${r.value}`;
  return `${r.value}${r.unit ? ` ${r.unit}` : ''} moisture`;
}

export function OfficeEdgeScreen({
  officeName,
  office,
  farmTotal,
  people,
  onSyncFarm,
  onLeave,
}: {
  officeName: string;
  office: OfficeState;
  farmTotal: number;
  people: { id: string; name: string }[];
  onSyncFarm: () => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const me = { id: 'office', name: officeName };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Office edge" title={officeName} people={[me, ...people]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={[...office.readings].reverse()}
        keyExtractor={(r) => r.readingId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm leading-5">
              Authoritative batch ledger at the farm office edge. Readings arrive over Bluetooth mesh
              (store-and-forward via relay workers when needed). Upload when connectivity returns.
            </Text>
            <Button onPress={onSyncFarm}>
              <Text>Sync to farm system (mock)</Text>
            </Button>
          </View>
        }
        renderItem={({ item }: { item: ReadingRecord }) => (
          <View className="border-foreground mx-5 mb-2 rounded-xl border-2 px-4 py-3">
            <Text className="font-serif text-xl">
              {item.plotId} · {item.plotName}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {formatReading(item)} · {item.collectorName}
            </Text>
            <Text className="text-muted-foreground font-mono text-[10px]">
              {item.readingId} · {Math.round((now - item.recordedAt) / 1000)}s ago
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-muted-foreground px-5 py-8 text-center text-sm">
            Waiting for field readings over mesh…
          </Text>
        }
      />
      <DebugStrip
        lines={[
          `readings: ${office.readings.length}`,
          `synced: ${office.syncedReadingIds.length}`,
          `farm rows: ${farmTotal}`,
          `dupes dropped: ${office.farmDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
