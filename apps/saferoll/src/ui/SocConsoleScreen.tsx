import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_CLIENT } from '../domain/roster';
import type { CheckInRecord, SocState } from '../domain/rollcall';
import { DebugStrip, TopBar, useNow } from './common';

function statusLabel(status: CheckInRecord['status']): string {
  if (status === 'safe') return 'Safe';
  if (status === 'help') return 'Need help';
  return 'SOS';
}

export function SocConsoleScreen({
  consoleName,
  soc,
  northwindTotal,
  people,
  onToggleCloudLink,
  onPullAlert,
  onSyncNorthwind,
  onLeave,
}: {
  consoleName: string;
  soc: SocState;
  northwindTotal: number;
  people: { id: string; name: string }[];
  onToggleCloudLink: (online: boolean) => void;
  onPullAlert: () => void;
  onSyncNorthwind: () => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const me = { id: 'soc', name: consoleName };
  const awaiting = soc.checkIns.filter((c) => !soc.syncedCheckInIds.includes(c.checkInId)).length;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="SOC console" title={consoleName} people={[me, ...people]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={[...soc.checkIns].reverse()}
        keyExtractor={(c) => c.checkInId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm leading-6">
              {DEMO_CLIENT.name} — last mile for Northwind Alerts. Roll call ledger hops over Bluetooth mesh
              when field phones lose cell data; check-ins reconcile when any link to Northwind Alerts is back.
            </Text>
            <View className="flex-row items-center justify-between rounded-xl border-2 border-muted px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-serif text-lg">Cloud link (Northwind Alerts)</Text>
                <Text className="text-muted-foreground text-sm">
                  {soc.cloudLinkOnline ? 'Online on this console' : 'Offline — mesh only'}
                </Text>
              </View>
              <Pressable
                onPress={() => onToggleCloudLink(!soc.cloudLinkOnline)}
                className={`rounded-full px-4 py-2 ${soc.cloudLinkOnline ? 'bg-green-600' : 'bg-muted'}`}
              >
                <Text className={soc.cloudLinkOnline ? 'text-white font-bold' : ''}>
                  {soc.cloudLinkOnline ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>
            <Button onPress={onPullAlert} disabled={!soc.cloudLinkOnline || Boolean(soc.activeAlert)}>
              <Text>Receive flood alert (mock Northwind Alerts)</Text>
            </Button>
            {soc.activeAlert ? (
              <View className="border-destructive rounded-xl border-2 bg-red-50 px-4 py-3">
                <Text className="text-destructive text-xs font-bold uppercase tracking-widest">
                  Active · {soc.activeAlert.severity}
                </Text>
                <Text className="font-serif text-xl">{soc.activeAlert.title}</Text>
                <Text className="text-muted-foreground mt-1 text-sm leading-5">{soc.activeAlert.body}</Text>
                <Text className="text-muted-foreground mt-2 font-mono text-[10px]">
                  {soc.activeAlert.signature} · broadcast signed
                </Text>
              </View>
            ) : (
              <Text className="text-muted-foreground text-sm">
                Turn cloud link on, then pull the demo flood alert to fan out over mesh.
              </Text>
            )}
            <Button onPress={onSyncNorthwind} disabled={!soc.cloudLinkOnline || soc.checkIns.length === 0}>
              <Text>Upload roll call to Northwind Alerts (mock)</Text>
            </Button>
          </View>
        }
        ListEmptyComponent={
          <Text className="text-muted-foreground px-5 py-6 text-center text-sm">
            No check-ins yet. Staff handsets join this mesh and respond to the signed alert.
          </Text>
        }
        renderItem={({ item }: { item: CheckInRecord }) => (
          <View className="border-foreground mx-5 mb-2 rounded-xl border-2 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-serif text-xl">{item.displayName}</Text>
              <Text
                className={
                  item.status === 'sos'
                    ? 'text-destructive font-bold'
                    : item.status === 'help'
                      ? 'text-amber-700 font-bold'
                      : 'text-green-700 font-bold'
                }
              >
                {statusLabel(item.status)}
              </Text>
            </View>
            <Text className="text-muted-foreground text-sm">
              {item.office} · {item.employeeId}
            </Text>
            <Text className="text-muted-foreground font-mono text-[10px]">
              {item.checkInId} · {Math.round((now - item.at) / 1000)}s ago
            </Text>
          </View>
        )}
      />
      <DebugStrip
        lines={[
          `check-ins: ${soc.checkIns.length}`,
          `awaiting upload: ${awaiting}`,
          `northwind rows: ${northwindTotal}`,
          `dupes dropped: ${soc.northwindDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
