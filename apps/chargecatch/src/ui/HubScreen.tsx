import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, Pressable, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHARGER_IDS } from '../domain/cards';
import type { ChargeSession, HubState } from '../domain/sessions';
import { sessionsAwaitingCms } from '../domain/sessions';
import { DebugStrip, TopBar, useNow } from './common';

export function HubScreen({
  siteName,
  hub,
  cmsTotal,
  people,
  me,
  onSyncCms,
  onHeadOfficeOnline,
  onSetFault,
  onLeave,
}: {
  siteName: string;
  hub: HubState;
  cmsTotal: number;
  people: { id: string; name: string }[];
  me: { id: string; name: string };
  onSyncCms: () => void;
  onHeadOfficeOnline: (online: boolean) => void;
  onSetFault: (chargerId: string, fault: boolean) => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const awaiting = sessionsAwaitingCms(hub);
  const canSync = hub.headOfficeOnline && hub.sessions.length > 0;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Site hub" title={siteName} people={[me, ...people]} onLeave={onLeave} />
      <FlatList
        className="flex-1"
        data={[...hub.sessions].reverse()}
        keyExtractor={(s) => s.sessionId}
        ListHeaderComponent={
          <View className="gap-3 px-5 py-4">
            <Text className="text-muted-foreground text-sm leading-5">
              Site ledger for all charge points. Sessions arrive over Bluetooth mesh while head
              office is offline; reconcile to the mock CMS when connectivity returns.
            </Text>
            <View className="border-foreground flex-row items-center justify-between rounded-xl border-2 px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-serif text-lg">Head office link</Text>
                <Text className="text-muted-foreground text-xs leading-4">
                  {hub.headOfficeOnline
                    ? 'Online — CMS sync enabled'
                    : 'Offline — sessions stay on hub only'}
                </Text>
              </View>
              <Switch value={hub.headOfficeOnline} onValueChange={onHeadOfficeOnline} />
            </View>
            <Button onPress={onSyncCms} disabled={!canSync}>
              <Text>{canSync ? 'Upload to CMS (mock)' : 'Upload to CMS (mock)'}</Text>
            </Button>
            {!hub.headOfficeOnline ? (
              <Text className="text-muted-foreground text-xs leading-4">
                Turn on head office link to simulate connectivity restored, then upload.
              </Text>
            ) : null}
            {awaiting > 0 && hub.headOfficeOnline ? (
              <Text className="text-amber-800 text-sm">{awaiting} session(s) waiting for CMS.</Text>
            ) : null}
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              Charger comms (demo fault)
            </Text>
            <View className="gap-2">
              {CHARGER_IDS.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => onSetFault(id, !hub.chargerFaults[id])}
                  className={`rounded-xl border-2 px-4 py-3 ${hub.chargerFaults[id] ? 'border-amber-600 bg-amber-50' : 'border-foreground'}`}
                >
                  <Text className="font-serif text-xl">{id}</Text>
                  <Text className="text-muted-foreground text-sm">
                    {hub.chargerFaults[id]
                      ? 'Comms fault — charger queues locally'
                      : 'Comms OK — sessions stream to hub'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }: { item: ChargeSession }) => (
          <View className="border-foreground mx-5 mb-2 rounded-xl border-2 px-4 py-3">
            <Text className="font-serif text-xl">
              {item.chargerId} · {item.energyKwh.toFixed(1)} kWh
            </Text>
            <Text className="text-muted-foreground text-sm">
              {item.cardLabel} · {item.chargerLabel}
            </Text>
            <Text className="text-muted-foreground font-mono text-[10px]">
              {item.sessionId} · {Math.round((now - item.endedAt) / 1000)}s ago
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-muted-foreground px-5 py-8 text-center text-sm">
            No sessions on hub yet — run a charge on a charger phone.
          </Text>
        }
      />
      <DebugStrip
        lines={[
          `sessions: ${hub.sessions.length}`,
          `awaiting cms: ${awaiting}`,
          `cms rows: ${cmsTotal}`,
          `dupes dropped: ${hub.cmsDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
