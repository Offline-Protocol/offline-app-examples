import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function YardHero({ size = 180 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Rect x="20" y="70" width="140" height="70" rx="8" stroke="#0f766e" strokeWidth="3" fill="#ccfbf1" />
      <Path d="M50 70 L90 35 L130 70" stroke="#0f766e" strokeWidth="3" fill="#99f6e4" />
      <Rect x="78" y="95" width="24" height="45" rx="2" stroke="#134e4a" strokeWidth="2" fill="#fff" />
      <Circle cx="135" cy="120" r="22" stroke="#ea580c" strokeWidth="3" fill="#ffedd5" />
      <Path d="M125 120 L133 128 L148 108" stroke="#c2410c" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}
