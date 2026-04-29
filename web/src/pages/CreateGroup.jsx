import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../api/groups';
import { useLanguage } from '../context/LanguageContext';
import styles from './CreateGroup.module.css';

const CYCLES = ['weekly', 'biweekly', 'monthly'];

export default function CreateGroup() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', description: '', contribution_amount: '', cycle: 'monthly', max_members: '10' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await createGroup({ ...form, contribution_amount: parseFloat(form.contribution_amount), max_members: parseInt(form.max_members) });
      navigate('/groups');
    } catch (err) { setError(err.message || t('failedToCreate')); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <h1>{t('createGroupTitle')}</h1>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>{t('groupName')}</label>
          <input placeholder="My Njangi Group" value={form.name} onChange={set('name')} required />
        </div>
        <div className={styles.field}>
          <label>{t('description')}</label>
          <textarea placeholder={t('descriptionPlaceholder')} value={form.description} onChange={set('description')} rows={3} />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>{t('contributionAmount')}</label>
            <input type="number" placeholder="5000" value={form.contribution_amount} onChange={set('contribution_amount')} required min="1" />
          </div>
          <div className={styles.field}>
            <label>{t('maxMembers')}</label>
            <input type="number" placeholder="10" value={form.max_members} onChange={set('max_members')} min="2" max="50" />
          </div>
        </div>
        <div className={styles.field}>
          <label>{t('contributionCycle')}</label>
          <div className={styles.cycles}>
            {CYCLES.map(c => (
              <button type="button" key={c} className={`${styles.cycleBtn} ${form.cycle === c ? styles.active : ''}`} onClick={() => setForm(f => ({ ...f, cycle: c }))}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.btnRow}>
          <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>{t('cancel')}</button>
          <button type="submit" className={styles.submit} disabled={loading}>{loading ? t('creating') : t('createGroup')}</button>
        </div>
      </form>
    </div>
  );
}
