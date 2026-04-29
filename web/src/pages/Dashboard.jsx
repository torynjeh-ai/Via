import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyGroups } from '../api/users';
import { getWallet } from '../api/wallet';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import styles from './Dashboard.module.css';

const statusColor = { forming: '#FF9800', active: '#4CAF50', completed: '#9E9E9E' };

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    getMyGroups().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
    getWallet().then(r => setWallet(r.data)).catch(() => {});
  }, []);

  const active = groups.filter(g => g.status === 'active').length;
  const forming = groups.filter(g => g.status === 'forming').length;

  return (
    <div>
      {!user?.profile_complete && (
        <div className={styles.verifyBanner}>
          <span>🛡️</span>
          <div>
            <strong>{t('verifyBannerTitle')}</strong>
            <p>{t('verifyBannerDesc')}</p>
          </div>
          <Link to="/setup-profile" className={styles.verifyBtn}>{t('verifyNow')}</Link>
        </div>
      )}
      <div className={styles.welcome}>
        <h1>{t('hello')}, {user?.name} 👋</h1>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statNum}>{groups.length}</div><div className={styles.statLabel}>{t('totalGroups')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{active}</div><div className={styles.statLabel}>{t('active')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{forming}</div><div className={styles.statLabel}>{t('forming')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{user?.role}</div><div className={styles.statLabel}>{t('role')}</div></div>
      </div>

      {/* TC Balance card */}
      <Link to="/wallet" className={styles.tcCard}>
        <div className={styles.tcCardLeft}>
          <span className={styles.tcCardIcon}>💰</span>
          <div>
            <div className={styles.tcCardLabel}>TC Balance</div>
            <div className={styles.tcCardBalance}>
              {wallet != null
                ? Number(wallet.tc_balance).toFixed(2)
                : Number(user?.tc_balance ?? 0).toFixed(2)}{' '}
              TC
            </div>
            <div className={styles.tcCardXaf}>
              ≈ {((wallet?.tc_balance ?? user?.tc_balance ?? 0) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
            </div>
          </div>
        </div>
        <span className={styles.tcCardArrow}>→</span>
      </Link>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t('myGroups')}</h2>
          <Link to="/groups/create" className={styles.createBtn}>{t('createGroup')}</Link>
        </div>
        {loading ? <p>{t('loading')}</p> : groups.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('noGroupsYet')}</p>
            <Link to="/groups" className={styles.createBtn}>{t('browseGroups')}</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {groups.map(g => (
              <Link to={`/groups/${g.id}`} key={g.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{g.name}</h3>
                  <span className={styles.badge} style={{ background: statusColor[g.status] || '#9E9E9E' }}>{g.status}</span>
                </div>
                <p className={styles.amount}>{Number(g.contribution_amount).toLocaleString()} XAF</p>
                <p className={styles.meta}>{g.cycle} · {g.my_role}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
