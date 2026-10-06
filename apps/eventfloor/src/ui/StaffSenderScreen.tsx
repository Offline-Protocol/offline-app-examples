import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STAFF_SECTIONS, type StaffAlert, type StaffSession } from '../domain/staff';
import { DebugStrip, TopBar } from './common';

export function StaffSenderScreen({
  session,
  me,
  people,
  alerts,
  onSend,
  onLeave,
}: {
  session: StaffSession;
  me: { id: string; name: string };
  people: { id: string; name: string }[];
  alerts: StaffAlert[];
  onSend: (section: string, body: string) => void;
  onLeave: () => void;
}) {
  const [section, setSection] = useState<string>(STAFF_SECTIONS[1]);
  const [body, setBody] = useState('Medic needed — guest assist');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Staff dispatch" title={session.displayName} people={[me, ...people]} onLeave={onLeave} />
      <ScrollView className="flex-1 px-5 py-4">
        <Text className="text-muted-foreground mb-3 text-sm">
          MLS-encrypted staff channel over Bluetooth mesh. Crowd relay phones forward traffic but
          cannot read staff payloads.
        </Text>
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Section
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {STAFF_SECTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              className={`rounded-lg border-2 px-3 py-2 ${section === s ? 'border-foreground bg-muted' : 'border-muted'}`}
            >
              <Text className="text-sm">{s}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Alert
        </Text>
        {['Medic needed — guest assist', 'Security backup', 'Crowd surge — need ushers'].map(
          (preset) => (
            <Pressable
              key={preset}
              onPress={() => setBody(preset)}
              className={`mb-2 rounded-lg border-2 px-3 py-2 ${body === preset ? 'border-foreground bg-muted' : 'border-muted'}`}
            >
              <Text>{preset}</Text>
            </Pressable>
          ),
        )}
        <Button className="mt-4" onPress={() => onSend(section, body)}>
          <Text>Send staff alert</Text>
        </Button>
        {alerts.length > 0 ? (
          <View className="mt-6 gap-2">
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              Sent
            </Text>
            {alerts.slice(-3).reverse().map((a) => (
              <Text key={a.alertId} className="font-mono text-xs">
                {a.section}: {a.body}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <DebugStrip
        lines={[
          `staff unit: ${session.unit}`,
          `peers: ${people.length}`,
          `alerts sent: ${alerts.length}`,
        ]}
      />
    </SafeAreaView>
  );
}
