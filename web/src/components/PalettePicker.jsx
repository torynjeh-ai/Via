import React from 'react';
import { useTheme, PALETTES } from '../context/ThemeContext';
import styles from './PalettePicker.module.css';

export default function PalettePicker() {
  const { paletteId, setPalette } = useTheme();

  return (
    <div className={styles.wrap}>
      {PALETTES.map((p, i) => (
        <React.Fragment key={p.id}>
          {/* Divider after first swatch (like the image) */}
          {i === 1 && <div className={styles.divider} />}
          <button
            className={`${styles.swatch} ${paletteId === p.id ? styles.active : ''}`}
            onClick={() => setPalette(p.id)}
            title={p.label}
            aria-label={p.label}
          >
            {/* Top-left quadrant */}
            <span className={styles.tl} style={{ background: p.top }} />
            {/* Bottom-right quadrant */}
            <span className={styles.br} style={{ background: p.bottom }} />
            {/* Checkmark overlay when active */}
            {paletteId === p.id && (
              <span className={styles.check}>✓</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
