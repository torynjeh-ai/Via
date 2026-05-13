import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroups } from '../api/groups';
import { getNotifications } from '../api/users';
import { useLanguage } from '../context/LanguageContext';
import styles from './GlobalSearch.module.css';

const NAV_PAGES = [
  { label: 'Dashboard', path: '/', icon: '🏠', keywords: ['dashboard', 'home', 'tableau', 'overview'] },
  { label: 'Groups', path: '/groups', icon: '👥', keywords: ['groups', 'groupes', 'njangi', 'tontine'] },
  { label: 'Create Group', path: '/groups/create', icon: '➕', keywords: ['create group', 'new group', 'nouveau groupe', 'add group'] },
  { label: 'Wallet', path: '/wallet', icon: '👛', keywords: ['wallet', 'portefeuille', 'balance', 'solde', 'money', 'argent', 'trust coin', 'tc'] },
  { label: 'Deposit', path: '/wallet/topup', icon: '💳', keywords: ['top up', 'topup', 'deposit', 'recharge', 'add money', 'fund', 'recharger'] },
  { label: 'Withdraw', path: '/wallet/withdraw', icon: '🏧', keywords: ['withdraw', 'withdrawal', 'retrait', 'cash out', 'payout'] },
  { label: 'Transfer', path: '/wallet/transfer', icon: '💸', keywords: ['transfer', 'send money', 'transfert', 'envoyer', 'send', 'pay'] },
  { label: 'Transaction History', path: '/wallet/transactions', icon: '📋', keywords: ['transactions', 'history', 'historique', 'activity', 'activité', 'statement'] },
  { label: 'Receipts', path: '/receipts', icon: '🧾', keywords: ['receipts', 'reçus', 'invoices', 'factures', 'proof', 'payment proof'] },
  { label: 'Notifications', path: '/notifications', icon: '🔔', keywords: ['notifications', 'alerts', 'alertes', 'messages'] },
  { label: 'Profile', path: '/profile', icon: '👤', keywords: ['profile', 'profil', 'account', 'compte', 'my info', 'personal'] },
  { label: 'Settings', path: '/settings', icon: '⚙️', keywords: ['settings', 'paramètres', 'preferences', 'configuration', 'config'] },
];

export default function GlobalSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ groups: [], notifications: [], pages: [] });
  const [allGroups, setAllGroups] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    getGroups().then(r => setAllGroups(r.data || [])).catch(() => {});
    getNotifications().then(r => setAllNotifications(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults({ groups: [], notifications: [], pages: [] }); setOpen(false); return; }
    const q = query.toLowerCase();

    const groups = allGroups.filter(g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)).slice(0, 3);
    const notifications = allNotifications.filter(n => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)).slice(0, 3);
    const pages = NAV_PAGES.filter(p => p.label.toLowerCase().includes(q) || p.keywords.some(k => k.includes(q)));

    setResults({ groups, notifications, pages });
    setOpen(true);
  }, [query, allGroups, allNotifications]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (path) => {
    setQuery('');
    setOpen(false);
    navigate(path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setQuery(''); setOpen(false); }
  };

  const totalResults = results.groups.length + results.notifications.length + results.pages.length;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputWrap}>
        <span className={styles.icon}>🔍</span>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Search groups, notifications, pages..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setOpen(true)}
        />
        {query && (
          <button className={styles.clear} onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}>✕</button>
        )}
      </div>

      {open && (
        <div className={styles.dropdown}>
          {totalResults === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            <>
              {results.pages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Pages</div>
                  {results.pages.map(p => (
                    <button key={p.path} className={styles.result} onClick={() => handleSelect(p.path)}>
                      <span className={styles.resultIcon}>{p.icon}</span>
                      <span className={styles.resultName}>{p.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.groups.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Groups</div>
                  {results.groups.map(g => (
                    <button key={g.id} className={styles.result} onClick={() => handleSelect(`/groups/${g.id}`)}>
                      <span className={styles.resultIcon}>👥</span>
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{g.name}</span>
                        <span className={styles.resultMeta}>{Number(g.contribution_amount).toLocaleString()} XAF · {g.cycle}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.notifications.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Notifications</div>
                  {results.notifications.map(n => (
                    <button key={n.id} className={styles.result} onClick={() => handleSelect('/notifications')}>
                      <span className={styles.resultIcon}>🔔</span>
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{n.title}</span>
                        <span className={styles.resultMeta}>{n.message.substring(0, 50)}...</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
