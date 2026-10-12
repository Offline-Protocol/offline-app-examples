import { Button, Icon, Input, Text } from '@offline-app-examples/ui';
import { Send } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Handoff, Load, Vehicle } from '../domain/handoff';
import { Chips, HandoffCard, TopBar, useNow } from './common';

type Person = { id: string; name: string };

export function DriverScreen({
  yardName,
  people,
  reconnecting,
  vehicles,
  vehicleId,
  onVehicle,
  handoffs,
  syncedIds,
  onCheckIn,
  onLeave,
}: {
  yardName: string;
  people: Person[];
  reconnecting: boolean;
  vehicles: Vehicle[];
  vehicleId: string;
  onVehicle: (id: string) => void;
  handoffs: Handoff[];
  syncedIds: string[];
  onCheckIn: (load: Load) => Promise<void>;
  onLeave: () => void;
}) {
  const now = useNow();
  const [bol, setBol] = useState('BOL-48213');
  const [trailer, setTrailer] = useState('TR-5530');
  const [seal, setSeal] = useState('SL-90871');
  const [pallets, setPallets] = useState('22');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const palletCount = Number.parseInt(pallets, 10);
  const valid =
    bol.trim() &&
    trailer.trim() &&
    Number.isInteger(palletCount) &&
    palletCount >= 0 &&
    palletCount <= 99;

  async function submit() {
    Keyboard.dismiss(); // otherwise it stays up over the new card and the sync bar
    setBusy(true);
    setError('');
    try {
      await onCheckIn({
        bol: bol.trim(),
        trailer: trailer.trim(),
        seal: seal.trim(),
        pallets: palletCount,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <TopBar
        eyebrow={
          reconnecting ? 'Out of range, will resend' : 'Checked in nearby'
        }
        title={yardName}
        people={people}
        onLeave={onLeave}
      />
      <FlatList
        className="flex-1"
        data={[...handoffs].reverse()}
        keyExtractor={(h) => h.handoffId}
        contentContainerClassName="gap-3 px-5 pb-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View className="gap-3 py-3">
            <Chips
              label="Vehicle"
              options={vehicles}
              value={vehicleId}
              onChange={onVehicle}
            />
            <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              Load
            </Text>
            <View className="flex-row gap-2">
              <Input
                className="flex-1"
                value={bol}
                onChangeText={setBol}
                placeholder="BOL"
                maxLength={30}
                autoCapitalize="characters"
              />
              <Input
                className="flex-1"
                value={trailer}
                onChangeText={setTrailer}
                placeholder="Trailer"
                maxLength={30}
                autoCapitalize="characters"
              />
            </View>
            <View className="flex-row gap-2">
              <Input
                className="flex-1"
                value={seal}
                onChangeText={setSeal}
                placeholder="Seal"
                maxLength={30}
                autoCapitalize="characters"
              />
              <Input
                className="w-28"
                value={pallets}
                onChangeText={setPallets}
                placeholder="Pallets"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            {error ? (
              <Text className="text-destructive text-sm">{error}</Text>
            ) : null}
            <Button disabled={busy || !valid || !vehicleId} onPress={submit}>
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Send} size={18} className="text-primary-foreground" />
              )}
              <Text>Sign and check in</Text>
            </Button>
            <Text className="text-muted-foreground text-sm">
              Sent over Bluetooth, signed with this phone's key. The dock
              assignment comes back countersigned by the yard.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <HandoffCard
            handoff={item}
            now={now}
            synced={syncedIds.includes(item.handoffId)}
          >
            {!item.assignment ? (
              <Text className="mt-2 text-sm font-semibold">
                Waiting for a dock…
              </Text>
            ) : null}
          </HandoffCard>
        )}
      />
    </SafeAreaView>
  );
}
