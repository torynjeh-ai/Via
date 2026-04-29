import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import GlobalSearch from './GlobalSearch';
import styles from './Layout.module.css';

export default function Layout({ children }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: `🏠 ${t('dashboard')}` },
    { to: '/groups', label: `👥 ${t('groups')}` },
    { to: '/wallet', label: `💰 Wallet` },
    { to: '/notifications', label: `🔔 ${t('notifications')}` },
    { to: '/receipts', label: `🧾 Receipts` },
    { to: '/profile', label: `👤 ${t('profile')}` },
    { to: '/settings', label: `⚙️ ${t('settings')}` },
  ];

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
        <div className={styles.logo}>Via</div>
        <div className={styles.userInfo}>
          {user?.profile_picture_url ? (
            <img src={user.profile_picture_url} alt="Profile" className={styles.profileImage} />
          ) : (
            <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          )}
          <div className={styles.userText}>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userRole}>{user?.role}</div>
          </div>
        </div>
        <nav className={styles.nav}>
          {links.map(l => (
            <NavLink
              key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <div className={styles.topBar}>
          <GlobalSearch />
          <button className={styles.headerThemeBtn} onClick={toggle} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <span className={styles.headerTitle}>Via</span>
          <button className={styles.headerThemeBtn} onClick={toggle} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
