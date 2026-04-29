import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, PALETTES } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import LanguagePicker from '../components/LanguagePicker';
import styles from './Settings.module.css';

export default function Settings() {
  const { theme, toggle, paletteId, setPalette } = useTheme();
  const { user, signOut } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSignOut = () => { signOut(); navigate('/login'); };

  return (
    <div className={styles.container}>
      <h1>{t('settingsTitle')}</h1>

      {/* Appearance */}
      <div className={styles.card}>
        <h2>{t('appearance')}</h2>

        <div className={styles.row}>
          <div>
            <div className={styles.label}>{t('theme')}</div>
            <div className={styles.sub}>{t('themeDesc')}</div>
          </div>
          <button
            className={`${styles.themeToggle} ${theme === 'dark' ? styles.dark : styles.light}`}
            onClick={toggle}
          >
            <span className={styles.knob}>
              {theme === 'dark' ? (
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
            <span className={styles.themeLabel}>
              {theme === 'dark' ? t('darkMode') : t('lightMode')}
            </span>
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.label} style={{ marginBottom: 14 }}>{t('colorPalette')}</div>
        <div className={styles.palettes}>
          {PALETTES.map((p, i) => (
            <React.Fragment key={p.id}>
              {i === 1 && <div className={styles.palDivider} />}
              <button
                className={`${styles.swatch} ${paletteId === p.id ? styles.swatchActive : ''}`}
                onClick={() => setPalette(p.id)}
                title={p.label}
              >
                <span className={styles.tl} style={{ background: p.top }} />
                <span className={styles.br} style={{ background: p.bottom }} />
                {paletteId === p.id && <span className={styles.check}>✓</span>}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className={styles.paletteName}>
          {PALETTES.find(p => p.id === paletteId)?.label}
        </div>
      </div>

      {/* Language */}
      <div className={styles.card}>
        <h2>{t('language')}</h2>
        <div className={styles.langPickerRow}>
          <div>
            <div className={styles.label}>{t('languageDesc')}</div>
            <div className={styles.langCurrent}>
              {LANGUAGES.find(l => l.id === lang)?.flag} {LANGUAGES.find(l => l.id === lang)?.nativeLabel}
            </div>
          </div>
          <LanguagePicker upward />
        </div>
      </div>

      {/* Account */}
      <div className={styles.card}>
        <h2>{t('account')}</h2>
        <div className={styles.accountRow}>
          {user?.profile_picture_url ? (
            <img 
              src={user.profile_picture_url} 
              alt="Profile" 
              className={styles.accountProfileImage}
            />
          ) : (
            <div className={styles.accountAvatar}>{user?.name?.[0]?.toUpperCase()}</div>
          )}
          <div>
            <div className={styles.accountName}>{user?.name}</div>
            <div className={styles.accountPhone}>{user?.phone}</div>
          </div>
        </div>
        <div className={styles.divider} />
        <button className={styles.logoutBtn} onClick={() => setConfirmOpen(true)}>
          {t('logOut')}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className={styles.overlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3>{t('logOutConfirm')}</h3>
            <p>{t('logOutDesc')}</p>
            <div className={styles.modalBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirmOpen(false)}>{t('cancel')}</button>
              <button className={styles.confirmBtn} onClick={handleSignOut}>{t('yesLogOut')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
