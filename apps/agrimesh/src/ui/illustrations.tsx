import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function AgriHero({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <Rect x="20" y="100" width="140" height="40" rx="6" fill="#bbf7d0" stroke="#15803d" strokeWidth="2" />
      <Path d="M40 100 Q90 40 140 100" stroke="#166534" strokeWidth="3" fill="none" />
      <Circle cx="90" cy="72" r="14" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2" />
      <Rect x="70" y="115" width="40" height="18" rx="4" fill="#fff" stroke="#15803d" strokeWidth="2" />
      <Path d="M78 124 L86 132 L102 118" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
