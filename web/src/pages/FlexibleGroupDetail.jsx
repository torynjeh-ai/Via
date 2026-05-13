import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGroup, approveMember, rejectMember, getInviteLink,
  activateFlexibleGroup, closeFlexibleGroup, deleteFlexibleGroup,
  updateFlexibleSettings, leaveFlexibleGroup,
  contributeFlexible, getFlexiblePoolSummary, getFlexibleContributions,
  createDisbursement, getDisbursements, updateDisbursement,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import GroupChat from '../components/GroupChat';
import styles from './FlexibleGroupDetail.module.css';

const PAYMENT_METHODS = [
  { value: 'tc_wallet',    label: '💎 TC Wallet' },
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
];

const DISBURSEMENT_METHODS = [
  { value: 'tc_wallet',     label: '💎 TC Wallet' },
  { value: 'mtn_momo',      label: '📱 MTN Mobile Money' },
  { value: 'orange_money',  label: '🟠 Orange Money' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'manual',        label: '✋ Manual / Cash' },
];

// ── Edit Settings Modal ────────────────────────────────────────────────────
function EditSettingsModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:               group.name || '',
    description:        group.description || '',
    goal_amount:        group.goal_amount || '',
    fundraiser_deadline: group.fundraiser_deadline ? group.fundraiser_deadline.split('T')[0] : '',
    max_members:        group.max_members || '',
    visibility:         group.visibility || 'public',
    visibility_country: group.visibility_country || '',
    visibility_city:    group.visibility_city || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        name:               form.name,
        description:        form.description,
        visibility:         form.visibility,
        goal_amount:        form.goal_amount ? parseFloat(form.goal_amount) : null,
        fundraiser_deadline: form.fundraiser_deadline || null,
        max_members:        form.max_members ? parseInt(form.max_members) : null,
      };
      if (form.visibility === 'region') {
        payload.visibility_country = form.visibility_country || null;
        payload.visibility_city    = form.visibility_city    || null;
      }
      await updateFlexibleSettings(group.id, payload);
      onSaved();
      onClose();
    } catch (err) { setError(err.message || 'Failed to update'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>Edit Group Settings</h3>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSave}>
          <div className={styles.modalField}><label>Group Name</label>
            <input value={form.name} onChange={set('name')} required /></div>
          <div className={styles.modalField}><label>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} /></div>
          <div className={styles.modalField}><label>Fundraising Goal (XAF)</label>
            <input type="number" min="1" value={form.goal_amount} onChange={set('goal_amount')}
              placeholder="Leave blank to remove goal" /></div>
          <div className={styles.modalField}><label>Deadline (optional)</label>
            <input type="date" value={form.fundraiser_deadline} onChange={set('fundraiser_deadline')} /></div>
          <div className={styles.modalField}><label>Max Members</label>
            <input type="number" min="2" value={form.max_members} onChange={set('max_members')} /></div>
          <div className={styles.modalField}><label>Visibility</label>
            <select value={form.visibility} onChange={set('visibility')}>
              <option value="public">🌍 Public</option>
              <option value="private">🔒 Private</option>
              <option value="region">📍 Region</option>
            </select>
          </div>
          {form.visibility === 'region' && (
            <>
              <div className={styles.modalField}><label>Country</label>
                <input value={form.visibility_country} onChange={set('visibility_country')} /></div>
              <div className={styles.modalField}><label>City (optional)</label>
                <input value={form.visibility_city} onChange={set('visibility_city')} /></div>
            </>
          )}
          <div className={styles.modalBtns}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Contribute Modal ───────────────────────────────────────────────────────
function ContributeModal({ groupId, poolBalance, goalAmount, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState('tc_wallet');
  const [note, setNote]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await contributeFlexible(groupId, {
        amount: parseFloat(amount),
        payment_method: method,
        note: note || undefined,
      });
      onSuccess(res.message);
    } catch (err) { setError(err.message || 'Contribution failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>💰 Make a Contribution</h3>
        <p className={styles.hint}>Current pool: {Number(poolBalance).toLocaleString()} XAF
          {goalAmount ? ` / ${Number(goalAmount).toLocaleString()} XAF goal` : ''}
        </p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalField}><label>Amount (XAF) *</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Any amount" required /></div>
          <div className={styles.modalField}><label>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className={styles.modalField}><label>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Monthly contribution" /></div>
          <div className={styles.modalBtns}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Processing...' : `Contribute ${amount ? Number(amount).toLocaleString() + ' XAF' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Disbursement Panel ─────────────────────────────────────────────────────
function DisbursementPanel({ groupId, poolBalance, disbursements, onRefresh }) {
  const [form, setForm] = useState({
    amount: '', disbursement_method: 'manual',
    recipientType: 'external', recipient_description: '', note: '',
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [msg, setMsg]           = useState('');
  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState({ note: '', recipient_description: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        amount:               parseFloat(form.amount),
        disbursement_method:  form.disbursement_method,
        note:                 form.note || undefined,
        recipient_description: form.recipient_description || undefined,
      };
      await createDisbursement(groupId, payload);
      setMsg('Disbursement recorded.');
      setForm({ amount: '', disbursement_method: 'manual', recipientType: 'external', recipient_description: '', note: '' });
      onRefresh();
      setTimeout(() => setMsg(''), 4000);
    } catch (err) { setError(err.message || 'Failed to record disbursement'); }
    finally { setLoading(false); }
  };

  const handleEdit = async (id) => {
    try {
      await updateDisbursement(groupId, id, {
        note: editForm.note || undefined,
        recipient_description: editForm.recipient_description || undefined,
      });
      setEditId(null);
      onRefresh();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className={styles.disbursementPanel}>
      <h3>💸 Record a Disbursement</h3>
      <div className={styles.infoBanner}>
        ℹ️ No automated payment is made. You are responsible for transferring the funds externally.
      </div>
      <p className={styles.hint}>Current pool balance: <strong>{Number(poolBalance).toLocaleString()} XAF</strong></p>

      {error && <div className={styles.error}>{error}</div>}
      {msg   && <div className={styles.successMsg}>{msg}</div>}

      <form onSubmit={handleCreate} className={styles.disbForm}>
        <div className={styles.modalField}><label>Amount (XAF) *</label>
          <input type="number" min="1" value={form.amount} onChange={set('amount')}
            placeholder={`Max: ${Number(poolBalance).toLocaleString()} XAF`} required /></div>
        <div className={styles.modalField}><label>Disbursement Method</label>
          <select value={form.disbursement_method} onChange={set('disbursement_method')}>
            {DISBURSEMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className={styles.modalField}><label>Recipient / Description</label>
          <input value={form.recipient_description} onChange={set('recipient_description')}
            placeholder="e.g. School fees for Amara, or member name" /></div>
        <div className={styles.modalField}><label>Note (optional)</label>
          <input value={form.note} onChange={set('note')} placeholder="e.g. Paid in cash at school office" /></div>
        <button type="submit" className={styles.primaryBtn} disabled={loading || !form.amount}>
          {loading ? 'Recording...' : 'Record Disbursement'}
        </button>
      </form>

      {disbursements.length > 0 && (
        <div className={styles.disbHistory}>
          <h4>Disbursement History</h4>
          <table className={styles.table}>
            <thead>
              <tr><th>Date</th><th>Amount</th><th>Recipient</th><th>Method</th><th>Note</th><th>By</th><th></th></tr>
            </thead>
            <tbody>
              {disbursements.map(d => (
                <tr key={d.id}>
                  {editId === d.id ? (
                    <>
                      <td colSpan={4}>
                        <input value={editForm.recipient_description}
                          onChange={e => setEditForm(f => ({ ...f, recipient_description: e.target.value }))}
                          placeholder="Recipient" style={{ width: '100%', marginBottom: 4 }} />
                        <input value={editForm.note}
                          onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Note" style={{ width: '100%' }} />
                      </td>
                      <td colSpan={2}>
                        <button className={styles.primaryBtn} onClick={() => handleEdit(d.id)}>Save</button>
                        <button onClick={() => setEditId(null)} style={{ marginLeft: 8 }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{formatDate(d.created_at)}</td>
                      <td>{Number(d.amount).toLocaleString()} XAF</td>
                      <td>{d.recipient_description || d.recipient_name || '—'}</td>
                      <td>{d.disbursement_method?.replace('_', ' ')}</td>
                      <td>{d.note || '—'}</td>
                      <td>{d.admin_name}</td>
                      <td>
                        <button className={styles.editBtn} onClick={() => {
                          setEditId(d.id);
                          setEditForm({ note: d.note || '', recipient_description: d.recipient_description || '' });
                        }}>Edit</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FlexibleGroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup]               = useState(null);
  const [pool, setPool]                 = useState(null);
  const [contributions, setContribs]    = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [msg, setMsg]                   = useState('');
  const [editOpen, setEditOpen]         = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [inviteUrl, setInviteUrl]       = useState('');
  const [copied, setCopied]             = useState(false);

  const load = async () => {
    try {
      const [groupRes, poolRes, contribRes, disbRes] = await Promise.all([
        getGroup(id),
        getFlexiblePoolSummary(id).catch(() => null),
        getFlexibleContributions(id).catch(() => ({ data: [] })),
        getDisbursements(id).catch(() => ({ data: [] })),
      ]);
      setGroup(groupRes.data);
      if (poolRes) setPool(poolRes.data);
      setContribs(contribRes.data || []);
      setDisbursements(disbRes.data || []);
    } catch { /* handled below */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const myMember = group?.members?.find(m => m.user_id === user?.id);
  const isAdmin  = myMember?.role === 'admin';
  const isMember = !!myMember && myMember.status === 'approved';

  const handleActivate = async () => {
    setActionLoading('activate');
    try { await activateFlexibleGroup(id); setMsg('Group activated!'); load(); }
    catch (e) { setMsg(e.message); }
    finally { setActionLoading(''); }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this group? No further contributions or disbursements will be allowed.')) return;
    setActionLoading('close');
    try { await closeFlexibleGroup(id); setMsg('Group closed.'); load(); }
    catch (e) { setMsg(e.message); }
    finally { setActionLoading(''); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this group? This cannot be undone. All members will be notified.')) return;
    setActionLoading('delete');
    try { await deleteFlexibleGroup(id); navigate('/groups'); }
    catch (e) { setMsg(e.message); setActionLoading(''); }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this fundraiser? You will no longer be a member.')) return;
    setActionLoading('leave');
    try { await leaveFlexibleGroup(id); navigate('/groups'); }
    catch (e) { setMsg(e.message); setActionLoading(''); }
  };

  const handleApprove = async (uid) => {
    try { await approveMember(id, uid); load(); } catch (e) { setMsg(e.message); }
  };
  const handleReject = async (uid) => {
    if (!window.confirm('Decline this member?')) return;
    try { await rejectMember(id, uid); load(); } catch (e) { setMsg(e.message); }
  };

  const handleGetInvite = async () => {
    try { const r = await getInviteLink(id); setInviteUrl(r.data.invite_url); }
    catch (e) { setMsg(e.message); }
  };
  const handleCopy = () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!group)  return <p style={{ padding: 24 }}>Group not found.</p>;

  const statusColor = { forming: '#FF9800', active: '#4CAF50', completed: '#9E9E9E', cancelled: '#DC2626' };
  const poolBalance = pool?.pool_balance ?? 0;
  const goalAmount  = pool?.goal_amount  ?? null;
  const goalPercent = pool?.goal_percent ?? null;

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Back</button>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div>
          <div className={styles.typeBadge}>🎯 Fundraiser</div>
          <h1>{group.name}</h1>
          {group.description && <p className={styles.desc}>{group.description}</p>}
          <div className={styles.meta}>
            <span className={styles.statusBadge} style={{ background: statusColor[group.status] || '#9E9E9E' }}>
              {group.status}
            </span>
            <span>{group.member_count} members</span>
            {group.max_members && <span>/ {group.max_members} max</span>}
            <span>{group.visibility === 'private' ? '🔒 Private' : group.visibility === 'region' ? '📍 Region' : '🌍 Public'}</span>
            {group.fundraiser_deadline && (
              <span style={{ color: new Date(group.fundraiser_deadline) < new Date() ? 'var(--danger)' : 'var(--text-sub)' }}>
                📅 Deadline: {formatDate(group.fundraiser_deadline)}
                {new Date(group.fundraiser_deadline) < new Date() ? ' (passed)' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className={styles.actions}>
            {group.status === 'forming' && (
              <button className={styles.btn} onClick={handleActivate} disabled={actionLoading === 'activate'}>
                {actionLoading === 'activate' ? 'Activating...' : '▶ Activate Group'}
              </button>
            )}
            {group.status === 'active' && (
              <button className={`${styles.btn} ${styles.outlineBtn}`} onClick={handleClose} disabled={actionLoading === 'close'}>
                {actionLoading === 'close' ? 'Closing...' : '⏹ Close Group'}
              </button>
            )}
            <button className={`${styles.btn} ${styles.outlineBtn}`} onClick={() => setEditOpen(true)}>
              ✏️ Edit Settings
            </button>
            {/* Delete: allowed when forming (not yet activated) OR after a disbursement */}
            {(group.status === 'forming' || disbursements.length >= 1) && (
              <button className={`${styles.btn} ${styles.dangerBtn}`} onClick={handleDelete} disabled={actionLoading === 'delete'}>
                {actionLoading === 'delete' ? 'Deleting...' : '🗑 Delete Group'}
              </button>
            )}
          </div>
        )}

        {/* Member contribute button */}
        {isMember && !isAdmin && group.status === 'active' && (
          <button className={styles.btn} onClick={() => setContributeOpen(true)}>
            + Contribute
          </button>
        )}

        {/* Leave button for non-admin members */}
        {isMember && !isAdmin && group.status !== 'completed' && (
          <button className={`${styles.btn} ${styles.outlineBtn}`}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleLeave} disabled={actionLoading === 'leave'}>
            {actionLoading === 'leave' ? 'Leaving...' : '🚪 Leave Group'}
          </button>
        )}
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      {/* ── Pool Summary Card ── */}
      {isMember && pool && (
        <div className={styles.poolCard}>
          <div className={styles.poolHeader}>
            <div>
              <div className={styles.poolLabel}>Pool Balance</div>
              <div className={styles.poolAmount}>{Number(poolBalance).toLocaleString()} XAF</div>
            </div>
            <div className={styles.poolMeta}>
              <span>{pool.contributor_count} contributor{pool.contributor_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {goalAmount && (
            <div className={styles.goalSection}>
              <div className={styles.goalLabel}>
                Goal: {Number(goalAmount).toLocaleString()} XAF
                <span className={styles.goalPct}>{goalPercent}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${Math.min(goalPercent, 100)}%` }} />
              </div>
              <div className={styles.goalSub}>
                {Number(poolBalance).toLocaleString()} / {Number(goalAmount).toLocaleString()} XAF
              </div>
            </div>
          )}

          {/* Admin breakdown */}
          {isAdmin && pool.breakdown?.length > 0 && (
            <div className={styles.breakdown}>
              <h4>Per-Member Breakdown</h4>
              <table className={styles.table}>
                <thead><tr><th>Member</th><th>Total Contributed</th><th>Contributions</th></tr></thead>
                <tbody>
                  {pool.breakdown.map(b => (
                    <tr key={b.user_id}>
                      <td>{b.name}</td>
                      <td>{Number(b.total_contributed).toLocaleString()} XAF</td>
                      <td>{b.contribution_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Admin: Contribute button ── */}
      {isAdmin && group.status === 'active' && (
        <div style={{ marginBottom: 16 }}>
          <button className={styles.btn} onClick={() => setContributeOpen(true)}>+ Contribute</button>
        </div>
      )}

      {/* ── Disbursement Panel (admin only) ── */}
      {isAdmin && (group.status === 'active' || group.status === 'completed') && (
        <DisbursementPanel
          groupId={id}
          poolBalance={poolBalance}
          disbursements={disbursements}
          onRefresh={load}
        />
      )}

      {/* ── Disbursement History (members) ── */}
      {isMember && !isAdmin && disbursements.length > 0 && (
        <div className={styles.section}>
          <h2>💸 Disbursements</h2>
          <table className={styles.table}>
            <thead><tr><th>Date</th><th>Amount</th><th>Recipient</th><th>Method</th></tr></thead>
            <tbody>
              {disbursements.map(d => (
                <tr key={d.id}>
                  <td>{formatDate(d.created_at)}</td>
                  <td>{Number(d.amount).toLocaleString()} XAF</td>
                  <td>{d.recipient_description || '—'}</td>
                  <td>{d.disbursement_method?.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contribution History ── */}
      {isMember && contributions.length > 0 && (
        <div className={styles.section}>
          <h2>📋 Contribution History</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                {isAdmin && <th>Member</th>}
                {isAdmin && <th>Amount</th>}
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map(c => (
                <tr key={c.id}>
                  {isAdmin && <td>{c.name}</td>}
                  {isAdmin && <td>{Number(c.amount).toLocaleString()} XAF</td>}
                  <td>{c.payment_method?.replace('_', ' ')}</td>
                  <td>
                    <span className={`${styles.badge} ${c.status === 'completed' ? styles.approved : styles.pending}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>{formatDateTime(c.paid_at || c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Members Table ── */}
      {isMember && (
        <div className={styles.section}>
          <h2>👥 Members ({group.members?.filter(m => m.status !== 'rejected').length})</h2>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Role</th><th>Status</th>{isAdmin && <th>Action</th>}</tr></thead>
            <tbody>
              {group.members?.filter(m => m.status !== 'rejected').map(m => (
                <tr key={m.id}>
                  <td>{m.name} {m.user_id === user?.id ? <span className={styles.you}>(you)</span> : ''}</td>
                  <td><span className={styles.role}>{m.role}</span></td>
                  <td>
                    <span className={`${styles.badge} ${m.status === 'approved' ? styles.approved : styles.pending}`}>
                      {m.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {m.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className={styles.approveBtn} onClick={() => handleApprove(m.user_id)}>Approve</button>
                          <button className={styles.rejectBtn}  onClick={() => handleReject(m.user_id)}>Decline</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite Link ── */}
      {isMember && group.status !== 'completed' && (
        <div className={styles.section}>
          <h2>🔗 Invite Members</h2>
          {inviteUrl ? (
            <div className={styles.inviteBox}>
              <span className={styles.inviteUrl}>{inviteUrl}</span>
              <button className={styles.copyBtn} onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          ) : (
            <button className={`${styles.btn} ${styles.outlineBtn}`} onClick={handleGetInvite}>
              Generate Invite Link
            </button>
          )}
        </div>
      )}

      {/* ── Group Chat ── */}
      {isMember && (
        <div className={styles.section}>
          <GroupChat groupId={id} isAdmin={isAdmin} />
        </div>
      )}

      {/* ── Modals ── */}
      {editOpen && (
        <EditSettingsModal
          group={group}
          onClose={() => setEditOpen(false)}
          onSaved={() => { load(); setMsg('Settings updated!'); }}
        />
      )}

      {contributeOpen && (
        <ContributeModal
          groupId={id}
          poolBalance={poolBalance}
          goalAmount={goalAmount}
          onClose={() => setContributeOpen(false)}
          onSuccess={(message) => {
            setMsg(message);
            setContributeOpen(false);
            load();
            setTimeout(() => setMsg(''), 5000);
          }}
        />
      )}
    </div>
  );
}
