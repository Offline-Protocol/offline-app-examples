import '@offline-app-examples/ui/global.css';
import { Button, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GateFlow, type GateRole } from './src/flows/GateFlow';
import { StaffFlow, type StaffRole } from './src/flows/StaffFlow';
import { signInStaff, STAFF_ROSTER, type StaffSession } from './src/domain/staff';
import { DEMO_EVENT } from './src/domain/tickets';
import { EventHero } from './src/ui/illustrations';

type Flow = 'home' | 'staff' | 'gate';
type StaffSetup = { role: StaffRole; session: StaffSession | null; label: string };
type GateSetup = { role: GateRole; gateName: string };

export default function App() {
  const [flow, setFlow] = useState<Flow>('home');
  const [staffSetup, setStaffSetup] = useState<StaffSetup | null>(null);
  const [gateSetup, setGateSetup] = useState<GateSetup | null>(null);

  if (flow === 'staff' && staffSetup) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <StaffFlow
          role={staffSetup.role}
          session={staffSetup.session}
          displayName={staffSetup.label}
          onLeave={() => {
            setFlow('home');
            setStaffSetup(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (flow === 'gate' && gateSetup) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <GateFlow
          role={gateSetup.role}
          gateName={gateSetup.gateName}
          onLeave={() => {
            setFlow('home');
            setGateSetup(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <HomeLobby
        onStaff={(setup) => {
          setStaffSetup(setup);
          setFlow('staff');
        }}
        onGate={(setup) => {
          setGateSetup(setup);
          setFlow('gate');
        }}
      />
    </SafeAreaProvider>
  );
}

function HomeLobby({
  onStaff,
  onGate,
}: {
  onStaff: (setup: StaffSetup) => void;
  onGate: (setup: GateSetup) => void;
}) {
  const [mode, setMode] = useState<'pick' | 'staff' | 'gate'>('pick');

  if (mode === 'staff') {
    return <StaffLobby onBack={() => setMode('pick')} onStart={onStaff} />;
  }
  if (mode === 'gate') {
    return <GateLobby onBack={() => setMode('pick')} onStart={onGate} />;
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="font-serif text-4xl">Event Floor</Text>
        <Text className="text-muted-foreground mt-2 text-base leading-6">
          {DEMO_EVENT.name} — offline-capable staff dispatch and gate admission over Bluetooth mesh
          (SDK 0.28).
        </Text>
        <View className="my-6 items-center">
          <EventHero size={160} />
        </View>
        <Pressable
          onPress={() => setMode('staff')}
          className="border-foreground mb-3 rounded-xl border-2 px-4 py-4"
        >
          <Text className="font-serif text-2xl">Flow A — Staff dispatch</Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            MLS staff group, crowd relay, demo staff sign-in
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('gate')}
          className="border-foreground rounded-xl border-2 px-4 py-4"
        >
          <Text className="font-serif text-2xl">Flow B — Gate sync</Text>
          <Text className="text-muted-foreground mt-1 text-sm">
            Shared admission ledger + mock platform ingest with scanId dedupe
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StaffLobby({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (setup: StaffSetup) => void;
}) {
  const [role, setRole] = useState<StaffRole>('sender');
  const [staffId, setStaffId] = useState(STAFF_ROSTER[0].staffId);
  const [pin, setPin] = useState('');
  const [relayName, setRelayName] = useState('Crowd relay');
  const [error, setError] = useState('');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Button variant="outline" size="sm" onPress={onBack}>
          <Text>Back</Text>
        </Button>
        <Text className="font-serif mt-4 text-3xl">Staff channel</Text>
        <RolePick
          options={[
            { id: 'sender', title: 'Staff sender', hint: 'Hosts encrypted staff group' },
            { id: 'receiver', title: 'Staff receiver', hint: 'Receives and acks alerts' },
            { id: 'relay', title: 'Crowd relay', hint: 'Forward only — no staff sign-in' },
          ]}
          selected={role}
          onSelect={(id) => setRole(id as StaffRole)}
        />
        {role === 'relay' ? (
          <>
            <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
              Relay label
            </Text>
            <TextInput
              className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3"
              value={relayName}
              onChangeText={setRelayName}
              placeholder="Crowd relay"
            />
          </>
        ) : (
          <StaffSignIn staffId={staffId} onStaffId={setStaffId} pin={pin} onPin={setPin} />
        )}
        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
        <Button
          className="mt-4"
          onPress={() => {
            if (role === 'relay') {
              onStart({ role, session: null, label: relayName.trim() || 'Relay' });
              return;
            }
            const session = signInStaff(staffId, pin);
            if (!session) {
              setError('Invalid staff PIN for this demo roster.');
              return;
            }
            setError('');
            onStart({ role, session, label: session.displayName });
          }}
        >
          <Text>Start</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function GateLobby({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (setup: GateSetup) => void;
}) {
  const [role, setRole] = useState<GateRole>('host');
  const [gateName, setGateName] = useState('North gate');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Button variant="outline" size="sm" onPress={onBack}>
          <Text>Back</Text>
        </Button>
        <Text className="font-serif mt-4 text-3xl">Admissions</Text>
        <RolePick
          options={[
            { id: 'host', title: 'Lead scanner', hint: 'Authoritative admission ledger' },
            { id: 'scanner', title: 'Gate scanner', hint: 'Joins lead, scans tickets' },
            { id: 'relay', title: 'Gate relay', hint: 'Optional hop between scanners' },
          ]}
          selected={role}
          onSelect={(id) => setRole(id as GateRole)}
        />
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Gate name
        </Text>
        <TextInput
          className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3"
          value={gateName}
          onChangeText={setGateName}
          placeholder="North gate"
        />
        <Button
          onPress={() =>
            onStart({ role, gateName: gateName.trim() || (role === 'host' ? 'Lead gate' : 'Gate') })
          }
        >
          <Text>Start</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function StaffSignIn({
  staffId,
  onStaffId,
  pin,
  onPin,
}: {
  staffId: string;
  onStaffId: (id: string) => void;
  pin: string;
  onPin: (p: string) => void;
}) {
  return (
    <View className="mt-4 gap-3">
      <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
        Demo staff sign-in (OfflineID stand-in)
      </Text>
      {STAFF_ROSTER.map((s) => (
        <Pressable
          key={s.staffId}
          onPress={() => onStaffId(s.staffId)}
          className={`rounded-lg border-2 px-3 py-2 ${staffId === s.staffId ? 'border-foreground bg-muted' : 'border-muted'}`}
        >
          <Text>{s.displayName}</Text>
          <Text className="text-muted-foreground font-mono text-xs">PIN {s.pin}</Text>
        </Pressable>
      ))}
      <TextInput
        className="border-foreground text-foreground rounded-lg border-2 px-3 py-3"
        value={pin}
        onChangeText={onPin}
        placeholder="Enter PIN"
        keyboardType="number-pad"
        secureTextEntry
      />
    </View>
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
