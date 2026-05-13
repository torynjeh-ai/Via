import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSavingsGoal } from '../api/savings';
import styles from './CreateSavingsGoal.module.css';

const CATEGORIES = ['General','Education','Health','Travel','Business','Emergency','Housing','Technology','Other'];
const CATEGORY_ICONS = {
  General:'💰', Education:'📚', Health:'🏥', Travel:'✈️',
  Business:'💼', Emergency:'🚨', Housing:'🏠', Technology:'💻', Other:'🎯',
};
const FREQUENCIES = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// Minimum date = tomorrow (ISO string for input min attr)
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

// Format ISO date string as DD/MM/YYYY for display
const formatDisplayDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function CreateSavingsGoal() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', category: 'General',
    target_amount: '', target_date: '',
    auto_save_enabled: false, auto_save_amount: '', auto_save_frequency: 'monthly',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        name:          form.name,
        description:   form.description || undefined,
        category:      form.category,
        target_amount: parseFloat(form.target_amount),
        target_date:   form.target_date,
      };
      if (form.auto_save_enabled && form.auto_save_amount) {
        payload.auto_save_enabled   = true;
        payload.auto_save_amount    = parseFloat(form.auto_save_amount);
        payload.auto_save_frequency = form.auto_save_frequency;
      }
      await createSavingsGoal(payload);
      navigate('/savings');
    } catch (err) { setError(err.message || 'Failed to create goal'); }
    finally { setLoading(false); }
  };

  // Daily pace needed to meet goal
  const daysLeft = form.target_date
    ? Math.max(1, Math.ceil((new Date(form.target_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const dailyNeeded = form.target_amount && daysLeft
    ? Math.ceil(parseFloat(form.target_amount) / daysLeft)
    : null;

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>
      <h1>🎯 New Savings Goal</h1>
      <p className={styles.subtitle}>Set a goal, save consistently, earn a 0.5% bonus when you complete it on time.</p>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Goal name */}
        <div className={styles.field}>
          <label>Goal Name *</label>
          <input value={form.name} onChange={set('name')} placeholder='e.g. "New Car", "School Fees"' required />
        </div>

        {/* Category */}
        <div className={styles.field}>
          <label>Category</label>
          <div className={styles.categories}>
            {CATEGORIES.map(c => (
              <button
                type="button" key={c}
                className={`${styles.catBtn} ${form.category === c ? styles.catActive : ''}`}
                onClick={() => setForm(f => ({ ...f, category: c }))}
              >
                {CATEGORY_ICONS[c]} {c}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label>Description (optional)</label>
          <textarea value={form.description} onChange={set('description')} rows={2} placeholder="What are you saving for?" />
        </div>

        {/* Target amount + date */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Target Amount (XAF) *</label>
            <input type="number" value={form.target_amount} onChange={set('target_amount')} placeholder="e.g. 500000" min="100" required />
          </div>
          <div className={styles.field}>
            <label>Target Date *</label>
            <input type="date" value={form.target_date} onChange={set('target_date')} min={tomorrow()} required />
            {form.target_date && (
              <span className={styles.dateHint}>{formatDisplayDate(form.target_date)}</span>
            )}
          </div>
        </div>

        {/* Pace hint */}
        {dailyNeeded && (
          <div className={styles.paceHint}>
            💡 To reach your goal on time, save about <strong>{dailyNeeded.toLocaleString()} XAF/day</strong> ({daysLeft} days left)
          </div>
        )}

        {/* Auto-save */}
        <div className={styles.autoSaveSection}>
          <div className={styles.autoSaveToggleRow}>
            <div>
              <div className={styles.autoSaveLabel}>Auto-Save</div>
              <div className={styles.autoSaveHint}>Automatically deduct from your TC wallet on a schedule</div>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${form.auto_save_enabled ? styles.toggleOn : ''}`}
              onClick={() => setForm(f => ({ ...f, auto_save_enabled: !f.auto_save_enabled }))}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
          {form.auto_save_enabled && (
            <div className={styles.row} style={{ marginTop: 12 }}>
              <div className={styles.field}>
                <label>Amount per period (XAF)</label>
                <input type="number" value={form.auto_save_amount} onChange={set('auto_save_amount')} placeholder="e.g. 10000" min="1" required={form.auto_save_enabled} />
              </div>
              <div className={styles.field}>
                <label>Frequency</label>
                <div className={styles.freqBtns}>
                  {FREQUENCIES.map(f => (
                    <button
                      type="button" key={f.value}
                      className={`${styles.freqBtn} ${form.auto_save_frequency === f.value ? styles.freqActive : ''}`}
                      onClick={() => setForm(prev => ({ ...prev, auto_save_frequency: f.value }))}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bonus info */}
        <div className={styles.bonusInfo}>
          🎁 <strong>Completion Bonus:</strong> Reach your goal by the target date and earn a 0.5% bonus on your total savings!
          <br />
          ⚠️ <strong>Early Withdrawal:</strong> Withdrawing before the deadline incurs a 2% fee and forfeits any bonus.
        </div>

        <div className={styles.btnRow}>
          <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Goal 🎯'}
          </button>
        </div>
      </form>
    </div>
  );
}
