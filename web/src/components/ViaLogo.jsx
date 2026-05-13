import React from 'react';
import { useTheme } from '../context/ThemeContext';
import logoLight from '../pages/logo-light.png';

const PALETTE_HUES = {
  blue:  220,
  green: 142,
  lime:  24,
  rose:  351,
  mauve: 280,
};
const BASE_HUE = 220;

export default function ViaLogo({ size = 64, className = '', forceMode }) {
  const { theme, paletteId } = useTheme();
  const isDark = forceMode ? forceMode === 'dark' : theme === 'dark';

  const hueShift = (PALETTE_HUES[paletteId] ?? BASE_HUE) - BASE_HUE;

  const filter = isDark
    ? `invert(1)${hueShift !== 0 ? ` hue-rotate(${hueShift}deg)` : ''}`
    : hueShift !== 0 ? `hue-rotate(${hueShift}deg)` : undefined;

  return (
    <div
      className={className}
      style={{
        width:        size,
        height:       size,
        borderRadius: Math.round(size * 0.28),
        overflow:     'hidden',
        flexShrink:   0,
        display:      'inline-block',
        lineHeight:   0,
      }}
    >
      <img
        src={logoLight}
        alt="Via"
        style={{
          width:          '100%',
          height:         '100%',
          objectFit:      'cover',
          objectPosition: 'center',
          display:        'block',
          filter,
        }}
      />
    </div>
  );
}
