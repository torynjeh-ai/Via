import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../api/groups';
import { useLanguage } from '../context/LanguageContext';
import styles from './CreateGroup.module.css';

const CYCLES = ['weekly', 'biweekly', 'monthly'];

export default function CreateGroup() {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: '',
    description: '',
    contribution_amount: '',
    cycle: 'monthly',
    max_members: '10',
    // Penalty settings
    enable_penalty: false,
    deadline_days_before: '2',
    late_penalty_type: 'fixed',
    late_penalty_value: '',
    // Visibility
    visibility: 'public',
    visibility_country: '',
    visibility_city: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        name:                form.name,
        description:         form.description,
        contribution_amount: parseFloat(form.contribution_amount),
        cycle:               form.cycle,
        max_members:         parseInt(form.max_members),
      };

      if (form.enable_penalty && form.late_penalty_value) {
        payload.deadline_days_before = parseInt(form.deadline_days_before);
        payload.late_penalty_type    = form.late_penalty_type;
        payload.late_penalty_value   = parseFloat(form.late_penalty_value);
      }

      payload.visibility = form.visibility;
      if (form.visibility === 'region') {
        payload.visibility_country = form.visibility_country || null;
        payload.visibility_city    = form.visibility_city    || null;
      }

      await createGroup(payload);
      navigate('/groups');
    } catch (err) { setError(err.message || t('failedToCreate')); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <h1>🔄 Create Savings Circle</h1>
      <p style={{ color: 'var(--text-sub)', marginBottom: 24, fontSize: 14 }}>
        Members contribute a fixed amount each cycle and take turns receiving the full pool.
      </p>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>

        {/* Basic info */}
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
            <input type="number" value={form.contribution_amount} onChange={set('contribution_amount')} required min="1" />
          </div>
          <div className={styles.field}>
            <label>{t('maxMembers')}</label>
            <input type="number" value={form.max_members} onChange={set('max_members')} min="2" max="50" />
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

        {/* Late penalty settings */}
        <div className={styles.penaltySection}>
          <div className={styles.penaltyToggleRow}>
            <div>
              <div className={styles.penaltyToggleLabel}>Late Payment Penalty</div>
              <div className={styles.penaltyToggleHint}>Charge members who pay after the deadline</div>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${form.enable_penalty ? styles.toggleOn : ''}`}
              onClick={() => setForm(f => ({ ...f, enable_penalty: !f.enable_penalty }))}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {form.enable_penalty && (
            <div className={styles.penaltyFields}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Deadline (days before payout)</label>
                  <input
                    type="number"
                    min="1" max="7"
                    value={form.deadline_days_before}
                    onChange={set('deadline_days_before')}
                    placeholder="2"
                  />
                  <small>e.g. 2 = contributions due 2 days before payout date</small>
                </div>
                <div className={styles.field}>
                  <label>Penalty Type</label>
                  <select value={form.late_penalty_type} onChange={set('late_penalty_type')}>
                    <option value="fixed">Fixed Amount (XAF)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label>
                  {form.late_penalty_type === 'fixed' ? 'Penalty Amount (XAF)' : 'Penalty Percentage (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step={form.late_penalty_type === 'percent' ? '0.1' : '100'}
                  value={form.late_penalty_value}
                  onChange={set('late_penalty_value')}
                  placeholder={form.late_penalty_type === 'fixed' ? 'e.g. 500' : 'e.g. 10'}
                  required={form.enable_penalty}
                />
                {form.contribution_amount && form.late_penalty_value && (
                  <small>
                    Late members will pay:{' '}
                    <strong>
                      {form.late_penalty_type === 'fixed'
                        ? (parseFloat(form.contribution_amount) + parseFloat(form.late_penalty_value)).toLocaleString()
                        : (parseFloat(form.contribution_amount) * (1 + parseFloat(form.late_penalty_value) / 100)).toLocaleString()
                      } XAF
                    </strong>
                    {' '}(contribution + penalty)
                  </small>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Visibility settings */}
        <div className={styles.penaltySection}>
          <div className={styles.penaltyToggleLabel} style={{ marginBottom: 12 }}>Group Visibility</div>
          <div className={styles.visibilityOptions}>
            {[
              { value: 'public',  label: '🌍 Public',     desc: 'Anyone on Via can find and join' },
              { value: 'private', label: '🔒 Private',    desc: 'Only visible to members (invite only)' },
              { value: 'region',  label: '📍 Region',     desc: 'Only visible to users in a specific location' },
            ].map(opt => (
              <div
                key={opt.value}
                className={`${styles.visOption} ${form.visibility === opt.value ? styles.visOptionActive : ''}`}
                onClick={() => setForm(f => ({ ...f, visibility: opt.value }))}
              >
                <div className={styles.visOptionLabel}>{opt.label}</div>
                <div className={styles.visOptionDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>
          {form.visibility === 'region' && (
            <div className={styles.row} style={{ marginTop: 12 }}>
              <div className={styles.field}>
                <label>Country</label>
                <input placeholder="e.g. Cameroon" value={form.visibility_country} onChange={set('visibility_country')} />
              </div>
              <div className={styles.field}>
                <label>City (optional)</label>
                <input placeholder="e.g. Yaoundé" value={form.visibility_city} onChange={set('visibility_city')} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.btnRow}>
          <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>{t('cancel')}</button>
          <button type="submit" className={styles.submit} disabled={loading}>{loading ? t('creating') : t('createGroup')}</button>
        </div>
      </form>
    </div>
  );
}
