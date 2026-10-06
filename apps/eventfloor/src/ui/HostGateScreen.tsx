import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AdmissionRecord, HostState } from '../domain/admission';
import { DebugStrip, TopBar, useNow } from './common';

export function HostGateScreen({
  gateName,
  host,
  platformTotal,
  people,
  onSyncPlatform,
  onLeave,
}: {
  gateName: string;
  host: HostState;
  platformTotal: number;
  people: { id: string; name: string }[];
  onSyncPlatform: () => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const me = { id: 'host', name: gateName };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Lead scanner" title={gateName} people={[me, ...people]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={[...host.admissions].reverse()}
        keyExtractor={(a) => a.scanId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm">
              Authoritative admission ledger for this event. Other scanners receive snapshots over
              Bluetooth mesh.
            </Text>
            <Button onPress={onSyncPlatform}>
              <Text>Sync to platform (mock)</Text>
            </Button>
          </View>
        }
        renderItem={({ item }: { item: AdmissionRecord }) => (
          <View className="border-foreground mx-5 mb-2 rounded-xl border-2 px-4 py-3">
            <Text className="font-serif text-xl">{item.ticketId}</Text>
            <Text className="text-muted-foreground text-sm">
              {item.holder} · {item.section} · {item.gateName}
            </Text>
            <Text className="text-muted-foreground font-mono text-[10px]">
              {item.scanId} · {Math.round((now - item.scannedAt) / 1000)}s ago
            </Text>
          </View>
        )}
      />
      <DebugStrip
        lines={[
          `admissions: ${host.admissions.length}`,
          `synced: ${host.syncedScanIds.length}`,
          `platform rows: ${platformTotal}`,
          `dupes dropped: ${host.platformDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
