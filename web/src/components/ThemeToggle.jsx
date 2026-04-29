import React from 'react';
import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={`${styles.toggle} ${isDark ? styles.dark : styles.light}`}
      onClick={toggle}
      aria-label="Toggle theme"
    >
      <span className={styles.knob}>
        {isDark ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </span>
      <span className={styles.label}>
        {isDark ? 'DARK MODE' : 'LIGHT MODE'}
      </span>
    </button>
  );
}
