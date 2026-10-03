import { Button, Icon, Text } from '@offline-app-examples/ui';
import { Check, CloudUpload } from 'lucide-react-native';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CommandState, FieldRecord } from '../domain/ops';
import { DebugStrip, timeAgo, TopBar, useNow } from './common';

type Person = { id: string; name: string };

export function CommandScreen({
  postName,
  command,
  hqTotal,
  people,
  onSyncHq,
  onAcceptHandoff,
  onLeave,
}: {
  postName: string;
  command: CommandState;
  hqTotal: number;
  people: Person[];
  onSyncHq: () => void;
  onAcceptHandoff: (operationId: string) => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const pendingHandoffs = command.records.filter(
    (r) => r.kind === 'handoff' && r.state === 'pending',
  );

  const listHeader = (
    <View className="gap-2 pb-2">
      <View className="flex-row gap-2 px-5 pt-3">
        <Button className="flex-1" onPress={onSyncHq}>
          <Icon as={CloudUpload} size={18} className="text-primary-foreground" />
          <Text>Sync to HQ (mock)</Text>
        </Button>
      </View>
      <View className="px-5">
        <Text className="text-muted-foreground text-sm">
          Bluetooth mesh · no cloud required for field updates
        </Text>
      </View>
      {pendingHandoffs.length > 0 && (
        <View className="border-foreground mx-5 rounded-md border-2 bg-amber-100 p-3">
          <Text className="font-bold">Pending handoffs</Text>
          {pendingHandoffs.map((h) => (
            <View
              key={h.operationId}
              className="mt-2 flex-row items-center justify-between gap-2"
            >
              <Text className="flex-1 text-sm">
                {h.kind === 'handoff' ? h.note : ''}
              </Text>
              <Button size="sm" onPress={() => onAcceptHandoff(h.operationId)}>
                <Icon as={Check} size={16} />
                <Text>Accept</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <TopBar
        eyebrow="Command post"
        title={postName}
        people={people}
        onLeave={onLeave}
      />
      <FlatList
        className="flex-1"
        data={[...command.records].reverse()}
        keyExtractor={(item) => item.operationId}
        contentContainerClassName="px-5 pb-4 gap-3 grow"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text className="text-muted-foreground py-8 text-center">
            Waiting for field updates…
          </Text>
        }
        renderItem={({ item }) => (
          <RecordCard record={item} now={now} synced={command.syncedIds.includes(item.operationId)} />
        )}
      />
      <DebugStrip
        pending={pendingHandoffs.length}
        synced={command.syncedIds.length}
        duplicatesDropped={command.hqDuplicatesDropped}
        hqTotal={hqTotal}
      />
    </SafeAreaView>
  );
}

function RecordCard({
  record,
  now,
  synced,
}: {
  record: FieldRecord;
  now: number;
  synced: boolean;
}) {
  const title =
    record.kind === 'status'
      ? record.text
      : `Handoff: ${record.note}`;
  return (
    <View className="border-foreground rounded-md border-2 bg-white p-3">
      <Text className="text-muted-foreground text-xs font-bold uppercase">
        {record.sector} · {record.authorName || 'Field'}
      </Text>
      <Text className="text-foreground mt-1 text-base">{title}</Text>
      {record.kind === 'handoff' && (
        <Text className="text-foreground mt-1 text-sm font-semibold">
          {record.state === 'pending'
            ? 'Pending acceptance'
            : `Accepted by ${record.acceptedByName ?? 'peer'}`}
        </Text>
      )}
      <Text className="text-muted-foreground mt-2 font-mono text-[10px]">
        {record.operationId} · {timeAgo(record.createdAt, now)}
        {synced ? ' · on HQ' : ''}
      </Text>
    </View>
  );
}
