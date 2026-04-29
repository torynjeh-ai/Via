import React, { createContext, useContext, useEffect, useState } from 'react';

// Each palette defines the CSS variable overrides for --primary and related accent colors.
// The sidebar bg stays dark; only the accent/primary changes.
export const PALETTES = [
  {
    id: 'blue',
    label: 'Ocean Blue',
    accent: '#6C63FF',
    accentDark: '#5a52d5',
    top: '#6C63FF',    // top-left of swatch
    bottom: '#1A1A2E', // bottom-right of swatch
  },
  {
    id: 'green',
    label: 'Forest Green',
    accent: '#22C55E',
    accentDark: '#16a34a',
    top: '#22C55E',
    bottom: '#7C3AED',
  },
  {
    id: 'lime',
    label: 'Sunset Orange',
    accent: '#F97316',
    accentDark: '#ea6c0a',
    top: '#F97316',
    bottom: '#7C3AED',
  },
  {
    id: 'rose',
    label: 'Rose',
    accent: '#FB7185',
    accentDark: '#f43f5e',
    top: '#FB7185',
    bottom: '#7C3AED',
  },
  {
    id: 'mauve',
    label: 'Mauve',
    accent: '#C084FC',
    accentDark: '#a855f7',
    top: '#C084FC',
    bottom: '#6B7280',
  },
];

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [paletteId, setPaletteId] = useState(() => localStorage.getItem('palette') || 'blue');

  const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];

  // Apply theme (light/dark)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Apply palette CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', palette.accent);
    root.style.setProperty('--primary-dark', palette.accentDark);
    localStorage.setItem('palette', paletteId);
  }, [paletteId, palette]);

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const setPalette = (id) => setPaletteId(id);

  return (
    <ThemeContext.Provider value={{ theme, toggle, paletteId, setPalette, palette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
