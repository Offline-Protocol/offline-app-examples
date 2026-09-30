import React from 'react';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

// Flat illustrations drawn for Cowrite, in the theme's accent colors.
const CORAL = '#FF385C';
const TEAL = '#00A699';
const SUNNY = '#FFAA00';
const SKY = '#428BFF';
const GRAPE = '#8A5CD6';
const INK = '#222222';
const LINE = '#DDDDDD';

/** A pencil lying at an angle, its tip at (x, y). */
function Pencil({
  x,
  y,
  angle,
  scale = 1,
}: {
  x: number;
  y: number;
  angle: number;
  scale?: number;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <Polygon points="0,-7 -15,0 0,7" fill="#F6D7A7" />
      <Polygon points="-9,-3 -15,0 -9,3" fill={INK} />
      <Rect x={0} y={-7} width={52} height={14} fill={SUNNY} />
      <Rect x={0} y={-7} width={52} height={4} fill="#FFC44D" />
      <Rect x={52} y={-7} width={6} height={14} fill="#C9C9C9" />
      <Rect x={58} y={-7} width={12} height={14} rx={4} fill={CORAL} />
    </G>
  );
}

/** Someone's caret: a thin bar with a dot on top, like the ones in the editor. */
function Caret({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <G>
      <Rect x={x - 1.5} y={y} width={3} height={17} rx={1.5} fill={color} />
      <Circle cx={x} cy={y - 1} r={4} fill={color} />
    </G>
  );
}

/** Lobby hero: a shared page with two people's carets and a pencil. */
export function HeroIllustration({ size = 240 }: { size?: number }) {
  const lines = [76, 64, 72, 50, 70, 40];
  return (
    <Svg width={size} height={(size * 200) / 240} viewBox="0 0 240 200">
      <Circle cx={120} cy={104} r={88} fill={GRAPE} opacity={0.12} />
      <Circle cx={36} cy={52} r={6} fill={SUNNY} />
      <Circle cx={208} cy={42} r={4} fill={SKY} />
      <Circle cx={44} cy={160} r={4} fill={TEAL} />
      <Rect
        x={64}
        y={36}
        width={104}
        height={134}
        rx={12}
        fill={SKY}
        opacity={0.3}
        transform="rotate(-8 116 103)"
      />
      <Rect
        x={76}
        y={40}
        width={108}
        height={138}
        rx={12}
        fill="#FFFFFF"
        stroke="#EBEBEB"
        strokeWidth={2}
      />
      <Rect x={92} y={58} width={56} height={9} rx={4.5} fill={INK} />
      <Rect
        x={92}
        y={93}
        width={36}
        height={12}
        rx={3}
        fill={CORAL}
        opacity={0.18}
      />
      {lines.map((width, i) => (
        <Rect
          key={i}
          x={92}
          y={82 + i * 14}
          width={width}
          height={6}
          rx={3}
          fill={LINE}
        />
      ))}
      <Caret x={128} y={91} color={CORAL} />
      <Caret x={143} y={133} color={TEAL} />
      <Pencil x={170} y={160} angle={-40} />
    </Svg>
  );
}

/** Empty document: a blank page waiting for its first line. */
export function EmptyDocIllustration({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 120) / 150} viewBox="0 0 150 120">
      <Circle cx={75} cy={62} r={52} fill={GRAPE} opacity={0.1} />
      <Rect
        x={45}
        y={18}
        width={60}
        height={80}
        rx={9}
        fill="#FFFFFF"
        stroke="#E4E4E4"
        strokeWidth={2}
      />
      <Rect
        x={55}
        y={32}
        width={26}
        height={6}
        rx={3}
        fill={GRAPE}
        opacity={0.55}
      />
      <Path
        d="M55 50 h40 M55 61 h34 M55 72 h22"
        stroke={LINE}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="1 8"
      />
      <Caret x={82} y={66} color={GRAPE} />
      <Circle cx={26} cy={34} r={4} fill={SUNNY} />
      <Circle cx={124} cy={26} r={3} fill={CORAL} />
      <Pencil x={100} y={92} angle={-35} scale={0.7} />
    </Svg>
  );
}
