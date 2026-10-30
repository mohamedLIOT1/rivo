import React from 'react';
import Svg, { Rect } from 'react-native-svg';

export default function NavHubIcon({ size = 20, color = '#17a398' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* ⊞ Minimal 4-Dots Grid */}
      <Rect x="3" y="3" width="7.5" height="7.5" rx="2.2" fill={color} />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2" fill={color} />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2" fill={color} />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2" fill={color} />
    </Svg>
  );
}
