import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGroups } from '../api/groups';
import { useLanguage } from '../context/LanguageContext';
import styles from './Groups.module.css';

export default function Groups() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getGroups().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className={styles.header}>
        <h1>{t('allGroups')}</h1>
        <Link to="/groups/create" className={styles.createBtn}>{t('createGroup')}</Link>
      </div>
      <input className={styles.search} placeholder={t('searchGroups')} value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <p>{t('loading')}</p> : (
        <div className={styles.grid}>
          {filtered.map(g => (
            <Link to={`/groups/${g.id}`} key={g.id} className={styles.card}>
              <div className={styles.cardTop}>
                <h3>{g.name}</h3>
                <span className={styles.cycle}>{g.cycle}</span>
              </div>
              {g.description && <p className={styles.desc}>{g.description}</p>}
              <div className={styles.cardBottom}>
                <span className={styles.amount}>{Number(g.contribution_amount).toLocaleString()} XAF</span>
                <span className={styles.members}>{g.member_count}/{g.max_members} {t('members')}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>{t('noGroupsFound')}</p>}
        </div>
      )}
    </div>
  );
}
