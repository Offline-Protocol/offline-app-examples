import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function EventHero({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Rect x="30" y="50" width="120" height="90" rx="8" stroke="#7c3aed" strokeWidth="3" fill="#ede9fe" />
      <Circle cx="90" cy="85" r="28" stroke="#5b21b6" strokeWidth="2" fill="#fff" />
      <Path d="M75 95 L88 108 L108 78" stroke="#5b21b6" strokeWidth="3" strokeLinecap="round" />
      <Rect x="55" y="120" width="70" height="8" rx="2" fill="#a78bfa" />
    </Svg>
  );
}
