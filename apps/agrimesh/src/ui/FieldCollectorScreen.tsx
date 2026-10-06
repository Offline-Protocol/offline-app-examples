import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FieldState } from '../domain/ledger';
import { DEMO_FARM, DEMO_READING_TEMPLATES } from '../domain/plots';
import { DebugStrip, TopBar } from './common';

export function FieldCollectorScreen({
  collectorName,
  field,
  people,
  onLog,
  onLeave,
  me,
}: {
  collectorName: string;
  field: FieldState;
  people: { id: string; name: string }[];
  onLog: (template: (typeof DEMO_READING_TEMPLATES)[number]) => void;
  onLeave: () => void;
  me: { id: string; name: string };
}) {
  const pending = field.pendingReadingIds.length;
  const onOffice = field.readings.length;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar
        eyebrow="Field collector"
        title={collectorName}
        people={[me, ...people]}
        onLeave={onLeave}
      />
      <ScrollView className="flex-1 px-5 py-4" contentContainerClassName="gap-3 pb-8">
        <Text className="text-muted-foreground text-sm leading-5">
          {DEMO_FARM.name}. Log small batches here — they hop across mesh to the office-edge phone.
          No cloud until the office syncs.
        </Text>
        {DEMO_READING_TEMPLATES.map((t) => (
          <Pressable
            key={`${t.plotId}-${t.kind}-${t.label}`}
            onPress={() => onLog(t)}
            className="border-foreground rounded-xl border-2 px-4 py-4"
          >
            <Text className="font-serif text-xl">{t.label}</Text>
            <Text className="text-muted-foreground font-mono text-xs">
              {t.plotId} · {t.value}
              {t.unit}
            </Text>
          </Pressable>
        ))}
        {field.lastLogged ? (
          <View className="bg-muted/50 mt-2 rounded-xl px-4 py-3">
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              Last logged
            </Text>
            <Text className="font-serif text-lg">
              {field.lastLogged.plotName} — {field.lastLogged.value}
              {field.lastLogged.unit}
            </Text>
            <Text className="text-muted-foreground font-mono text-[10px]">
              {field.lastLogged.readingId}
            </Text>
          </View>
        ) : null}
        <Button variant="outline" disabled>
          <Text>Custom entry (use templates in demo)</Text>
        </Button>
      </ScrollView>
      <DebugStrip
        lines={[
          `pending hop: ${pending}`,
          `on office ledger: ${onOffice}`,
          `office synced ids: ${field.syncedReadingIds.length}`,
        ]}
      />
    </SafeAreaView>
  );
}
