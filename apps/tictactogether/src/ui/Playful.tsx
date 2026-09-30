import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { Cell, Mark } from '../domain';
export const colors = {
  ink: '#29263D',
  muted: '#8B8798',
  paper: '#FBF8F2',
  coral: '#F07869',
  purple: '#8B78D5',
  lavender: '#EDE7FA',
  mint: '#CDE9DB',
  white: '#FFFFFF',
};
export const font = Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif';
export function haptic() {
  trigger('impactLight', {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
  });
}
export function useMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (v) => live && setReduced(v),
    );
    const s = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      live = false;
      s.remove();
    };
  }, []);
  return !reduced;
}
const APath = Animated.createAnimatedComponent(Path),
  ACircle = Animated.createAnimatedComponent(Circle),
  ALine = Animated.createAnimatedComponent(Line);
export function MarkArt({
  mark,
  size = 62,
  animate = true,
}: {
  mark: Mark;
  size?: number;
  animate?: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current,
    motion = useMotion();
  useEffect(() => {
    p.setValue(motion && animate ? 0 : 1);
    const a = Animated.timing(p, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [p, mark, motion, animate]);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      accessibilityLabel={mark}
    >
      {mark === 'X' ? (
        <>
          <APath
            d="M20 20 L60 60"
            stroke={colors.coral}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray="57"
            strokeDashoffset={p.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [57, 0, 0],
            })}
          />
          <APath
            d="M60 20 L20 60"
            stroke={colors.coral}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray="57"
            strokeDashoffset={p.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [57, 57, 0],
            })}
          />
        </>
      ) : (
        <ACircle
          cx={40}
          cy={40}
          r={25}
          fill="none"
          stroke={colors.purple}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray="158"
          strokeDashoffset={p.interpolate({
            inputRange: [0, 1],
            outputRange: [158, 0],
          })}
          rotation="-90"
          origin="40,40"
        />
      )}
    </Svg>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        {
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={[s.buttonLabel, secondary && { color: colors.ink }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Arrive({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const p = useRef(new Animated.Value(0)).current,
    motion = useMotion();
  useEffect(() => {
    const a = Animated.spring(p, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    });
    if (motion) a.start();
    else p.setValue(1);
    return () => a.stop();
  }, [p, motion]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: p,
          transform: [
            {
              translateY: p.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Board({
  board,
  line,
  enabled,
  move,
  decorative = false,
}: {
  board: Cell[];
  line: number[];
  enabled: boolean;
  move: (i: number) => void;
  decorative?: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current,
    motion = useMotion();
  const key = line.join(',');
  useEffect(() => {
    p.setValue(motion ? 0 : 1);
    const a = Animated.timing(p, {
      toValue: 1,
      duration: 600,
      delay: 250,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [key, p, motion]);
  const point = (i: number) => ({
    x: (i % 3) * 100 + 50,
    y: Math.floor(i / 3) * 100 + 50,
  });
  const from = point(line[0] ?? 0),
    to = point(line[2] ?? 0);
  return (
    <View style={[s.board, decorative && { transform: [{ rotate: '-9deg' }] }]}>
      {board.map((m, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${m ?? 'empty'}`}
          accessibilityState={{ disabled: !enabled || !!m }}
          disabled={!enabled || !!m}
          onPress={() => {
            haptic();
            move(i);
          }}
          style={({ pressed }) => [
            s.cell,
            line.includes(i) && { backgroundColor: '#E1EDDF' },
            pressed && { backgroundColor: colors.lavender },
          ]}
        >
          {m && (
            <MarkArt
              mark={m}
              size={decorative ? 62 : 66}
              animate={!decorative}
            />
          )}
        </Pressable>
      ))}
      {!!line.length && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%" viewBox="0 0 300 300">
            <ALine
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#567C62"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="300"
              strokeDashoffset={p.interpolate({
                inputRange: [0, 1],
                outputRange: [300, 0],
              })}
            />
          </Svg>
        </View>
      )}
    </View>
  );
}
export function Celebration({ kind }: { kind: 'win' | 'loss' | 'draw' }) {
  const p = useRef(new Animated.Value(0)).current,
    motion = useMotion();
  useEffect(() => {
    if (!motion) {
      p.setValue(0.4);
      return;
    }
    const a = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: kind === 'win' ? 2600 : 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    return () => a.stop();
  }, [p, motion, kind]);
  if (kind !== 'win')
    return (
      <View style={s.reaction}>
        <Animated.Text
          style={{
            fontSize: 48,
            transform: [
              {
                translateY: p.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, -8, 0],
                }),
              },
              {
                rotate: p.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['-8deg', '8deg', '-8deg'],
                }),
              },
            ],
          }}
        >
          {kind === 'loss' ? '🌧️' : '🤝'}
        </Animated.Text>
        {kind === 'loss' && <Text style={s.rain}>﹏ ﹏ ﹏</Text>}
      </View>
    );
  return (
    <View pointerEvents="none" style={s.confetti}>
      {Array.from({ length: 24 }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            width: i % 2 ? 7 : 10,
            height: i % 2 ? 14 : 7,
            borderRadius: i % 3 ? 2 : 8,
            backgroundColor: [
              colors.coral,
              colors.purple,
              '#E9BF58',
              '#75B79D',
            ][i % 4],
            opacity: p.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [1, 1, 0],
            }),
            transform: [
              {
                translateY: p.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-40 - (i % 4) * 25, 260 + (i % 5) * 20],
                }),
              },
              {
                rotate: p.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`${i * 20}deg`, `${i * 20 + 270}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  button: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    minHeight: 60,
    paddingHorizontal: 24,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: '#EFECE6' },
  buttonLabel: {
    color: '#FFF',
    fontFamily: font,
    fontSize: 16,
    fontWeight: '700',
  },
  board: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '3%',
    padding: '3%',
    backgroundColor: '#EEE9E1',
    borderRadius: 30,
  },
  cell: {
    width: '31.33%',
    height: '31.33%',
    backgroundColor: colors.white,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reaction: { height: 66, alignItems: 'center' },
  rain: { position: 'absolute', top: 42, color: colors.purple, fontSize: 24 },
  confetti: {
    position: 'absolute',
    top: -120,
    left: -25,
    right: -25,
    height: 350,
    zIndex: 10,
  },
});
