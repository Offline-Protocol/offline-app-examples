import { cn, INK } from '@offline-app-examples/ui';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { Cell, Mark } from '../domain/game';

// The theme's `primary` and `sky`; SVG strokes need plain values.
export const MARK_COLOR: Record<Mark, string> = { X: '#FF5029', O: '#4D79FF' };

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Goes from `from` to 1 once, on mount. Reanimated jumps straight to the end
// when the system Reduce Motion setting is on.
function useDrawIn(duration: number, delay = 0, from = 0) {
  const progress = useSharedValue(from);
  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    progress.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [progress, duration, delay]);
  return progress;
}

/** An X or O that draws itself in. */
export function MarkArt({
  mark,
  size,
  animate = true,
}: {
  mark: Mark;
  size: number;
  animate?: boolean;
}) {
  const p = useDrawIn(420, 0, animate ? 0 : 1);
  // The X's second stroke starts just before the first one ends.
  const first = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(p.value, [0, 0.5, 1], [57, 0, 0]),
  }));
  const second = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(p.value, [0, 0.4, 1], [57, 57, 0]),
  }));
  const ring = useAnimatedProps(() => ({
    strokeDashoffset: 158 * (1 - p.value),
  }));
  const stroke = {
    stroke: MARK_COLOR[mark],
    strokeWidth: 12,
    strokeLinecap: 'butt' as const,
    fill: 'none',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      accessibilityLabel={mark}
    >
      {mark === 'X' ? (
        <>
          <AnimatedPath
            d="M20 20 L60 60"
            strokeDasharray="57"
            animatedProps={first}
            {...stroke}
          />
          <AnimatedPath
            d="M60 20 L20 60"
            strokeDasharray="57"
            animatedProps={second}
            {...stroke}
          />
        </>
      ) : (
        <AnimatedCircle
          cx={40}
          cy={40}
          r={25}
          strokeDasharray="158"
          rotation={-90}
          origin="40,40"
          animatedProps={ring}
          {...stroke}
        />
      )}
    </Svg>
  );
}

type BoardProps = {
  board: Cell[];
  line: number[]; // the winning line, if any
  onMove?: (cell: number) => void; // missing: cells can't be tapped right now
  decorative?: boolean; // the lobby picture: smaller, tilted, no animation
};

export function Board({ board, line, onMove, decorative = false }: BoardProps) {
  return (
    <View
      className={cn(
        'bg-foreground aspect-square w-full flex-row flex-wrap content-between justify-between rounded-lg p-[3%]',
        decorative && 'rotate-[-9deg]',
      )}
    >
      {board.map((mark, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${mark ?? 'empty'}`}
          disabled={!onMove || !!mark}
          onPress={() => onMove?.(i)}
          className={cn(
            'bg-card active:bg-accent h-[31.33%] w-[31.33%] items-center justify-center rounded-sm',
            line.includes(i) && 'bg-sunny',
          )}
        >
          {mark && (
            <MarkArt
              mark={mark}
              size={decorative ? 62 : 66}
              animate={!decorative}
            />
          )}
        </Pressable>
      ))}
      {line.length > 0 && <WinLine line={line} />}
    </View>
  );
}

function WinLine({ line }: { line: number[] }) {
  const p = useDrawIn(600, 250);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: 300 * (1 - p.value),
  }));
  // Cell centers on a 300 x 300 grid.
  const x = (i: number) => (i % 3) * 100 + 50;
  const y = (i: number) => Math.floor(i / 3) * 100 + 50;
  const [a, , b] = line;
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Svg width="100%" height="100%" viewBox="0 0 300 300">
        <AnimatedLine
          x1={x(a)}
          y1={y(a)}
          x2={x(b)}
          y2={y(b)}
          stroke={INK}
          strokeWidth={6}
          strokeLinecap="square"
          strokeDasharray="300"
          animatedProps={props}
        />
      </Svg>
    </View>
  );
}
