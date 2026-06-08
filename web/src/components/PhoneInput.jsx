import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './PhoneInput.module.css';

export const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',      dial: '+237', flag: '🇨🇲', digits: 9  },
  { code: 'NG', name: 'Nigeria',        dial: '+234', flag: '🇳🇬', digits: 10 },
  { code: 'GH', name: 'Ghana',          dial: '+233', flag: '🇬🇭', digits: 9  },
  { code: 'SN', name: 'Senegal',        dial: '+221', flag: '🇸🇳', digits: 9  },
  { code: 'CI', name: "Côte d'Ivoire",  dial: '+225', flag: '🇨🇮', digits: 10 },
  { code: 'KE', name: 'Kenya',          dial: '+254', flag: '🇰🇪', digits: 9  },
  { code: 'ZA', name: 'South Africa',   dial: '+27',  flag: '🇿🇦', digits: 9  },
  { code: 'TZ', name: 'Tanzania',       dial: '+255', flag: '🇹🇿', digits: 9  },
  { code: 'UG', name: 'Uganda',         dial: '+256', flag: '🇺🇬', digits: 9  },
  { code: 'RW', name: 'Rwanda',         dial: '+250', flag: '🇷🇼', digits: 9  },
  { code: 'ET', name: 'Ethiopia',       dial: '+251', flag: '🇪🇹', digits: 9  },
  { code: 'EG', name: 'Egypt',          dial: '+20',  flag: '🇪🇬', digits: 10 },
  { code: 'MA', name: 'Morocco',        dial: '+212', flag: '🇲🇦', digits: 9  },
  { code: 'TN', name: 'Tunisia',        dial: '+216', flag: '🇹🇳', digits: 8  },
  { code: 'DZ', name: 'Algeria',        dial: '+213', flag: '🇩🇿', digits: 9  },
  { code: 'CD', name: 'DR Congo',       dial: '+243', flag: '🇨🇩', digits: 9  },
  { code: 'AO', name: 'Angola',         dial: '+244', flag: '🇦🇴', digits: 9  },
  { code: 'MZ', name: 'Mozambique',     dial: '+258', flag: '🇲🇿', digits: 9  },
  { code: 'ZM', name: 'Zambia',         dial: '+260', flag: '🇿🇲', digits: 9  },
  { code: 'ZW', name: 'Zimbabwe',       dial: '+263', flag: '🇿🇼', digits: 9  },
  { code: 'BJ', name: 'Benin',          dial: '+229', flag: '🇧🇯', digits: 8  },
  { code: 'BF', name: 'Burkina Faso',   dial: '+226', flag: '🇧🇫', digits: 8  },
  { code: 'ML', name: 'Mali',           dial: '+223', flag: '🇲🇱', digits: 8  },
  { code: 'NE', name: 'Niger',          dial: '+227', flag: '🇳🇪', digits: 8  },
  { code: 'TD', name: 'Chad',           dial: '+235', flag: '🇹🇩', digits: 8  },
  { code: 'GA', name: 'Gabon',          dial: '+241', flag: '🇬🇦', digits: 8  },
  { code: 'CG', name: 'Congo',          dial: '+242', flag: '🇨🇬', digits: 9  },
  { code: 'GN', name: 'Guinea',         dial: '+224', flag: '🇬🇳', digits: 9  },
  { code: 'TG', name: 'Togo',           dial: '+228', flag: '🇹🇬', digits: 8  },
  { code: 'MR', name: 'Mauritania',     dial: '+222', flag: '🇲🇷', digits: 8  },
  { code: 'GB', name: 'United Kingdom', dial: '+44',  flag: '🇬🇧', digits: 10 },
  { code: 'FR', name: 'France',         dial: '+33',  flag: '🇫🇷', digits: 9  },
  { code: 'DE', name: 'Germany',        dial: '+49',  flag: '🇩🇪', digits: 11 },
  { code: 'US', name: 'United States',  dial: '+1',   flag: '🇺🇸', digits: 10 },
  { code: 'CA', name: 'Canada',         dial: '+1-CA',flag: '🇨🇦', digits: 10 },
  { code: 'CN', name: 'China',          dial: '+86',  flag: '🇨🇳', digits: 11 },
  { code: 'IN', name: 'India',          dial: '+91',  flag: '🇮🇳', digits: 10 },
  { code: 'BR', name: 'Brazil',         dial: '+55',  flag: '🇧🇷', digits: 11 },
  { code: 'AU', name: 'Australia',      dial: '+61',  flag: '🇦🇺', digits: 9  },
  { code: 'AE', name: 'UAE',            dial: '+971', flag: '🇦🇪', digits: 9  },
];

// Canada uses +1 same as US — strip the -CA suffix when outputting
const getDialCode = (country) => country.dial.replace('-CA', '');

// Parse an E.164 number back into { country, localNumber }
function parsePhoneValue(value) {
  if (!value) return { country: COUNTRIES[0], localNumber: '' };
  const normalized = value.startsWith('+') ? value : `+${value}`;
  // Try longest match first to avoid +1 matching before +234 etc.
  const sorted = [...COUNTRIES].sort((a, b) => getDialCode(b).length - getDialCode(a).length);
  for (const c of sorted) {
    const dial = getDialCode(c);
    if (normalized.startsWith(dial)) {
      return { country: c, localNumber: normalized.slice(dial.length) };
    }
  }
  return { country: COUNTRIES[0], localNumber: value.replace(/^\+?\d{1,4}/, '') };
}

export default function PhoneInput({ label, value, onChange, required }) {
  const parsed = parsePhoneValue(value);
  const [selected, setSelected] = useState(parsed.country);
  const [number, setNumber]     = useState(parsed.localNumber);
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [touched, setTouched]   = useState(false);
  const dropRef = useRef(null);

  // Sync value prop → internal state (controlled mode)
  useEffect(() => {
    if (!value) return;
    const { country, localNumber } = parsePhoneValue(value);
    setSelected(country);
    setNumber(localNumber);
  }, [value]);

  // Emit full E.164 number upward
  const emit = useCallback((country, num) => {
    onChange(`${getDialCode(country)}${num}`);
  }, [onChange]);

  useEffect(() => {
    emit(selected, number);
  }, [selected, number, emit]);

  // Close on outside click
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

  // Validation
  const expectedDigits = selected.digits;
  const isValid = number.length === 0 || number.length === expectedDigits;
  const showError = touched && number.length > 0 && !isValid;

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={`${styles.inputRow} ${showError ? styles.inputError : ''}`}>

        {/* Country picker */}
        <div className={styles.pickerWrap} ref={dropRef}>
          <button
            type="button"
            className={styles.pickerBtn}
            onClick={() => setOpen(o => !o)}
            aria-label={`Selected country: ${selected.name} ${getDialCode(selected)}`}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className={styles.flag}>{selected.flag}</span>
            <span className={styles.dial}>{getDialCode(selected)}</span>
            <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
          </button>

          {open && (
            <div className={styles.dropdown} role="listbox" aria-label="Select country">
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  aria-label="Search countries"
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
                    role="option"
                    aria-selected={selected.code === c.code}
                    className={`${styles.option} ${selected.code === c.code ? styles.optionActive : ''}`}
                    onClick={() => handleSelect(c)}
                  >
                    <span className={styles.flag}>{c.flag}</span>
                    <span className={styles.optionName}>{c.name}</span>
                    <span className={styles.optionDial}>{getDialCode(c)}</span>
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
          autoComplete="tel-national"
          placeholder=""
          value={number}
          onChange={e => setNumber(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => setTouched(true)}
          required={required}
          maxLength={expectedDigits ? expectedDigits + 2 : 15}
          aria-label="Phone number"
          aria-invalid={showError}
        />
      </div>

      {showError && (
        <p className={styles.errorMsg}>
          {selected.name} numbers are {expectedDigits} digits
          ({number.length} entered)
        </p>
      )}
    </div>
  );
}
