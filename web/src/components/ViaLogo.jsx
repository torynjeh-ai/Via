import React from 'react';
import { useTheme, PALETTES } from '../context/ThemeContext';
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

  const targetHue = PALETTE_HUES[paletteId] ?? BASE_HUE;
  const hueShift  = targetHue - BASE_HUE;

  // Light mode: hue-rotate to match palette colour
  // Dark mode:  invert to white, then hue-rotate
  const filter = isDark
    ? `invert(1) hue-rotate(${hueShift}deg)`
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

/**
 * ViaLogo
 *
 * Light mode: logo-light.png with mix-blend-mode:multiply (removes white box)
 * Dark mode:  logo-dark.png  with mix-blend-mode:screen  (removes dark box)
 *
 * Palette response: hue-rotate shifts the blue logo to match the current
 * primary colour. The base logo is blue (~220°). We calculate the offset
 * from blue to the target hue and apply it as hue-rotate.
 */

// Approximate hue of each palette's primary colour (degrees on colour wheel)
const PALETTE_HUES = {
  blue:  220,  // #6C63FF — blue-purple
  green: 142,  // #22C55E — green
  lime:  24,   // #F97316 — orange
  rose:  351,  // #FB7185 — rose/pink
  mauve: 280,  // #C084FC — purple/mauve
};

const BASE_HUE = 220; // hue of the original blue logo

export default function ViaLogo({ size = 64, className = '', forceMode }) {
  const { theme, paletteId } = useTheme();
  const isDark = forceMode ? forceMode === 'dark' : theme === 'dark';

  const targetHue = PALETTE_HUES[paletteId] ?? BASE_HUE;
  const hueShift  = targetHue - BASE_HUE;

  const filter = hueShift !== 0 ? `hue-rotate(${hueShift}deg)` : undefined;

  return (
    <div
      className={className}
      style={{
        width:        size,
        height:       size,
        borderRadius: Math.round(size * 0.28), // squircle — ~28% of size
        overflow:     'hidden',
        flexShrink:   0,
        display:      'inline-block',
        lineHeight:   0,
      }}
    >
      <img
        src={isDark ? logoDark : logoLight}
        alt="Via"
        style={{
          width:      '100%',
          height:     '100%',
          objectFit:  'cover',      // fills the square, crops excess — all 4 corners clip equally
          objectPosition: 'center',
          display:    'block',
          filter,
        }}
      />
    </div>
  );
}
