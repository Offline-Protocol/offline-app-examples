import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function OutageHero({ size = 180 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Rect x={20} y={40} width={160} height={120} rx={12} fill="#1e3a5f" />
      <Path
        d="M60 100h80M100 60v80"
        stroke="#fbbf24"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Circle cx={100} cy={100} r={28} fill="#0ea5e9" opacity={0.9} />
      <Path
        d="M40 160h120"
        stroke="#64748b"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="8 8"
      />
    </Svg>
  );
}
