// Flat food illustrations, one per menu item. All share a 100x100 canvas, a
// soft blob behind the food and the palette below.
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

const C = {
  coral: '#FF385C',
  pink: '#FF8FA3',
  tomato: '#FF5A5F',
  sunny: '#FFAA00',
  cheese: '#FFC83D',
  bun: '#F4A259',
  crust: '#D9853B',
  patty: '#7A4A2A',
  leaf: '#4CC38A',
  leafDark: '#2FA36B',
  sky: '#428BFF',
  skyLight: '#7FB0FF',
  grape: '#8A5CD6',
  teal: '#00A699',
  cream: '#FFF4E0',
  white: '#FFFFFF',
};

function Blob({ color }: { color: string }) {
  return (
    <Path
      d="M52 6C77 6 94 25 93 50C92 76 74 94 49 93C24 92 7 75 8 50C9 25 27 6 52 6Z"
      fill={color}
      opacity={0.16}
    />
  );
}

const Burger = () => (
  <G>
    <Blob color={C.sunny} />
    <Path
      d="M22 68H78V72C78 77 74 80 69 80H31C26 80 22 77 22 72Z"
      fill={C.bun}
    />
    <Rect x={20} y={57} width={60} height={11} rx={5.5} fill={C.patty} />
    <Rect x={22} y={54} width={56} height={5} rx={2} fill={C.cheese} />
    <Path d="M56 58H66L61 65Z" fill={C.cheese} />
    <Path
      d="M19 51Q25 58 31 52Q37 58 43 52Q49 58 55 52Q61 58 67 52Q73 58 81 51V49H19Z"
      fill={C.leaf}
    />
    <Path d="M21 50C21 32 35 23 50 23C65 23 79 32 79 50Z" fill={C.bun} />
    <Ellipse cx={40} cy={34} rx={2.6} ry={1.5} fill={C.cream} />
    <Ellipse cx={52} cy={30} rx={2.6} ry={1.5} fill={C.cream} />
    <Ellipse cx={61} cy={38} rx={2.6} ry={1.5} fill={C.cream} />
    <Ellipse cx={46} cy={42} rx={2.6} ry={1.5} fill={C.cream} />
  </G>
);

const Pizza = () => (
  <G>
    <Blob color={C.coral} />
    <Path
      d="M25 29H75L50 83Z"
      fill={C.cheese}
      stroke={C.cheese}
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <Circle cx={41} cy={40} r={5.5} fill={C.tomato} />
    <Circle cx={60} cy={42} r={5} fill={C.tomato} />
    <Circle cx={50} cy={60} r={4.5} fill={C.tomato} />
    <Circle cx={48} cy={47} r={1.6} fill={C.leafDark} />
    <Circle cx={56} cy={53} r={1.6} fill={C.leafDark} />
    <Rect x={19} y={20} width={62} height={11} rx={5.5} fill={C.crust} />
  </G>
);

const Fries = () => (
  <G>
    <Blob color={C.coral} />
    <Rect
      x={33}
      y={26}
      width={7}
      height={34}
      rx={3.5}
      fill={C.cheese}
      transform="rotate(-10 36 43)"
    />
    <Rect x={42} y={20} width={7} height={40} rx={3.5} fill={C.cheese} />
    <Rect
      x={51}
      y={23}
      width={7}
      height={38}
      rx={3.5}
      fill={C.sunny}
      transform="rotate(6 54 42)"
    />
    <Rect
      x={59}
      y={28}
      width={7}
      height={32}
      rx={3.5}
      fill={C.cheese}
      transform="rotate(14 62 44)"
    />
    <Rect
      x={46}
      y={30}
      width={7}
      height={30}
      rx={3.5}
      fill={C.sunny}
      transform="rotate(-4 49 45)"
    />
    <Path d="M28 46H72L66 84H34Z" fill={C.coral} strokeLinejoin="round" />
    <Path d="M28 46H72L71 52H29Z" fill={C.tomato} />
    <Circle cx={50} cy={66} r={7} fill={C.cream} />
    <Circle cx={50} cy={66} r={3} fill={C.sunny} />
  </G>
);

const Salad = () => (
  <G>
    <Blob color={C.teal} />
    <Circle cx={31} cy={48} r={10} fill={C.leafDark} />
    <Circle cx={46} cy={41} r={13} fill={C.leaf} />
    <Circle cx={63} cy={44} r={11} fill={C.leafDark} />
    <Circle cx={72} cy={50} r={8} fill={C.leaf} />
    <Circle cx={38} cy={45} r={5} fill={C.tomato} />
    <Circle cx={57} cy={45} r={5} fill={C.tomato} />
    <Circle cx={49} cy={51} r={3.5} fill={C.cheese} />
    <Path d="M17 51H83C83 69 69 82 50 82C31 82 17 69 17 51Z" fill={C.sky} />
    <Rect x={17} y={49} width={66} height={5} rx={2.5} fill={C.skyLight} />
  </G>
);

const Ramen = () => (
  <G>
    <Blob color={C.grape} />
    <Path
      d="M40 12Q37 18 40 24M50 10Q47 17 50 24"
      stroke={C.grape}
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
      opacity={0.5}
    />
    <Path d="M16 50H84C84 70 69 83 50 83C31 83 16 70 16 50Z" fill={C.coral} />
    <Ellipse cx={50} cy={50} rx={34} ry={7} fill={C.cheese} />
    <Path
      d="M28 50Q33 46 38 50T48 50T58 50"
      stroke={C.cream}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
    <Ellipse cx={66} cy={48} rx={8} ry={4.5} fill={C.white} />
    <Circle cx={66} cy={48} r={2.8} fill={C.sunny} />
    <Path
      d="M62 14L44 48M70 16L50 48"
      stroke={C.patty}
      strokeWidth={3.2}
      strokeLinecap="round"
    />
    <Path
      d="M28 64H72"
      stroke={C.cream}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.6}
    />
  </G>
);

const Taco = () => (
  <G>
    <Blob color={C.sunny} />
    <Path d="M19 66C19 44 33 29 50 29C67 29 81 44 81 66Z" fill={C.leaf} />
    <Circle cx={33} cy={42} r={4.5} fill={C.tomato} />
    <Circle cx={50} cy={33} r={4.5} fill={C.tomato} />
    <Circle cx={67} cy={42} r={4.5} fill={C.tomato} />
    <Circle cx={42} cy={36} r={3} fill={C.cream} />
    <Circle cx={59} cy={36} r={3} fill={C.cream} />
    <Path d="M22 74C22 52 34 39 50 39C66 39 78 52 78 74Z" fill={C.cheese} />
    <Circle cx={38} cy={56} r={2} fill={C.bun} />
    <Circle cx={52} cy={50} r={2} fill={C.bun} />
    <Circle cx={62} cy={60} r={2} fill={C.bun} />
    <Circle cx={45} cy={66} r={2} fill={C.bun} />
  </G>
);

const Soda = () => (
  <G>
    <Blob color={C.sky} />
    <Rect
      x={51}
      y={10}
      width={5}
      height={26}
      rx={2.5}
      fill={C.sky}
      transform="rotate(14 53 23)"
    />
    <Path d="M31 34H69L64 84H36Z" fill={C.coral} />
    <Path d="M33.5 54H66.5L65.5 64H34.5Z" fill={C.cream} />
    <Rect x={27} y={28} width={46} height={9} rx={4.5} fill={C.cream} />
    <Circle cx={44} cy={74} r={2} fill={C.cream} opacity={0.7} />
    <Circle cx={55} cy={45} r={2.4} fill={C.cream} opacity={0.7} />
  </G>
);

const IceCream = () => (
  <G>
    <Blob color={C.grape} />
    <Path d="M35 50H65L50 88Z" fill={C.bun} strokeLinejoin="round" />
    <Path
      d="M38 58H62M41.5 67H58.5M45 76H55"
      stroke={C.crust}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Circle cx={50} cy={37} r={17} fill={C.pink} />
    <Path
      d="M32 46Q36 55 41 49Q45 56 50 50Q55 56 59 49Q64 55 68 46Z"
      fill={C.pink}
    />
    <Rect
      x={40}
      y={30}
      width={5}
      height={2}
      rx={1}
      fill={C.sky}
      transform="rotate(30 42 31)"
    />
    <Rect
      x={54}
      y={36}
      width={5}
      height={2}
      rx={1}
      fill={C.cheese}
      transform="rotate(-25 56 37)"
    />
    <Rect
      x={45}
      y={41}
      width={5}
      height={2}
      rx={1}
      fill={C.teal}
      transform="rotate(10 47 42)"
    />
    <Rect
      x={58}
      y={28}
      width={5}
      height={2}
      rx={1}
      fill={C.white}
      transform="rotate(60 60 29)"
    />
    <Path
      d="M50 20Q52 13 57 11"
      stroke={C.patty}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx={50} cy={20} r={5} fill={C.coral} />
  </G>
);

const ART: Record<string, () => React.JSX.Element> = {
  burger: Burger,
  pizza: Pizza,
  fries: Fries,
  salad: Salad,
  ramen: Ramen,
  taco: Taco,
  soda: Soda,
  icecream: IceCream,
};

export function FoodArt({ itemId, size }: { itemId: string; size: number }) {
  const Art = ART[itemId];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {Art ? <Art /> : <Blob color={C.coral} />}
    </Svg>
  );
}

/** Lobby hero: a service bell, the "order up!" moment. */
export function BellArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Blob color={C.coral} />
      <Path
        d="M30 22L26 16M70 22L74 16M50 16V9"
        stroke={C.sunny}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Rect x={45} y={26} width={10} height={8} rx={3} fill={C.patty} />
      <Path d="M22 68C22 47 34 33 50 33C66 33 78 47 78 68Z" fill={C.sunny} />
      <Path
        d="M32 56C33 48 38 42 45 40"
        stroke={C.cream}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={14} y={67} width={72} height={9} rx={4.5} fill={C.coral} />
      <Rect x={20} y={76} width={60} height={6} rx={3} fill={C.tomato} />
    </Svg>
  );
}
