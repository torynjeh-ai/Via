import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getGroups } from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import styles from './Groups.module.css';

// ── Group type selection modal ─────────────────────────────────────────────
function CreateGroupModal({ onClose, onSelect }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.typeModal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.typeModalTitle}>What kind of group do you want to create?</h2>
        <p className={styles.typeModalSub}>Choose the type that best fits your goal.</p>

        <div className={styles.typeCards}>
          {/* Savings Circle */}
          <button className={styles.typeCard} onClick={() => onSelect('savings-circle')}>
            <div className={styles.typeCardIcon}>🔄</div>
            <div className={styles.typeCardName}>Savings Circle</div>
            <div className={styles.typeCardDesc}>
              Members contribute a fixed amount each cycle and take turns receiving the full pool.
              Great for disciplined group saving and rotating payouts.
            </div>
            <div className={styles.typeCardTag}>Fixed amount · Rotating payouts</div>
          </button>

          {/* Fundraiser */}
          <button className={styles.typeCard} onClick={() => onSelect('fundraiser')}>
            <div className={styles.typeCardIcon}>🎯</div>
            <div className={styles.typeCardName}>Fundraiser</div>
            <div className={styles.typeCardDesc}>
              Members contribute any amount, any time. The admin decides how the pooled money
              is used. Great for emergencies, shared expenses, or community projects.
            </div>
            <div className={styles.typeCardTag}>Any amount · Admin-controlled</div>
          </button>
        </div>

        <button className={styles.typeModalCancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Groups() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);

  useEffect(() => {
    getGroups().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreateClick = () => {
    if (!user?.profile_complete) { navigate('/setup-profile'); return; }
    setShowTypeModal(true);
  };

  const handleTypeSelect = (type) => {
    setShowTypeModal(false);
    if (type === 'savings-circle') navigate('/groups/create');
    else navigate('/groups/create-flexible');
  };

  return (
    <div>
      <div className={styles.header}>
        <h1>{t('allGroups')}</h1>
        <button className={styles.createBtn} onClick={handleCreateClick}>+ Create Group</button>
      </div>

      <input
        className={styles.search}
        placeholder={t('searchGroups')}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? <p>{t('loading')}</p> : (
        <div className={styles.grid}>
          {filtered.map(g => {
            const isFundraiser = g.group_type === 'flexible';
            const href = isFundraiser ? `/groups/${g.id}/flexible` : `/groups/${g.id}`;
            return (
              <Link to={href} key={g.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <h3>{g.name}</h3>
                  {isFundraiser
                    ? <span className={styles.typePill} data-type="fundraiser">🎯 Fundraiser</span>
                    : <span className={styles.typePill} data-type="circle">🔄 Savings Circle</span>
                  }
                </div>
                {g.description && <p className={styles.desc}>{g.description}</p>}
                <div className={styles.cardBottom}>
                  {isFundraiser
                    ? <span className={styles.amount}>Pool: {Number(g.pool_balance || 0).toLocaleString()} XAF</span>
                    : <span className={styles.amount}>{Number(g.contribution_amount).toLocaleString()} XAF · {g.cycle}</span>
                  }
                  <span className={styles.members}>
                    {g.member_count}{g.max_members ? `/${g.max_members}` : ''} {t('members')}
                  </span>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className={styles.empty}>{t('noGroupsFound')}</p>}
        </div>
      )}

      {showTypeModal && (
        <CreateGroupModal
          onClose={() => setShowTypeModal(false)}
          onSelect={handleTypeSelect}
        />
      )}
    </div>
  );
}
