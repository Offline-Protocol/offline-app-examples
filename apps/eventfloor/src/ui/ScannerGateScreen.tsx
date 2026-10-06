import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScannerState } from '../domain/admission';
import { SEEDED_TICKETS } from '../domain/tickets';
import { DebugStrip, TopBar } from './common';

export function ScannerGateScreen({
  gateName,
  scanner,
  people,
  onScan,
  onLeave,
  me,
}: {
  gateName: string;
  scanner: ScannerState;
  people: { id: string; name: string }[];
  onScan: (ticketId: string) => void;
  onLeave: () => void;
  me: { id: string; name: string };
}) {
  const result = scanner.lastResult;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Gate scanner" title={gateName} people={[me, ...people]} onLeave={onLeave} />
      <ScrollView className="flex-1 px-5 py-4">
        <Text className="text-muted-foreground mb-4 text-sm">
          Scan a seeded ticket id. Admissions sync from the lead scanner over Bluetooth mesh — no
          cellular required at the gate.
        </Text>
        {result ? (
          <View
            className={`mb-4 rounded-xl border-2 px-4 py-3 ${
              result.outcome === 'admitted'
                ? 'border-emerald-600 bg-emerald-50'
                : result.outcome === 'already_used'
                  ? 'border-amber-600 bg-amber-50'
                  : 'border-red-600 bg-red-50'
            }`}
          >
            <Text className="font-serif text-xl capitalize">
              {result.outcome.replace('_', ' ')}
            </Text>
            {result.outcome === 'admitted' || result.outcome === 'already_used' ? (
              <Text className="text-muted-foreground mt-1 text-sm">
                {result.record.ticketId} · {result.record.gateName}
              </Text>
            ) : result.outcome === 'unknown_ticket' ? (
              <Text className="text-muted-foreground mt-1 text-sm">{result.ticketId}</Text>
            ) : (
              <Text className="text-muted-foreground mt-1 text-sm">{result.reason}</Text>
            )}
          </View>
        ) : null}
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Seeded tickets
        </Text>
        <View className="gap-2">
          {SEEDED_TICKETS.map((t) => (
            <Pressable
              key={t.ticketId}
              onPress={() => onScan(t.ticketId)}
              className="border-foreground rounded-xl border-2 px-4 py-3"
            >
              <Text className="font-serif text-xl">{t.ticketId}</Text>
              <Text className="text-muted-foreground text-sm">
                {t.holder} · Section {t.section}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button className="mt-4" onPress={() => onScan('T-9999')}>
          <Text>Try unknown ticket</Text>
        </Button>
      </ScrollView>
      <DebugStrip
        lines={[
          `ledger entries: ${scanner.admissions.length}`,
          `pending mesh: ${scanner.pendingScanIds.length}`,
          `dupes dropped: ${scanner.platformDuplicatesDropped}`,
        ]}
      />
    </SafeAreaView>
  );
}
