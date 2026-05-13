import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFlexibleGroup } from '../api/groups';
import styles from './CreateGroup.module.css';

const VISIBILITY_OPTIONS = [
  { value: 'public',  label: '🌍 Public',  desc: 'Anyone on Via can find and join' },
  { value: 'private', label: '🔒 Private', desc: 'Only visible to members (invite only)' },
  { value: 'region',  label: '📍 Region',  desc: 'Only visible to users in a specific location' },
];

export default function CreateFlexibleGroup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name:               '',
    description:        '',
    goal_amount:        '',
    fundraiser_deadline: '',
    max_members:        '',
    visibility:         'public',
    visibility_country: '',
    visibility_city:    '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.goal_amount && parseFloat(form.goal_amount) <= 0) {
      setError('Goal amount must be a positive number');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name:        form.name,
        description: form.description || undefined,
        visibility:  form.visibility,
      };
      if (form.goal_amount)        payload.goal_amount         = parseFloat(form.goal_amount);
      if (form.fundraiser_deadline) payload.fundraiser_deadline = form.fundraiser_deadline;
      if (form.max_members)        payload.max_members         = parseInt(form.max_members);
      if (form.visibility === 'region') {
        payload.visibility_country = form.visibility_country || null;
        payload.visibility_city    = form.visibility_city    || null;
      }

      const res = await createFlexibleGroup(payload);
      navigate(`/groups/${res.data.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>🎯 Create Fundraiser</h1>
      <p style={{ color: 'var(--text-sub)', marginBottom: 24, fontSize: 14 }}>
        Members contribute any amount freely. The admin controls all settings and records how the money is used.
        Great for emergencies, community projects, or shared expenses.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Name */}
        <div className={styles.field}>
          <label>Group Name *</label>
          <input value={form.name} onChange={set('name')} placeholder='e.g. "Family Emergency Fund"' required />
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label>Description (optional)</label>
          <textarea value={form.description} onChange={set('description')} rows={3}
            placeholder="What is this group raising funds for?" />
        </div>

        {/* Goal amount */}
        <div className={styles.field}>
          <label>Fundraising Goal (XAF) — optional</label>
          <input type="number" min="1" value={form.goal_amount} onChange={set('goal_amount')}
            placeholder="e.g. 500000" />
          <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Set a target amount to display a progress bar for members.
          </small>
        </div>

        {/* Deadline */}
        <div className={styles.field}>
          <label>Fundraising Deadline — optional</label>
          <input type="date" value={form.fundraiser_deadline} onChange={set('fundraiser_deadline')}
            min={new Date().toISOString().split('T')[0]} />
          <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Set a closing date. The group will still need to be manually closed by the admin.
          </small>
        </div>

        {/* Max members */}
        <div className={styles.field}>
          <label>Max Members (optional)</label>
          <input type="number" min="2" max="500" value={form.max_members} onChange={set('max_members')} />
        </div>

        {/* Visibility */}
        <div className={styles.field}>
          <label>Group Visibility</label>
          <div className={styles.visibilityOptions}>
            {VISIBILITY_OPTIONS.map(opt => (
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
        </div>

        {form.visibility === 'region' && (
          <div className={styles.row}>
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

        <div className={styles.btnRow}>
          <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating...' : '🎯 Create Fundraiser'}
          </button>
        </div>
      </form>
    </div>
  );
}
