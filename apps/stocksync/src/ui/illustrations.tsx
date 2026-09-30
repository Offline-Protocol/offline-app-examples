// Flat product illustrations: a soft tinted blob plus a few shapes each.
// All drawn on a 64x64 grid with the palette below, so they read as one set.
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ProductId } from '../domain/stock';

const C = {
  red: '#FF5A5F',
  redDark: '#E0484D',
  orange: '#FF7A45',
  sunny: '#FFB400',
  yellow: '#FFD166',
  cream: '#FFF3DC',
  crust: '#E09A4F',
  crustLight: '#F7C98B',
  brown: '#8B5A3C',
  green: '#3DBE6B',
  sky: '#4D79FF',
  skyLight: '#DCE8FF',
  grape: '#9E66FF',
  grapeDark: '#6F45B8',
  white: '#FFFFFF',
};

const BLOB =
  'M34 5C48 6 59 16 58 32C57 47 46 59 31 58C16 57 5 46 6 31C7 16 20 4 34 5Z';

type Art = { tint: string; turn: number; draw: () => React.ReactNode };

const ART: Record<ProductId, Art> = {
  milk: {
    tint: '#E6F0FF',
    turn: 0,
    draw: () => (
      <>
        <Rect x={26} y={10} width={12} height={6} rx={2} fill={C.sky} />
        <Path d="M20 26L25 16H39L44 26Z" fill="#8DB8FF" />
        <Rect x={20} y={26} width={24} height={28} rx={3} fill={C.white} />
        <Rect x={20} y={34} width={24} height={11} fill={C.sky} />
        <Path
          d="M32 36.5C34 39 35 40.3 35 41.5A3 3 0 0 1 29 41.5C29 40.3 30 39 32 36.5Z"
          fill={C.white}
        />
      </>
    ),
  },
  bread: {
    tint: '#FFF1DE',
    turn: 90,
    draw: () => (
      <>
        <Path
          d="M13 31C13 23 20 18 32 18C44 18 51 23 51 31C51 33.5 49.5 35 47 35V48A4 4 0 0 1 43 52H21A4 4 0 0 1 17 48V35C14.5 35 13 33.5 13 31Z"
          fill={C.crust}
        />
        <G stroke={C.crustLight} strokeWidth={3} strokeLinecap="round">
          <Path d="M23 24L27 30" />
          <Path d="M30 23L34 29" />
          <Path d="M37 24L41 30" />
        </G>
      </>
    ),
  },
  apples: {
    tint: '#FFE8EA',
    turn: 200,
    draw: () => (
      <>
        <Rect x={30.5} y={14} width={3} height={10} rx={1.5} fill={C.brown} />
        <Ellipse
          cx={40}
          cy={17}
          rx={7}
          ry={3.5}
          fill={C.green}
          rotation={-25}
          origin="40, 17"
        />
        <Path
          d="M32 24C26 18 15 20 15 33C15 45 24 53 32 50C40 53 49 45 49 33C49 20 38 18 32 24Z"
          fill={C.red}
        />
        <Ellipse cx={23} cy={32} rx={3} ry={5} fill={C.white} opacity={0.45} />
      </>
    ),
  },
  eggs: {
    tint: '#DDF4F1',
    turn: 300,
    draw: () => (
      <>
        <Ellipse cx={38} cy={31} rx={10} ry={13} fill="#F2CFA2" />
        <Ellipse cx={26} cy={35} rx={10} ry={13} fill={C.white} />
        <Ellipse cx={22.5} cy={30} rx={2.5} ry={4} fill="#E6F3F1" />
        <Path
          d="M12 42H52L49 52A3 3 0 0 1 46 54H18A3 3 0 0 1 15 52Z"
          fill={C.sunny}
        />
        <Path
          d="M22 42V50M32 42V50M42 42V50"
          stroke="#E59E00"
          strokeWidth={2}
        />
      </>
    ),
  },
  bananas: {
    tint: '#FFF7D1',
    turn: 45,
    draw: () => (
      <>
        <Path
          d="M18 16C19 36 31 47 50 43C52 42.5 52 40 50 40C36 41 27 32 24 16C23.5 13 18 13 18 16Z"
          fill={C.sunny}
        />
        <Path
          d="M14 22C14 40 28 52 46 50C48 50 48 47 46 47C31 46 22 36 20 22C19.5 19 14 19 14 22Z"
          fill={C.yellow}
        />
        <Rect x={15} y={11} width={6} height={6} rx={2} fill={C.brown} />
      </>
    ),
  },
  cheese: {
    tint: '#FFF3D6',
    turn: 160,
    draw: () => (
      <>
        <Path d="M12 34L40 17L52 34Z" fill={C.yellow} />
        <Rect x={12} y={34} width={40} height={16} rx={2} fill={C.sunny} />
        <Circle cx={21} cy={41} r={3} fill="#E59E00" />
        <Circle cx={34} cy={44} r={2.2} fill="#E59E00" />
        <Circle cx={44} cy={39} r={2.6} fill="#E59E00" />
        <Ellipse cx={36} cy={27} rx={3} ry={1.6} fill={C.sunny} />
      </>
    ),
  },
  cereal: {
    tint: '#F1EAFD',
    turn: 250,
    draw: () => (
      <>
        <Path d="M20 14H44V10H20Z" fill={C.grapeDark} />
        <Rect x={19} y={13} width={26} height={41} rx={3} fill={C.grape} />
        <Circle cx={32} cy={36} r={9} fill={C.white} />
        <Path d="M24 36H40A8 8 0 0 1 24 36Z" fill={C.skyLight} />
        <Circle cx={29} cy={34} r={2} fill={C.sunny} />
        <Circle cx={34} cy={33} r={2} fill={C.orange} />
        <Circle cx={36} cy={35.5} r={1.8} fill={C.sunny} />
        <Rect x={24} y={18} width={16} height={4} rx={2} fill={C.yellow} />
      </>
    ),
  },
  tomatoes: {
    tint: '#FFECE4',
    turn: 120,
    draw: () => (
      <>
        <Circle cx={32} cy={36} r={16} fill={C.orange} />
        <Path
          d="M32 20L35 25L41 23L37 28L32 27L27 28L23 23L29 25Z"
          fill={C.green}
        />
        <Rect x={31} y={15} width={2.5} height={7} rx={1.25} fill={C.green} />
        <Ellipse cx={24} cy={36} rx={2.6} ry={5} fill={C.white} opacity={0.4} />
      </>
    ),
  },
};

export function ProductArt({
  id,
  size = 72,
}: {
  id: ProductId;
  size?: number;
}) {
  const art = ART[id];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={BLOB} fill={art.tint} rotation={art.turn} origin="32, 32" />
      {art.draw()}
    </Svg>
  );
}

/** Lobby hero: a little pile of groceries. */
export function StoreHero() {
  return (
    <Svg width={220} height={140} viewBox="0 0 220 140">
      <G transform="translate(62 0) scale(1.5)">
        <Path d={BLOB} fill={ART.milk.tint} />
        {ART.milk.draw()}
      </G>
      <G transform="translate(0 38) scale(1.5)">{ART.apples.draw()}</G>
      <G transform="translate(124 38) scale(1.5)">{ART.bread.draw()}</G>
    </Svg>
  );
}
