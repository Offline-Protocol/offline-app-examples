import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DOCKS, type Dock, type Handoff } from '../domain/handoff';
import { HandoffCard, TopBar, useNow } from './common';

type Person = { id: string; name: string };

export function YardScreen({
  yardName,
  people,
  handoffs,
  syncedIds,
  onAssign,
  onLeave,
}: {
  yardName: string;
  people: Person[];
  handoffs: Handoff[];
  syncedIds: string[];
  onAssign: (handoffId: string, dock: Dock) => void;
  onLeave: () => void;
}) {
  const now = useNow();
  // Waiting check-ins first, then the rest newest first.
  const ordered = [...handoffs]
    .reverse()
    .sort((a, b) => Number(!!a.assignment) - Number(!!b.assignment));

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <TopBar
        eyebrow="Dock office"
        title={yardName}
        people={people}
        onLeave={onLeave}
      />
      <FlatList
        className="flex-1"
        data={ordered}
        keyExtractor={(h) => h.handoffId}
        contentContainerClassName="gap-3 px-5 pb-4 grow"
        ListHeaderComponent={
          <Text className="text-muted-foreground py-3 text-sm">
            Drivers check in over Bluetooth. Only check-ins whose signature
            matches the sending phone appear here.
          </Text>
        }
        ListEmptyComponent={
          <Text className="text-muted-foreground py-8 text-center">
            Waiting for drivers to check in…
          </Text>
        }
        renderItem={({ item }) => (
          <HandoffCard
            handoff={item}
            now={now}
            synced={syncedIds.includes(item.handoffId)}
          >
            {!item.assignment ? (
              <View className="mt-3 gap-2">
                <Text className="text-xs font-bold uppercase tracking-widest">
                  Assign a dock
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DOCKS.map((dock) => (
                    <Button
                      key={dock}
                      size="sm"
                      variant="outline"
                      onPress={() => onAssign(item.handoffId, dock)}
                    >
                      <Text>{dock}</Text>
                    </Button>
                  ))}
                </View>
              </View>
            ) : null}
          </HandoffCard>
        )}
      />
    </SafeAreaView>
  );
}
