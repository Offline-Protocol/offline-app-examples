import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** A truck backing onto a dock door. */
export function DockHero({ size = 180 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Rect x={110} y={40} width={70} height={110} rx={6} fill="#1f2937" />
      <Rect x={122} y={62} width={46} height={70} rx={3} fill="#fbbf24" />
      <Path
        d="M122 80h46M122 98h46M122 116h46"
        stroke="#92400e"
        strokeWidth={3}
      />
      <Rect
        x={18}
        y={84}
        width={78}
        height={50}
        rx={4}
        fill="#f8fafc"
        stroke="#111827"
        strokeWidth={4}
      />
      <Circle cx={36} cy={142} r={10} fill="#111827" />
      <Circle cx={80} cy={142} r={10} fill="#111827" />
      <Path
        d="M100 108h6"
        stroke="#111827"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="2 6"
      />
      <Path
        d="M20 168h160"
        stroke="#64748b"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="8 8"
      />
    </Svg>
  );
}
