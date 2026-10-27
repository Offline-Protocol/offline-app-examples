import { Button, Icon, Input, Text } from '@offline-app-examples/ui';
import { CloudOff, CloudUpload, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '../services/fleetPlatform';
import type { SyncReport } from '../services/persist';

/** Bottom strip on every screen: where handoffs sync to, how many are waiting, the last result. */
export function FleetBar({
  session,
  toSync,
  lastSync,
  busy,
  onSync,
  onOpen,
}: {
  session: Session | null;
  toSync: number;
  lastSync: SyncReport | null;
  busy: boolean;
  onSync: () => void;
  onOpen: () => void;
}) {
  return (
    <SafeAreaView
      edges={['bottom']}
      className="border-foreground bg-muted/40 border-t-2"
    >
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Pressable
          className="flex-1"
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Contoso Fleet settings"
        >
          <Text className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
            {session
              ? `Contoso Fleet · ${session.credentials.database}`
              : 'Contoso Fleet · not connected (mock sync)'}
          </Text>
          <Text className="font-mono text-xs" numberOfLines={2}>
            {toSync} to sync · {describe(lastSync)}
          </Text>
        </Pressable>
        <Button
          size="sm"
          variant={session ? 'default' : 'outline'}
          disabled={busy}
          onPress={onSync}
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Icon as={session ? CloudUpload : CloudOff} size={16} />
          )}
          <Text>{session ? 'Sync' : 'Mock'}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function describe(r: SyncReport | null) {
  if (!r) return 'never synced';
  const time = new Date(r.at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (r.error) return `${time}: ${r.error}`;
  return `${time}: ${r.added} added, ${r.duplicates} duplicate${r.duplicates === 1 ? '' : 's'} dropped`;
}

/** Sign in to Contoso Fleet. Only the resulting session is stored, never the password. */
export function FleetSheet({
  visible,
  session,
  vehicleCount,
  onSignIn,
  onSignOut,
  onClose,
}: {
  visible: boolean;
  session: Session | null;
  vehicleCount: number;
  onSignIn: (
    server: string,
    database: string,
    user: string,
    password: string,
  ) => Promise<void>;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [server, setServer] = useState('fleet.contoso.example');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await onSignIn(server, database, user, password);
      setPassword('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="border-foreground flex-row items-center border-b-2 px-5 py-3">
            <Text className="flex-1 font-serif text-3xl">Contoso Fleet</Text>
            <Button
              variant="outline"
              size="sm"
              onPress={onClose}
              accessibilityLabel="Close"
            >
              <Icon as={X} size={16} />
            </Button>
          </View>
          <ScrollView
            contentContainerClassName="gap-3 p-5"
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-muted-foreground text-sm leading-5">
              Completed handoffs are written to this database as Add-In data,
              with the vehicle tracker's GPS fix nearest to check-in. Use a test
              database: API writes take effect at once.
            </Text>
            {session ? (
              <>
                <Text className="text-base">
                  Signed in as{' '}
                  <Text className="font-bold">
                    {session.credentials.userName}
                  </Text>{' '}
                  on{' '}
                  <Text className="font-bold">
                    {session.credentials.database}
                  </Text>{' '}
                  ({session.server}). {vehicleCount} vehicles.
                </Text>
                <Button variant="outline" onPress={onSignOut}>
                  <Text>Sign out</Text>
                </Button>
              </>
            ) : (
              <>
                <Input
                  value={server}
                  onChangeText={setServer}
                  placeholder="Server"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  value={database}
                  onChangeText={setDatabase}
                  placeholder="Database"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  value={user}
                  onChangeText={setUser}
                  placeholder="User (email)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry
                />
                {error ? (
                  <View className="bg-destructive border-foreground rounded-md border-2 px-4 py-3">
                    <Text className="text-destructive-foreground text-sm font-semibold">
                      {error}
                    </Text>
                  </View>
                ) : null}
                <Button
                  disabled={
                    busy || !database.trim() || !user.trim() || !password
                  }
                  onPress={submit}
                >
                  {busy ? <ActivityIndicator /> : <Text>Sign in</Text>}
                </Button>
                <Text className="text-muted-foreground text-xs leading-4">
                  Not signed in, the Sync button runs a mock ingest on this
                  phone with the same duplicate check, so the demo works without
                  a database.
                </Text>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
