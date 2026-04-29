import React, { useState, useRef, useEffect } from 'react';
import styles from './PhoneInput.module.css';

export const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',           dial: '+237', flag: '🇨🇲' },
  { code: 'NG', name: 'Nigeria',             dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',               dial: '+233', flag: '🇬🇭' },
  { code: 'SN', name: 'Senegal',             dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire",       dial: '+225', flag: '🇨🇮' },
  { code: 'KE', name: 'Kenya',               dial: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',        dial: '+27',  flag: '🇿🇦' },
  { code: 'TZ', name: 'Tanzania',            dial: '+255', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda',              dial: '+256', flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda',              dial: '+250', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia',            dial: '+251', flag: '🇪🇹' },
  { code: 'EG', name: 'Egypt',               dial: '+20',  flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco',             dial: '+212', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisia',             dial: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria',             dial: '+213', flag: '🇩🇿' },
  { code: 'CD', name: 'DR Congo',            dial: '+243', flag: '🇨🇩' },
  { code: 'AO', name: 'Angola',              dial: '+244', flag: '🇦🇴' },
  { code: 'MZ', name: 'Mozambique',          dial: '+258', flag: '🇲🇿' },
  { code: 'ZM', name: 'Zambia',              dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',            dial: '+263', flag: '🇿🇼' },
  { code: 'BJ', name: 'Benin',               dial: '+229', flag: '🇧🇯' },
  { code: 'BF', name: 'Burkina Faso',        dial: '+226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali',                dial: '+223', flag: '🇲🇱' },
  { code: 'NE', name: 'Niger',               dial: '+227', flag: '🇳🇪' },
  { code: 'TD', name: 'Chad',                dial: '+235', flag: '🇹🇩' },
  { code: 'GA', name: 'Gabon',               dial: '+241', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo',               dial: '+242', flag: '🇨🇬' },
  { code: 'GN', name: 'Guinea',              dial: '+224', flag: '🇬🇳' },
  { code: 'TG', name: 'Togo',                dial: '+228', flag: '🇹🇬' },
  { code: 'MR', name: 'Mauritania',          dial: '+222', flag: '🇲🇷' },
  { code: 'GB', name: 'United Kingdom',      dial: '+44',  flag: '🇬🇧' },
  { code: 'FR', name: 'France',              dial: '+33',  flag: '🇫🇷' },
  { code: 'DE', name: 'Germany',             dial: '+49',  flag: '🇩🇪' },
  { code: 'US', name: 'United States',       dial: '+1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',              dial: '+1',   flag: '🇨🇦' },
  { code: 'CN', name: 'China',               dial: '+86',  flag: '🇨🇳' },
  { code: 'IN', name: 'India',               dial: '+91',  flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil',              dial: '+55',  flag: '🇧🇷' },
  { code: 'AU', name: 'Australia',           dial: '+61',  flag: '🇦🇺' },
  { code: 'AE', name: 'UAE',                 dial: '+971', flag: '🇦🇪' },
];

export default function PhoneInput({ label, value, onChange, required }) {
  const [selected, setSelected] = useState(COUNTRIES[0]); // default Cameroon
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef(null);

  // Sync full phone value upward
  useEffect(() => {
    onChange(`${selected.dial}${number}`);
  }, [selected, number]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  const handleSelect = (country) => {
    setSelected(country);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputRow}>
        {/* Country code picker */}
        <div className={styles.pickerWrap} ref={dropRef}>
          <button
            type="button"
            className={styles.pickerBtn}
            onClick={() => setOpen(o => !o)}
          >
            <span className={styles.flag}>{selected.flag}</span>
            <span className={styles.dial}>{selected.dial}</span>
            <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
          </button>

          {open && (
            <div className={styles.dropdown}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.list}>
                {filtered.length === 0 && (
                  <div className={styles.noResult}>No results</div>
                )}
                {filtered.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    className={`${styles.option} ${selected.code === c.code ? styles.optionActive : ''}`}
                    onClick={() => handleSelect(c)}
                  >
                    <span className={styles.flag}>{c.flag}</span>
                    <span className={styles.optionName}>{c.name}</span>
                    <span className={styles.optionDial}>{c.dial}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Number input */}
        <input
          className={styles.numberInput}
          type="tel"
          placeholder=""
          value={number}
          onChange={e => setNumber(e.target.value.replace(/[^\d]/g, ''))}
          required={required}
        />
      </div>
    </div>
  );
}
