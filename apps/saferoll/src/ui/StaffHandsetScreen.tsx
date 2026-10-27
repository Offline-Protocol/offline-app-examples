import { Button, Text } from '@offline-app-examples/ui';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EmployeeSession } from '../domain/roster';
import type { CheckInStatus, StaffHandsetState } from '../domain/rollcall';
import { DebugStrip, TopBar } from './common';

export function StaffHandsetScreen({
  employee,
  staff,
  people,
  me,
  onCheckIn,
  onLeave,
}: {
  employee: EmployeeSession;
  staff: StaffHandsetState;
  people: { id: string; name: string }[];
  me: { id: string; name: string };
  onCheckIn: (status: CheckInStatus) => void;
  onLeave: () => void;
}) {
  const alert = staff.activeAlert;
  const responded = Boolean(staff.myCheckIn);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <TopBar eyebrow="Staff handset" title={employee.displayName} people={[me, ...people]} onLeave={onLeave} />
      <View className="flex-1 gap-4 px-6 py-4">
        <Text className="text-muted-foreground text-sm leading-6">
          {employee.office} · {employee.role}. Works in airplane mode once the signed alert reaches this
          device over mesh.
        </Text>

        {!alert ? (
          <View className="flex-1 items-center justify-center">
            <Text className="font-serif text-center text-2xl">Waiting for alert</Text>
            <Text className="text-muted-foreground mt-2 text-center text-base">
              SOC must publish a signed Northwind alert. Stay on this mesh session.
            </Text>
          </View>
        ) : !staff.alertTrusted ? (
          <View className="border-destructive flex-1 rounded-xl border-2 bg-red-50 px-4 py-6">
            <Text className="text-destructive font-serif text-2xl">Unverified alert blocked</Text>
            <Text className="text-muted-foreground mt-2 text-base leading-6">
              Signature check failed — rumour and spoof alerts cannot pass as official Northwind Alerts traffic
              in this demo.
            </Text>
          </View>
        ) : (
          <>
            <View className="border-destructive rounded-xl border-2 bg-red-50 px-4 py-4">
              <Text className="text-destructive text-xs font-bold uppercase tracking-widest">
                Verified · {alert.severity}
              </Text>
              <Text className="font-serif text-2xl">{alert.title}</Text>
              <Text className="text-muted-foreground mt-2 text-sm leading-5">{alert.body}</Text>
              <Text className="text-muted-foreground mt-2 font-mono text-[10px]">{alert.signature}</Text>
            </View>

            {responded && staff.myCheckIn ? (
              <View className="border-foreground rounded-xl border-2 px-4 py-4">
                <Text className="font-serif text-xl">Response recorded</Text>
                <Text className="text-muted-foreground mt-1 text-sm">
                  {staff.myCheckIn.status === 'safe'
                    ? 'Marked safe'
                    : staff.myCheckIn.status === 'help'
                      ? 'Need help — SOC notified via mesh'
                      : 'SOS — priority roll call'}
                </Text>
                {staff.pendingCheckInIds.length > 0 ? (
                  <Text className="text-muted-foreground mt-2 text-xs">Syncing to SOC…</Text>
                ) : null}
              </View>
            ) : (
              <View className="gap-3">
                <Text className="font-serif text-xl">Check in</Text>
                <Button onPress={() => onCheckIn('safe')}>
                  <Text>I&apos;m safe</Text>
                </Button>
                <Button variant="outline" onPress={() => onCheckIn('help')}>
                  <Text>Need help</Text>
                </Button>
                <Button variant="destructive" onPress={() => onCheckIn('sos')}>
                  <Text>SOS</Text>
                </Button>
              </View>
            )}
          </>
        )}
      </View>
      <DebugStrip
        lines={[
          `mesh rev: ${staff.rev}`,
          `alert trusted: ${staff.alertTrusted}`,
          `pending: ${staff.pendingCheckInIds.length}`,
          `cloud on SOC: ${staff.cloudLinkOnline}`,
        ]}
      />
    </SafeAreaView>
  );
}
