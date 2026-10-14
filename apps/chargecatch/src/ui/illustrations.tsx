import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function ChargeHero({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Rect x="55" y="50" width="70" height="100" rx="8" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" />
      <Rect x="68" y="65" width="44" height="55" rx="4" fill="#fff" stroke="#0369a1" strokeWidth="2" />
      <Path
        d="M88 75 L78 95 H86 L82 115 L98 90 H90 Z"
        fill="#facc15"
        stroke="#ca8a04"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Rect x="40" y="130" width="100" height="12" rx="4" fill="#bbf7d0" stroke="#15803d" strokeWidth="2" />
      <Circle cx="45" cy="136" r="4" fill="#22c55e" />
    </Svg>
  );
}
