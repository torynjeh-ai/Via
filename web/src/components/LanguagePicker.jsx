import React, { useState, useRef, useEffect } from 'react';
import { LANGUAGES, useLanguage } from '../context/LanguageContext';
import styles from './LanguagePicker.module.css';

export default function LanguagePicker({ compact = false, upward = false }) {
  const { lang, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGUAGES.find(l => l.id === lang) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${compact ? styles.compact : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Change language"
      >
        <span className={styles.flag}>{current.flag}</span>
        {!compact && <span className={styles.label}>{current.nativeLabel}</span>}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={upward ? styles.dropdownUp : styles.dropdown}>
          {LANGUAGES.map(l => (
            <button
              key={l.id}
              type="button"
              className={`${styles.option} ${lang === l.id ? styles.active : ''}`}
              onClick={() => { setLanguage(l.id); setOpen(false); }}
            >
              <span className={styles.optFlag}>{l.flag}</span>
              <span className={styles.optNative}>{l.nativeLabel}</span>
              <span className={styles.optLabel}>{l.label}</span>
              {lang === l.id && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
