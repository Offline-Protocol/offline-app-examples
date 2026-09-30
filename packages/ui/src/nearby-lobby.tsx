import { ChevronRight, Radio, Users } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, AvatarFallback } from './components/avatar';
import { Button } from './components/button';
import { Icon } from './components/icon';
import { Input } from './components/input';
import { Text } from './components/text';
import { cn } from './lib/utils';

/** Same values as `RoomStatus` in @offline-app-examples/mesh, so `room.status` can be passed straight in. */
export type LobbyStatus =
  | 'idle'
  | 'starting'
  | 'hosting'
  | 'discovering'
  | 'joining'
  | 'connected'
  | 'error';

export type LobbyPerson = { id: string; name: string };

export type NearbyLobbyLabels = {
  namePlaceholder: string;
  host: string;
  join: string;
  starting: string;
  scanningTitle: string;
  scanningHint: string;
  joining: string;
  hostingTitle: string;
  waiting: string;
  joinedOne: string;
  joinedMany: string;
  connected: string;
  continue: string;
  cancel: string;
  stop: string;
};

const DEFAULT_LABELS: NearbyLobbyLabels = {
  namePlaceholder: 'Your name',
  host: 'Host a session',
  join: 'Join nearby',
  starting: 'Getting ready…',
  scanningTitle: 'Looking nearby',
  scanningHint: 'Hosts show up here as they are found. Keep the apps open and close together.',
  joining: 'Joining',
  hostingTitle: 'You are hosting',
  waiting: 'Waiting for people nearby…',
  joinedOne: '1 person joined',
  joinedMany: '{count} people joined',
  connected: 'You are in!',
  continue: 'Continue',
  cancel: 'Cancel',
  stop: 'Stop hosting',
};

export type NearbyLobbyProps = {
  title: string;
  tagline?: string;
  /** Hero art shown on the start screen (e.g. an SVG illustration). */
  illustration?: React.ReactNode;
  /** Any React Native color. Tints the primary buttons and the radar. Defaults to the theme coral. */
  accentColor?: string;
  status: LobbyStatus;
  error?: string;
  /** Nearby hosts, shown while discovering. */
  hosts: LobbyPerson[];
  /** People connected to this device (members when hosting, the host when joined). */
  peers?: LobbyPerson[];
  /** Id of the host being joined, while status is 'joining'. */
  joiningId?: string;
  /** The local display name (room name when hosting). */
  name: string;
  onNameChange: (name: string) => void;
  onHost: () => void;
  onDiscover: () => void;
  onJoin: (host: LobbyPerson) => void;
  /** Stop scanning, cancel a join or stop hosting. */
  onCancel: () => void;
  /** Shown as the main button while hosting or connected. */
  onContinue?: () => void;
  labels?: Partial<NearbyLobbyLabels>;
};

const CORAL = '#FF385C';
const AVATAR_COLORS = ['bg-primary', 'bg-teal', 'bg-sunny', 'bg-sky', 'bg-grape'];

export function NearbyLobby(props: NearbyLobbyProps) {
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const accent = props.accentColor ?? CORAL;
  const { status } = props;

  let body: React.ReactNode;
  if (status === 'discovering' || status === 'joining') {
    body = <Scanning {...props} labels={labels} accent={accent} />;
  } else if (status === 'hosting' || status === 'connected') {
    body = <Hosting {...props} labels={labels} accent={accent} />;
  } else {
    body = <Start {...props} labels={labels} accent={accent} />;
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      {/* Android is edge-to-edge (forced on API 35+), so adjustResize alone doesn't lift the buttons. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InnerProps = NearbyLobbyProps & { labels: NearbyLobbyLabels; accent: string };

function Start({ title, tagline, illustration, name, onNameChange, onHost, onDiscover, status, error, labels, accent }: InnerProps) {
  const busy = status === 'starting';
  return (
    <View className="flex-1 px-6">
      <View className="flex-1 items-center justify-center gap-4">
        {illustration}
        <Text className="text-center text-4xl font-extrabold tracking-tight">{title}</Text>
        {tagline ? <Text className="text-muted-foreground text-center text-lg leading-6">{tagline}</Text> : null}
      </View>
      <View className="gap-3 pb-4">
        <Input
          value={name}
          onChangeText={onNameChange}
          placeholder={labels.namePlaceholder}
          autoCorrect={false}
          maxLength={30}
          editable={!busy}
        />
        {error ? (
          <View className="bg-destructive/10 rounded-xl px-4 py-3">
            <Text className="text-destructive text-sm">{error}</Text>
          </View>
        ) : null}
        <Button size="lg" disabled={busy} onPress={onHost} style={{ backgroundColor: accent }}>
          <Text>{busy ? labels.starting : labels.host}</Text>
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onPress={onDiscover}>
          <Text>{labels.join}</Text>
        </Button>
      </View>
    </View>
  );
}

function Scanning({ hosts, onJoin, onCancel, status, joiningId, labels, accent }: InnerProps) {
  const joining = status === 'joining';
  const joiningName = hosts.find(host => host.id === joiningId)?.name;
  return (
    <View className="flex-1 px-6">
      <Header title={joining ? `${labels.joining} ${joiningName ?? ''}`.trim() : labels.scanningTitle} action={labels.cancel} onAction={onCancel} />
      <View className="items-center py-6">
        <Radar color={accent} icon={Radio} />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
        {hosts.length === 0 ? (
          <Text className="text-muted-foreground px-4 text-center text-sm leading-5">{labels.scanningHint}</Text>
        ) : null}
        {hosts.map((host, index) => (
          <Animated.View key={host.id} entering={FadeInDown.delay(index * 60).springify()}>
            <Pressable
              disabled={joining}
              onPress={() => onJoin(host)}
              className={cn(
                'bg-card border-border flex-row items-center gap-4 rounded-2xl border p-4 shadow-sm shadow-black/5 active:opacity-80',
                joining && joiningId !== host.id && 'opacity-40',
              )}>
              <PersonAvatar person={host} />
              <View className="flex-1">
                <Text className="text-base font-semibold" numberOfLines={1}>{host.name}</Text>
                <Text className="text-muted-foreground text-sm">
                  {joining && joiningId === host.id ? `${labels.joining}…` : 'Tap to join'}
                </Text>
              </View>
              <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function Hosting({ name, peers = [], onCancel, onContinue, status, labels, accent }: InnerProps) {
  const connected = status === 'connected';
  const joined =
    peers.length === 1 ? labels.joinedOne : labels.joinedMany.replace('{count}', String(peers.length));
  return (
    <View className="flex-1 px-6">
      <View className="flex-1 items-center justify-center gap-6">
        <Radar color={accent} icon={Users} />
        <View className="items-center gap-2">
          <Text className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">
            {connected ? labels.connected : labels.hostingTitle}
          </Text>
          <Text className="text-center text-3xl font-extrabold tracking-tight">
            {connected ? peers[0]?.name ?? '' : name}
          </Text>
          {connected ? null : (
            <Text className="text-muted-foreground text-center text-base">
              {peers.length === 0 ? labels.waiting : joined}
            </Text>
          )}
        </View>
        {!connected && peers.length > 0 ? (
          <View className="flex-row flex-wrap justify-center gap-3">
            {peers.map(peer => (
              <Animated.View key={peer.id} entering={FadeInDown.springify()}>
                <View className="items-center gap-1">
                  <PersonAvatar person={peer} />
                  <Text className="text-muted-foreground max-w-[72px] text-xs" numberOfLines={1}>{peer.name}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </View>
      <View className="gap-3 pb-4">
        {onContinue ? (
          <Button size="lg" onPress={onContinue} style={{ backgroundColor: accent }}>
            <Text>{labels.continue}</Text>
          </Button>
        ) : null}
        <Button size="lg" variant="ghost" onPress={onCancel}>
          <Text>{connected ? labels.cancel : labels.stop}</Text>
        </Button>
      </View>
    </View>
  );
}

function Header({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Text className="flex-1 text-2xl font-bold tracking-tight" numberOfLines={1}>{title}</Text>
      <Button variant="ghost" size="sm" onPress={onAction}>
        <Text>{action}</Text>
      </Button>
    </View>
  );
}

export function PersonAvatar({ person, className }: { person: LobbyPerson; className?: string }) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join('');
  let hash = 0;
  for (const char of person.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (
    <Avatar alt={person.name} className={cn('size-12', className)}>
      <AvatarFallback className={AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]}>
        <Text className="text-base font-bold text-white">{initials || '?'}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

const RADAR_SIZE = 200;

/** Pulsing rings around an icon. Static when the system "Reduce Motion" setting is on. */
function Radar({ color, icon }: { color: string; icon: React.ComponentProps<typeof Icon>['as'] }) {
  return (
    <View style={{ width: RADAR_SIZE, height: RADAR_SIZE }} className="items-center justify-center">
      {[0, 800, 1600].map(delay => (
        <Ring key={delay} delay={delay} color={color} />
      ))}
      <View
        style={{ backgroundColor: color }}
        className="size-20 items-center justify-center rounded-full shadow-lg shadow-black/20">
        <Icon as={icon} size={32} className="text-white" />
      </View>
    </View>
  );
}

function Ring({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0.6);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - progress.value),
    transform: [{ scale: 0.35 + progress.value * 0.65 }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_SIZE / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}
