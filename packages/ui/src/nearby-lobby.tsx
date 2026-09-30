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
import { cn, hardShadow } from './lib/utils';

/** Matches `room.status` from useNearbyRoom, so it can be passed straight in. */
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
  /** Any bright React Native color (it carries ink text). Fills the hero, primary buttons and radar. Defaults to the theme red. */
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

const RED = '#FF5029';
const AVATAR_COLORS = ['bg-primary', 'bg-teal', 'bg-sunny', 'bg-sky', 'bg-grape'];

export function NearbyLobby(props: NearbyLobbyProps) {
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const accent = props.accentColor ?? RED;
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
      <View className="flex-1 justify-center gap-4">
        {illustration ? (
          <View
            style={[{ backgroundColor: accent }, hardShadow]}
            className="border-foreground items-center overflow-hidden rounded-lg border-2 py-6">
            {illustration}
          </View>
        ) : null}
        <Text className="font-serif text-5xl leading-[56px]">{title}</Text>
        {tagline ? <Text className="text-muted-foreground text-lg font-medium leading-6">{tagline}</Text> : null}
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
          <View className="bg-destructive border-foreground rounded-md border-2 px-4 py-3">
            <Text className="text-destructive-foreground text-sm font-semibold">{error}</Text>
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
                'bg-card border-foreground active:bg-accent flex-row items-center gap-4 rounded-md border-2 p-4',
                joining && joiningId !== host.id && 'opacity-40',
              )}
              style={hardShadow}>
              <PersonAvatar person={host} />
              <View className="flex-1">
                <Text className="text-lg font-bold" numberOfLines={1}>{host.name}</Text>
                <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {joining && joiningId === host.id ? `${labels.joining}…` : 'Tap to join'}
                </Text>
              </View>
              <Icon as={ChevronRight} size={22} className="text-foreground" />
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
          <Text className="text-xs font-bold uppercase tracking-widest">
            {connected ? labels.connected : labels.hostingTitle}
          </Text>
          <Text className="text-center font-serif text-4xl leading-[48px]">
            {connected ? peers[0]?.name ?? '' : name}
          </Text>
          {connected ? null : (
            <Text className="text-muted-foreground text-center text-base font-medium">
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
                  <Text className="max-w-[72px] text-xs font-semibold" numberOfLines={1}>{peer.name}</Text>
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
      <Text className="flex-1 font-serif text-3xl leading-[40px]" numberOfLines={1}>{title}</Text>
      <Button variant="ghost" size="sm" onPress={onAction}>
        <Text>{action}</Text>
      </Button>
    </View>
  );
}

/** `color` overrides the id-hashed background, e.g. to match a color assigned elsewhere. */
export function PersonAvatar({ person, className, color }: { person: LobbyPerson; className?: string; color?: string }) {
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
      <AvatarFallback
        className={color ? undefined : AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]}
        style={color ? { backgroundColor: color } : undefined}>
        <Text className="text-base font-bold">{initials || '?'}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

const RADAR_SIZE = 200;

/** Pulsing squares around an icon. Static when the system "Reduce Motion" setting is on. */
function Radar({ color, icon }: { color: string; icon: React.ComponentProps<typeof Icon>['as'] }) {
  return (
    <View style={{ width: RADAR_SIZE, height: RADAR_SIZE }} className="items-center justify-center">
      {[0, 800, 1600].map(delay => (
        <Ring key={delay} delay={delay} color={color} />
      ))}
      <View
        style={[{ backgroundColor: color }, hardShadow]}
        className="border-foreground size-20 items-center justify-center rounded-lg border-2">
        <Icon as={icon} size={32} className="text-foreground" />
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
    opacity: 1 - progress.value,
    transform: [{ scale: 0.35 + progress.value * 0.65 }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: 24, borderWidth: 3, borderColor: color },
        style,
      ]}
    />
  );
}
