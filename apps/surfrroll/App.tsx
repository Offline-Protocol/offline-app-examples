import '@offline-app-examples/ui/global.css';
import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_CLIENT, EMPLOYEE_ROSTER, signInEmployee, type EmployeeSession } from './src/domain/roster';
import { SurfrFlow, type SurfrRole } from './src/flows/SurfrFlow';
import { SurfrHero } from './src/ui/illustrations';

type Setup = {
  role: SurfrRole;
  consoleName: string;
  employee: EmployeeSession | null;
};

export default function App() {
  const [setup, setSetup] = useState<Setup | null>(null);

  if (setup) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <SurfrFlow
          role={setup.role}
          consoleName={setup.consoleName}
          employee={setup.employee}
          onLeave={() => setSetup(null)}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <HomeLobby onStart={setSetup} />
    </SafeAreaProvider>
  );
}

function HomeLobby({ onStart }: { onStart: (setup: Setup) => void }) {
  const [role, setRole] = useState<SurfrRole>('soc');
  const [name, setName] = useState('Mumbai SOC');
  const [employeeId, setEmployeeId] = useState(EMPLOYEE_ROSTER[0].employeeId);
  const [pin, setPin] = useState('');

  const defaults: Record<SurfrRole, string> = {
    soc: 'Mumbai SOC',
    staff: EMPLOYEE_ROSTER[0].displayName,
    relay: 'Campus relay',
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="font-serif text-4xl">SurfrRoll</Text>
        <Text className="text-muted-foreground mt-2 text-base leading-6">
          {DEMO_CLIENT.name} — last mile for MitKat DataSurfr. Signed incident alerts and employee roll
          call hop over Bluetooth mesh when cell and internet fail; check-ins reconcile to a mock SOC
          when the cloud link returns (SDK 0.28).
        </Text>
        <View className="my-6 items-center">
          <SurfrHero size={160} />
        </View>
        <RolePick
          options={[
            {
              id: 'soc',
              title: 'SOC console',
              hint: 'Receive DataSurfr alerts, fan out signed incident, upload roll call',
            },
            {
              id: 'staff',
              title: 'Staff handset',
              hint: 'Verify alert, tap safe / help / SOS over mesh',
            },
            {
              id: 'relay',
              title: 'Mesh relay',
              hint: 'Extend range when only one phone has internet',
            },
          ]}
          selected={role}
          onSelect={(id) => {
            const r = id as SurfrRole;
            setRole(r);
            setName(defaults[r]);
            if (r === 'staff') {
              setEmployeeId(EMPLOYEE_ROSTER[0].employeeId);
              setPin('');
            }
          }}
        />
        {role === 'staff' ? (
          <>
            <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
              Employee (demo roster)
            </Text>
            <View className="mb-3 gap-2">
              {EMPLOYEE_ROSTER.map((e) => (
                <Pressable
                  key={e.employeeId}
                  onPress={() => {
                    setEmployeeId(e.employeeId);
                    setName(e.displayName);
                    setPin('');
                  }}
                  className={`rounded-xl border-2 px-4 py-3 ${employeeId === e.employeeId ? 'border-foreground bg-muted' : 'border-muted'}`}
                >
                  <Text className="font-serif text-lg">{e.displayName}</Text>
                  <Text className="text-muted-foreground text-sm">
                    {e.office} · PIN on card
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
              PIN
            </Text>
            <TextInput
              className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3"
              value={pin}
              onChangeText={setPin}
              placeholder="Demo PIN"
              keyboardType="number-pad"
              secureTextEntry
            />
          </>
        ) : null}
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Device label
        </Text>
        <TextInput
          className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3"
          value={name}
          onChangeText={setName}
          placeholder={defaults[role]}
        />
        <Button
          disabled={role === 'staff' && !signInEmployee(employeeId, pin)}
          onPress={() => {
            if (role === 'staff') {
              const session = signInEmployee(employeeId, pin);
              if (!session) return;
              onStart({
                role,
                consoleName: session.displayName,
                employee: session,
              });
              return;
            }
            onStart({
              role,
              consoleName: name.trim() || defaults[role],
              employee: null,
            });
          }}
        >
          <Text>Start</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function RolePick({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; title: string; hint: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="my-4 gap-2">
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onSelect(o.id)}
          className={`rounded-xl border-2 px-4 py-3 ${selected === o.id ? 'border-foreground bg-muted' : 'border-muted'}`}
        >
          <Text className="font-serif text-xl">{o.title}</Text>
          <Text className="text-muted-foreground text-sm">{o.hint}</Text>
        </Pressable>
      ))}
    </View>
  );
}
