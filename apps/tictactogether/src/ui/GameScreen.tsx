import { Button, cn, hardShadow, Text } from '@offline-app-examples/ui';
import React, { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type Action,
  type Game,
  type Mark,
  other,
  result,
} from '../domain/game';
import { Board, MARK_COLOR, MarkArt } from './Board';

type Props = {
  game: Game;
  me: Mark;
  rivalName: string;
  /** Member: an action is on its way to the host. */
  syncing: boolean;
  /** The other phone is out of range; the board waits for it. */
  away: boolean;
  onAction: (action: Action) => void;
  onLeave: () => void;
};

type Outcome = 'win' | 'loss' | 'draw';

const OUTCOME: Record<
  Outcome,
  { title: string; subtitle: string; bg: string }
> = {
  win: {
    title: 'You won! 🎉',
    subtitle: 'Three in a row. Look at you go.',
    bg: 'bg-sunny',
  },
  loss: {
    title: 'So close!',
    subtitle: 'A tiny rain cloud. A fresh chance next round.',
    bg: 'bg-sky',
  },
  draw: {
    title: 'It’s a draw 🤝',
    subtitle: 'Great minds block alike.',
    bg: 'bg-teal',
  },
};

const FOOTNOTE =
  'text-muted-foreground text-center text-xs font-medium leading-5';
const haptic = () => trigger('impactLight');

export function GameScreen(props: Props) {
  const { game, me, rivalName, syncing, away, onAction, onLeave } = props;
  const them = other(me);
  const end = result(game.board);
  const finished = end.winner !== null || end.draw;
  const outcome: Outcome = end.draw
    ? 'draw'
    : end.winner === me
      ? 'win'
      : 'loss';
  const myTurn = game.turn === me;
  const blocked = syncing || away;

  // A tick for every move, including the rival's.
  const lastBoard = useRef('');
  useEffect(() => {
    const key = `${game.round}-${game.board.join('')}`;
    if (lastBoard.current && lastBoard.current !== key) haptic();
    lastBoard.current = key;
  }, [game.round, game.board]);

  const act = (action: Action) => {
    haptic();
    onAction(action);
  };

  let status: string;
  if (away) status = `Waiting for ${rivalName} to come back in range…`;
  else if (finished) status = 'A little rivalry. A lot of fun.';
  else if (syncing) status = 'Sending a little magic…';
  else if (myTurn) status = 'Your turn. Make your mark!';
  else status = 'Their turn. Plot your next move.';

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="w-full max-w-[460px] grow self-center px-6 pb-4 pt-3"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 flex-row items-center justify-between">
          <Text className="font-serif text-2xl">✳ little rivalry</Text>
          <View className="bg-card border-foreground flex-row items-center gap-1.5 rounded-sm border-2 px-2 py-1">
            <View className={cn('size-2', away ? 'bg-primary' : 'bg-teal')} />
            <Text className="text-[10px] font-bold tracking-widest">
              {away ? 'RECONNECTING' : 'CONNECTED'}
            </Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.springify()} className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-bold tracking-[2px]">
              THE FRIENDLY FACE-OFF
            </Text>
            <Text className="text-muted-foreground text-xs font-bold">
              Round {String(game.round).padStart(2, '0')}
            </Text>
          </View>

          <View className="flex-row gap-4">
            {[me, them].map((mark) => {
              const active = game.turn === mark && !finished;
              return (
                <View
                  key={mark}
                  className={cn(
                    'bg-card border-foreground flex-1 items-center rounded-lg border-2 px-2 py-4',
                    active && 'bg-accent',
                  )}
                  style={active ? hardShadow : undefined}
                >
                  <View className="bg-card border-foreground mb-2 size-[53px] items-center justify-center rounded-md border-2">
                    <MarkArt mark={mark} size={45} animate={false} />
                  </View>
                  <Text className="text-sm font-bold" numberOfLines={1}>
                    {mark === me ? 'You' : rivalName}
                  </Text>
                  <Text className="mt-1 text-2xl font-bold">
                    {game.scores[mark]}{' '}
                    <Text className="text-muted-foreground text-xs font-medium">
                      wins
                    </Text>
                  </Text>
                  {active && (
                    <View className="bg-foreground absolute right-3 top-3 size-2" />
                  )}
                </View>
              );
            })}
            <Text className="bg-foreground text-background absolute left-1/2 top-[62px] -ml-4 w-8 rounded-sm py-1 text-center text-xs font-bold uppercase">
              vs
            </Text>
          </View>

          <View
            accessibilityLiveRegion="polite"
            className="flex-row items-center justify-between"
          >
            <Text className="flex-1 text-sm font-semibold">{status}</Text>
            {!finished && !away && (
              <Text className="text-2xl">{myTurn ? '✦' : '◌'}</Text>
            )}
          </View>

          <Board
            board={game.board}
            line={end.line}
            onMove={
              myTurn && !finished && !blocked
                ? (cell) => act({ kind: 'move', cell })
                : undefined
            }
          />

          {finished ? (
            <Animated.View
              key={`${game.round}-${outcome}`}
              entering={FadeInDown.springify()}
              className={cn(
                'border-foreground gap-3 rounded-lg border-2 p-5',
                OUTCOME[outcome].bg,
              )}
              style={hardShadow}
            >
              <Celebration outcome={outcome} />
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                className="text-center font-serif text-4xl leading-[44px]"
              >
                {OUTCOME[outcome].title}
              </Text>
              <Text className={cn(FOOTNOTE, 'text-foreground mb-1')}>
                {OUTCOME[outcome].subtitle}
              </Text>
              {game.rematch === them ? (
                <>
                  <Text className="text-center text-sm font-bold">
                    {rivalName} wants a rematch
                  </Text>
                  <View className="flex-row gap-2.5">
                    <Button
                      size="lg"
                      className="bg-foreground flex-1"
                      disabled={blocked}
                      onPress={() => act({ kind: 'accept' })}
                    >
                      <Text className="text-background">Accept</Text>
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="bg-card flex-1"
                      disabled={blocked}
                      onPress={() => act({ kind: 'decline' })}
                    >
                      <Text>Decline</Text>
                    </Button>
                  </View>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="bg-foreground"
                    disabled={blocked || game.rematch === me}
                    onPress={() => act({ kind: 'rematch' })}
                  >
                    <Text className="text-background">
                      {game.rematch === me
                        ? 'Rematch requested…'
                        : 'One more round?  ↻'}
                    </Text>
                  </Button>
                  {game.declined && (
                    <Text className={cn(FOOTNOTE, 'text-foreground')}>
                      Rematch declined. Thanks for playing together!
                    </Text>
                  )}
                </>
              )}
            </Animated.View>
          ) : (
            <View className="gap-2 pt-2">
              <Text className={FOOTNOTE}>THREE IN A ROW. ALL THE GLORY.</Text>
              <Text className={FOOTNOTE}>
                {game.scores.draws} {game.scores.draws === 1 ? 'draw' : 'draws'}{' '}
                · X and O alternate first move each round
              </Text>
            </View>
          )}

          <Button variant="ghost" onPress={onLeave}>
            <Text className="text-muted-foreground text-xs">
              Leave & find someone new ↗
            </Text>
          </Button>
        </Animated.View>

        <View className="mt-auto flex-row justify-between pt-6">
          <Text className="text-muted-foreground text-[10px] font-medium">
            ✳ powered by Offline Protocol
          </Text>
          <Text className="text-muted-foreground tracking-[3px]">•••</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Confetti for a win, a bobbing rain cloud or handshake otherwise. Under
// Reduce Motion Reanimated skips the loop: no confetti, a still emoji.
function Celebration({ outcome }: { outcome: Outcome }) {
  const p = useSharedValue(0);
  useEffect(() => {
    const duration = outcome === 'win' ? 2600 : 1800;
    p.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
    );
  }, [p, outcome]);
  const bob = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p.value, [0, 0.5, 1], [0, -8, 0]) },
      { rotate: `${interpolate(p.value, [0, 0.5, 1], [-8, 8, -8])}deg` },
    ],
  }));

  if (outcome === 'win') {
    return (
      <View
        pointerEvents="none"
        className="absolute -inset-x-6 -top-28 z-10 h-[350px]"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <Confetto key={i} i={i} p={p} />
        ))}
      </View>
    );
  }
  return (
    <View className="h-16 items-center">
      <Animated.Text className="text-5xl" style={bob}>
        {outcome === 'loss' ? '🌧️' : '🤝'}
      </Animated.Text>
      {outcome === 'loss' && (
        <Text className="absolute top-10 text-2xl">﹏ ﹏ ﹏</Text>
      )}
    </View>
  );
}

const CONFETTI = [MARK_COLOR.X, MARK_COLOR.O, '#9E66FF', '#141414'];

// One piece; `i` spreads the pieces out in position, size, speed and spin.
function Confetto({ i, p }: { i: number; p: SharedValue<number> }) {
  const fall = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.8, 1], [1, 1, 0]),
    transform: [
      {
        translateY: interpolate(
          p.value,
          [0, 1],
          [-40 - (i % 4) * 25, 260 + (i % 5) * 20],
        ),
      },
      { rotate: `${i * 20 + p.value * 270}deg` },
    ],
  }));
  const piece = {
    left: `${(i * 37) % 100}%` as const,
    width: i % 2 ? 7 : 10,
    height: i % 2 ? 14 : 7,
    borderRadius: i % 3 ? 0 : 2,
    backgroundColor: CONFETTI[i % 4],
  };
  return <Animated.View className="absolute" style={[piece, fall]} />;
}
