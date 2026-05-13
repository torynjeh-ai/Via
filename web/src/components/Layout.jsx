import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useLocation } from '../hooks/useLocation';
import { getNotifications } from '../api/users';
import ViaLogo from './ViaLogo';
import GlobalSearch from './GlobalSearch';
import styles from './Layout.module.css';

export default function Layout({ children }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const locationStatus = useLocation(user);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      getNotifications()
        .then(r => setUnreadCount((r.data || []).filter(n => !n.is_read).length))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [user]);

  // Show warning if location denied — always for admins, dismissable for regular users
  const showLocationWarning = locationStatus === 'denied' && !bannerDismissed;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const links = [
    { to: '/', label: `🏠 ${t('dashboard')}` },
    { to: '/groups', label: `👥 ${t('groups')}` },
    { to: '/savings', label: `🎯 My Savings` },
    { to: '/wallet', label: `💰 Wallet` },
    { to: '/notifications', label: `🔔 ${t('notifications')}`, badge: unreadCount },
    { to: '/receipts', label: `🧾 Receipts` },
    { to: '/profile', label: `👤 ${t('profile')}` },
    { to: '/settings', label: `⚙️ ${t('settings')}` },
    ...(isAdmin ? [{ to: '/admin', label: '🛠 Admin Panel' }] : []),
  ];

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
        <div className={styles.logo}><ViaLogo size={72} forceMode="dark" /></div>
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
              <span>{l.label}</span>
              {l.badge > 0 && <span className={styles.badge}>{l.badge > 99 ? '99+' : l.badge}</span>}
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
          <span className={styles.headerTitle}><ViaLogo size={36} /></span>
          <button className={styles.headerThemeBtn} onClick={toggle} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>
        <main className={styles.content}>
          {showLocationWarning && (
            <div className={`${styles.locationBanner} ${isAdmin ? styles.locationBannerAdmin : ''}`}>
              <span>📍</span>
              <div className={styles.locationBannerText}>
                {isAdmin
                  ? <strong>Location access is required for group admins. Please enable location in your browser settings to continue managing groups.</strong>
                  : <span>Location access is off. Group admins may not be able to add you to location-restricted groups. <strong>Enable location for better security.</strong></span>
                }
              </div>
              {!isAdmin && (
                <button className={styles.locationBannerDismiss} onClick={() => setBannerDismissed(true)}>✕</button>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
