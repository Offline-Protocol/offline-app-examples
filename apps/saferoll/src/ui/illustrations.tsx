import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function SafeRollHero({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Rect x="30" y="40" width="120" height="70" rx="8" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
      <Path d="M45 55 H135 M45 70 H120 M45 85 H100" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <Rect x="55" y="120" width="70" height="35" rx="6" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
      <Circle cx="90" cy="137" r="10" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
      <Path
        d="M85 137 L89 141 L96 132"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M130 60 L150 50 L145 75 L160 85 L140 90 L130 110 L120 85 L100 75 L120 65 Z"
        fill="#fecaca"
        stroke="#dc2626"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
