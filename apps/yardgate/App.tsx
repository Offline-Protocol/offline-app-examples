import '@offline-app-examples/ui/global.css';
import { Button, Text } from '@offline-app-examples/ui';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  CHECKIN_METHOD,
  encodeCheckIn,
  encodeDecision,
  encodeServiceError,
  emptyDriver,
  emptyGate,
  findDecision,
  gateReducer,
  newCheckInId,
  parseCheckIn,
  parseDecision,
  parseServiceError,
  SEEDED_LOADS,
  SERVICE_STATUS_ERROR,
  SERVICE_STATUS_OK,
  type DriverState,
  type GateState,
  type PendingCheckIn,
} from './src/domain/checkin';
import type { YardRole } from './src/mesh/gateSession';
import { useGateSession } from './src/mesh/useGateSession';
import { DriverScreen } from './src/ui/DriverScreen';
import { GateScreen } from './src/ui/GateScreen';
import { RelayScreen } from './src/ui/RelayScreen';
import { YardHero } from './src/ui/illustrations';

const APP_ID = 'yardgate';

export default function App() {
  const [name, setName] = useState('');
  const [pickedRole, setPickedRole] = useState<YardRole | null>(null);
  const [gate, setGate] = useState<GateState>(emptyGate);
  const [driver, setDriver] = useState<DriverState>(emptyDriver);
  const [gateActionError, setGateActionError] = useState('');
  const [selectedLoadIndex, setSelectedLoadIndex] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const pendingRequestIds = useRef<Map<string, string>>(new Map());
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const sessionRef = useRef<{
    respondToCheckIn: (
      requestId: string,
      requester: string,
      status: string,
      body: string,
    ) => Promise<void>;
    start: (role: YardRole, displayName: string) => Promise<void>;
    leave: () => Promise<void>;
    submitCheckIn: (providerId: string, body: string) => Promise<string>;
    displayName: string;
    providers: { id: string }[];
  } | null>(null);

  const respondGate = useCallback(
    (requestId: string, requester: string, status: string, body: string) =>
      sessionRef.current?.respondToCheckIn(requestId, requester, status, body),
    [],
  );

  const respondWithDecision = useCallback(
    async (item: PendingCheckIn, decision: 'approved' | 'denied', gateOfficer: string) => {
      setGateActionError('');
      const at = Date.now();
      const body = encodeDecision({
        checkInId: item.checkInId,
        decision,
        gateOfficer,
        at,
        note: decision === 'denied' ? 'See gate officer' : undefined,
      });
      try {
        await sessionRef.current?.respondToCheckIn(
          item.requestId,
          item.sender,
          SERVICE_STATUS_OK,
          body,
        );
        const next = gateReducer(gateRef.current, {
          type: 'decide',
          checkInId: item.checkInId,
          decision,
          gateOfficer,
          at,
        });
        gateRef.current = next;
        setGate(next);
      } catch (e) {
        setGateActionError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  const yard = useGateSession(APP_ID, {
    onCheckInRequest: ({ requestId, sender, method, body }) => {
      setGateActionError('');
      if (method !== CHECKIN_METHOD) {
        void respondGate(
          requestId,
          sender,
          SERVICE_STATUS_ERROR,
          encodeServiceError('unsupported_method'),
        );
        return;
      }
      const payload = parseCheckIn(body);
      if (!payload) {
        void respondGate(
          requestId,
          sender,
          SERVICE_STATUS_ERROR,
          encodeServiceError('invalid_check_in'),
        );
        return;
      }
      const existing = findDecision(gateRef.current, payload.checkInId);
      if (existing) {
        const next = gateReducer(gateRef.current, { type: 'duplicate_response' });
        gateRef.current = next;
        setGate(next);
        void respondGate(requestId, sender, SERVICE_STATUS_OK, encodeDecision(existing));
        return;
      }
      const next = gateReducer(gateRef.current, {
        type: 'request_received',
        requestId,
        sender,
        payload,
        at: Date.now(),
      });
      gateRef.current = next;
      setGate(next);
    },
    onCheckInResponse: ({ requestId, status, body }) => {
      const checkInId = pendingRequestIds.current.get(requestId);
      pendingRequestIds.current.delete(requestId);

      if (status !== SERVICE_STATUS_OK) {
        const message =
          parseServiceError(body) ?? `Gate responded with status "${status}". Try again.`;
        setDriver({
          status: 'error',
          lastCheckInId: checkInId ?? null,
          lastDecision: null,
          error: message,
        });
        return;
      }

      const decision = parseDecision(body);
      if (!decision) {
        setDriver({
          status: 'error',
          lastCheckInId: checkInId ?? null,
          lastDecision: null,
          error: 'Invalid gate response',
        });
        return;
      }
      if (checkInId && decision.checkInId !== checkInId) return;
      setDriver({
        status: 'done',
        lastCheckInId: decision.checkInId,
        lastDecision: decision,
        error: '',
      });
    },
  });

  sessionRef.current = yard;

  const me = { id: yard.localId || 'me', name: name.trim() || 'You' };

  async function enterRole(role: YardRole) {
    setPickedRole(role);
    setGate(emptyGate());
    setDriver(emptyDriver());
    setGateActionError('');
    pendingRequestIds.current.clear();
    await yard.start(role, name.trim() || role);
  }

  async function leave() {
    await yard.leave();
    setPickedRole(null);
    setSelectedProviderId(null);
    setGate(emptyGate());
    setDriver(emptyDriver());
    setGateActionError('');
    pendingRequestIds.current.clear();
  }

  async function submitCheckIn() {
    const providerId = selectedProviderId ?? yard.providers[0]?.id;
    if (!providerId) {
      setDriver((d) => ({ ...d, status: 'error', error: 'Pick a gate from the list.' }));
      return;
    }
    const load = SEEDED_LOADS[selectedLoadIndex] ?? SEEDED_LOADS[0];
    const checkInId = newCheckInId();
    const payload = {
      checkInId,
      loadId: load.loadId,
      trailerId: load.trailerId,
      driverName: name.trim().slice(0, 40) || 'Driver',
      createdAt: Date.now(),
    };
    setDriver({ ...emptyDriver(), status: 'submitting', lastCheckInId: checkInId });
    try {
      const requestId = await yard.submitCheckIn(providerId, encodeCheckIn(payload));
      pendingRequestIds.current.set(requestId, checkInId);
      setDriver((d) => ({ ...d, status: 'waiting' }));
    } catch (e) {
      setDriver({
        ...emptyDriver(),
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let screen: React.ReactNode;

  if (yard.status === 'active' && pickedRole === 'gate') {
    screen = (
      <GateScreen
        gateName={yard.displayName || 'Gate'}
        gate={gate}
        gateActionError={gateActionError}
        neighbors={yard.neighborCount}
        me={me}
        onApprove={(item) => void respondWithDecision(item, 'approved', yard.displayName || 'Gate')}
        onDeny={(item) => void respondWithDecision(item, 'denied', yard.displayName || 'Gate')}
        onLeave={() => void leave()}
      />
    );
  } else if (yard.status === 'active' && pickedRole === 'driver') {
    screen = (
      <DriverScreen
        driverName={yard.displayName || 'Driver'}
        providers={yard.providers}
        driver={driver}
        neighbors={yard.neighborCount}
        selectedLoadIndex={selectedLoadIndex}
        onSelectLoad={setSelectedLoadIndex}
        selectedProviderId={selectedProviderId ?? yard.providers[0]?.id ?? null}
        onSelectProvider={setSelectedProviderId}
        onSubmit={() => void submitCheckIn()}
        onLeave={() => void leave()}
        me={me}
      />
    );
  } else if (yard.status === 'active' && pickedRole === 'relay') {
    screen = (
      <RelayScreen
        relayName={yard.displayName || 'Relay'}
        neighbors={yard.neighborCount}
        me={me}
        onLeave={() => void leave()}
      />
    );
  } else {
    screen = (
      <Lobby
        name={name}
        onNameChange={setName}
        pickedRole={pickedRole}
        onPickRole={setPickedRole}
        starting={yard.status === 'starting'}
        error={yard.error}
        onStart={() => pickedRole && void enterRole(pickedRole)}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {screen}
    </SafeAreaProvider>
  );
}

function Lobby({
  name,
  onNameChange,
  pickedRole,
  onPickRole,
  starting,
  error,
  onStart,
}: {
  name: string;
  onNameChange: (v: string) => void;
  pickedRole: YardRole | null;
  onPickRole: (r: YardRole) => void;
  starting: boolean;
  error: string;
  onStart: () => void;
}) {
  const roles: { id: YardRole; title: string; hint: string }[] = [
    { id: 'gate', title: 'Gate officer', hint: 'Runs the gate check-in service' },
    { id: 'driver', title: 'Driver', hint: 'Discovers gate and submits load ID' },
    { id: 'relay', title: 'Yard relay', hint: 'Middle phone when driver is out of gate range' },
  ];

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-6 pt-4">
        <Text className="font-serif text-4xl">YardGate</Text>
        <Text className="text-muted-foreground mt-2 text-base leading-6">
          Yard check-in with no cellular: drivers discover the gate service over Bluetooth mesh; the
          gate officer approves or denies on their device.
        </Text>
        <View className="my-6 items-center">
          <YardHero size={160} />
        </View>
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Your name
        </Text>
        <TextInput
          className="border-foreground text-foreground mb-4 rounded-lg border-2 px-3 py-3 text-base"
          value={name}
          onChangeText={onNameChange}
          placeholder="Name on this device"
          placeholderTextColor="#737373"
        />
        <Text className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          Role
        </Text>
        <View className="gap-2">
          {roles.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onPickRole(r.id)}
              className={`rounded-xl border-2 px-4 py-3 ${
                pickedRole === r.id ? 'border-foreground bg-muted' : 'border-muted'
              }`}
            >
              <Text className="font-serif text-xl">{r.title}</Text>
              <Text className="text-muted-foreground text-sm">{r.hint}</Text>
            </Pressable>
          ))}
        </View>
        {starting ? <Text className="text-muted-foreground mt-4 text-center">Starting mesh…</Text> : null}
        {error ? <Text className="text-destructive mt-2 text-sm">{error}</Text> : null}
        <View className="mt-6">
          <Button disabled={!pickedRole || !name.trim() || starting} onPress={onStart}>
            <Text>Start</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
