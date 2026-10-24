import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';

export default function NavHubIcon({ size = 26, color = '#0b1110' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Outer Rounded Frame */}
      <Rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="6.5"
        stroke={color}
        strokeWidth="2.6"
        fill="none"
      />

      {/* Inner Frame */}
      <Rect
        x="6.2"
        y="6.2"
        width="19.6"
        height="19.6"
        rx="2.2"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
      />

      {/* Top-Left: Rounded Square */}
      <Rect
        x="9.8"
        y="9.8"
        width="4.8"
        height="4.8"
        rx="1.2"
        fill={color}
      />

      {/* Top-Right: Solid Circle */}
      <Circle
        cx="19.4"
        cy="12.2"
        r="2.6"
        fill={color}
      />

      {/* Bottom-Left: Rounded Square */}
      <Rect
        x="9.8"
        y="17.4"
        width="4.8"
        height="4.8"
        rx="1.2"
        fill={color}
      />

      {/* Bottom-Right: Rounded Square */}
      <Rect
        x="17.4"
        y="17.4"
        width="4.8"
        height="4.8"
        rx="1.2"
        fill={color}
      />
    </Svg>
  );
}
