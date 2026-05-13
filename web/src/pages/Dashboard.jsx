import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyGroups } from '../api/users';
import { getWallet } from '../api/wallet';
import { getSavingsGoals } from '../api/savings';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import GroupPoolCard from '../components/GroupPoolCard';
import { formatDate } from '../utils/dateFormat';
import styles from './Dashboard.module.css';

const statusColor = { forming: '#FF9800', active: '#4CAF50', completed: '#9E9E9E' };

const CATEGORY_ICONS = {
  General:'💰', Education:'📚', Health:'🏥', Travel:'✈️',
  Business:'💼', Emergency:'🚨', Housing:'🏠', Technology:'💻', Other:'🎯',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet]   = useState(null);
  const [goals, setGoals]     = useState([]);

  useEffect(() => {
    getMyGroups().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
    getWallet().then(r => setWallet(r.data)).catch(() => {});
    if (user?.is_verified) {
      getSavingsGoals().then(r => setGoals(r.data || [])).catch(() => {});
    }
  }, [user?.is_verified]);

  const active  = groups.filter(g => g.status === 'active').length;
  const forming = groups.filter(g => g.status === 'forming').length;
  const activeGoals = goals.filter(g => g.status === 'active');

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

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statNum}>{groups.length}</div><div className={styles.statLabel}>{t('totalGroups')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{active}</div><div className={styles.statLabel}>{t('active')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{forming}</div><div className={styles.statLabel}>{t('forming')}</div></div>
        <div className={styles.stat}><div className={styles.statNum}>{activeGoals.length}</div><div className={styles.statLabel}>Savings Goals</div></div>
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
                : Number(user?.tc_balance ?? 0).toFixed(2)}{' '}TC
            </div>
            <div className={styles.tcCardXaf}>
              ≈ {((wallet?.tc_balance ?? user?.tc_balance ?? 0) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
            </div>
          </div>
        </div>
        <span className={styles.tcCardArrow}>→</span>
      </Link>

      {/* Personal Savings Goals */}
      {user?.profile_complete && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>🎯 My Savings</h2>
            <Link to="/savings/new" className={styles.createBtn}>+ New Goal</Link>
          </div>
          {activeGoals.length === 0 ? (
            <div className={styles.savingsEmpty}>
              <p>No active savings goals.</p>
              <Link to="/savings/new" className={styles.createBtn}>Start saving →</Link>
            </div>
          ) : (
            <div className={styles.savingsGrid}>
              {activeGoals.slice(0, 3).map(g => {
                const pct = g.target_amount > 0 ? Math.round((g.saved_amount / g.target_amount) * 100) : 0;
                const remaining = Math.max(0, g.target_amount - g.saved_amount);
                const daysLeft = Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24));
                const icon = CATEGORY_ICONS[g.category] || '💰';
                return (
                  <Link to="/savings" key={g.id} className={styles.savingsCard}>
                    <div className={styles.savingsCardHeader}>
                      <span className={styles.savingsIcon}>{icon}</span>
                      <div className={styles.savingsInfo}>
                        <div className={styles.savingsName}>{g.name}</div>
                        <div className={styles.savingsMeta}>
                          {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'} · Due {formatDate(g.target_date)}
                        </div>
                      </div>
                      <span className={styles.savingsPct}>{pct}%</span>
                    </div>
                    <div className={styles.savingsBarWrap}>
                      <div className={styles.savingsBar} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className={styles.savingsAmounts}>
                      <span>{Number(g.saved_amount).toLocaleString()} XAF saved</span>
                      <span>{Number(remaining).toLocaleString()} XAF left</span>
                    </div>
                  </Link>
                );
              })}
              {activeGoals.length > 3 && (
                <Link to="/savings" className={styles.viewAllGoals}>
                  View all {activeGoals.length} goals →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* My Groups */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t('myGroups')}</h2>
          <Link to="/groups" className={styles.createBtn}>+ Create Group</Link>
        </div>
        {loading ? <p>{t('loading')}</p> : groups.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('noGroupsYet')}</p>
            <Link to="/groups" className={styles.createBtn}>{t('browseGroups')}</Link>
          </div>
        ) : (
          <>
            {groups.filter(g => g.status === 'active' && g.group_type !== 'flexible').map(g => (
              <div key={g.id} className={styles.poolWrap}>
                <GroupPoolCard groupId={g.id} groupName={g.name} compact />
              </div>
            ))}
            <div className={styles.grid}>
              {groups.filter(g => g.status !== 'active').map(g => {
                const isFundraiser = g.group_type === 'flexible';
                const href = isFundraiser ? `/groups/${g.id}/flexible` : `/groups/${g.id}`;
                return (
                  <Link to={href} key={g.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h3>{g.name}</h3>
                      <span className={styles.badge} style={{ background: statusColor[g.status] || '#9E9E9E' }}>{g.status}</span>
                    </div>
                    {isFundraiser
                      ? <p className={styles.amount}>🎯 Fundraiser</p>
                      : <p className={styles.amount}>{Number(g.contribution_amount).toLocaleString()} XAF</p>
                    }
                    <p className={styles.meta}>{isFundraiser ? 'Any amount · Admin-controlled' : `${g.cycle} · ${g.my_role}`}</p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
