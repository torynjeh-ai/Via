import React from 'react';
import { useTheme } from '../context/ThemeContext';
import logoLight from '../pages/logo-light.png';

export default function ViaLogo({ size = 64, className = '', forceMode }) {
  const { theme, palette } = useTheme();
  const isDark = forceMode ? forceMode === 'dark' : theme === 'dark';

  // Light mode: show logo in its original colors
  // Dark mode: convert to white so it's visible on dark bg,
  //            then tint with the current palette primary color
  let filter;
  if (isDark) {
    // brightness(0) makes everything black, invert(1) makes it white
    // Then sepia + saturate + hue-rotate tints it with the palette color
    // We extract hue from the palette accent hex
    const hue = hexToHue(palette?.accent || '#6C63FF');
    filter = `brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(${hue}deg)`;
  } else {
    // Light mode — no filter, use original logo colors
    filter = undefined;
  }

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
          transition:     'filter 0.3s ease',
        }}
      />
    </div>
  );
}

/**
 * Convert a hex color to its approximate HSL hue in degrees.
 * Used to tint the logo to match the current palette.
 */
function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  // The sepia filter produces ~36° hue, so subtract that as baseline
  return Math.round(h * 360) - 36;
}
