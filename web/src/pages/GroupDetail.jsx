import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGroup, joinGroup, startGroup, approveMember, getInviteLink,
  updateGroup, endCircle, startNextCircle, reconfirmMembership, forfeitMembership,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { checkTerms, acceptTerms } from '../api/terms';
import TermsModal from '../components/TermsModal';
import styles from './GroupDetail.module.css';

function EditGroupModal({ group, onClose, onSaved }) {
  const isReforming = group.status === 're-forming';
  const isForming   = group.status === 'forming';
  const [form, setForm] = useState({
    name:                group.name || '',
    description:         group.description || '',
    max_members:         group.max_members || '',
    start_date:          group.start_date ? group.start_date.split('T')[0] : '',
    contribution_amount: group.contribution_amount || '',
    cycle:               group.cycle || 'monthly',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { name: form.name, description: form.description };
      if (isForming || isReforming) {
        if (form.max_members) payload.max_members = Number(form.max_members);
        if (form.start_date)  payload.start_date  = form.start_date;
      }
      if (isReforming) {
        if (form.contribution_amount) payload.contribution_amount = Number(form.contribution_amount);
        payload.cycle = form.cycle;
      }
      await updateGroup(group.id, payload);
      onSaved(); onClose();
    } catch (err) { setError(err.message || 'Failed to update group'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Edit Group Settings</h2>
        {error && <div className={styles.modalError}>{error}</div>}
        <form onSubmit={handleSave}>
          <div className={styles.modalField}>
            <label>Group Name</label>
            <input value={form.name} onChange={set('name')} required />
          </div>
          <div className={styles.modalField}>
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} />
          </div>
          {(isForming || isReforming) && (
            <>
              <div className={styles.modalField}>
                <label>Max Members</label>
                <input type="number" min={group.member_count} max={50} value={form.max_members} onChange={set('max_members')} />
                <small>Current members: {group.member_count}</small>
              </div>
              <div className={styles.modalField}>
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={set('start_date')} />
              </div>
            </>
          )}
          {isReforming && (
            <>
              <div className={styles.modalField}>
                <label>Contribution Amount (XAF)</label>
                <input type="number" min={1} value={form.contribution_amount} onChange={set('contribution_amount')} />
                <small>Applies to all members for the next circle</small>
              </div>
              <div className={styles.modalField}>
                <label>Cycle</label>
                <select value={form.cycle} onChange={set('cycle')}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </>
          )}
          {!isReforming && (
            <div className={styles.modalNote}>
              <strong>Locked:</strong> Contribution amount and cycle can only be changed during re-forming.
            </div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.modalSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [group, setGroup]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied]       = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [termsModal, setTermsModal] = useState(null); // { type, memberName, memberId, onConfirm }

  const load = () => getGroup(id).then(r => setGroup(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  const myMember  = group?.members?.find(m => m.user_id === user?.id);
  const isAdmin   = myMember?.role === 'admin';
  const isMember  = !!myMember;
  const myStatus  = myMember?.status;
  const isReforming = group?.status === 're-forming';

  const handleGetInvite = async () => {
    const check = await checkTerms('invite_vouching', id).catch(() => ({ data: { must_show: true } }));
    if (check.data.must_show) {
      setTermsModal({
        type: 'invite_vouching',
        memberName: null,
        onConfirm: async (frequency) => {
          await acceptTerms('invite_vouching', frequency, id);
          setTermsModal(null);
          try { const res = await getInviteLink(id); setInviteUrl(res.data.invite_url); }
          catch (e) { setMsg(e.message); }
        },
      });
    } else {
      try { const res = await getInviteLink(id); setInviteUrl(res.data.invite_url); }
      catch (e) { setMsg(e.message); }
    }
  };
  const handleCopy = () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleJoin = async () => {
    setTermsModal({
      type: 'member_joining',
      memberName: null,
      onConfirm: async () => {
        setTermsModal(null);
        try { await joinGroup(id, {}); setMsg('Join request sent!'); load(); }
        catch (e) { setMsg(e.message); }
      },
    });
  };
  const handleStart   = async () => { try { await startGroup(id); setMsg('Group started!'); load(); } catch (e) { setMsg(e.message); } };
  const handleApprove = async (uid, memberName) => {
    const check = await checkTerms('admin_approval', id).catch(() => ({ data: { must_show: true } }));
    if (check.data.must_show) {
      setTermsModal({
        type: 'admin_approval',
        memberName,
        onConfirm: async (frequency) => {
          await acceptTerms('admin_approval', frequency, id);
          setTermsModal(null);
          try { await approveMember(id, uid); load(); } catch (e) { setMsg(e.message); }
        },
      });
    } else {
      try { await approveMember(id, uid); load(); } catch (e) { setMsg(e.message); }
    }
  };

  const handleEndCircle = async (keepRules) => {
    setActionLoading('end');
    try {
      await endCircle(id, { keep_rules: keepRules });
      setMsg(`Circle ended. Group is now re-forming for Circle ${(group.circle_number || 1) + 1}.`);
      load();
      if (!keepRules) setEditOpen(true);
    } catch (e) { setMsg(e.message); }
    finally { setActionLoading(''); }
  };

  const handleReconfirm = async () => {
    setActionLoading('reconfirm');
    try { await reconfirmMembership(id); setMsg('You have re-confirmed for the next circle!'); load(); }
    catch (e) { setMsg(e.message); }
    finally { setActionLoading(''); }
  };

  const handleForfeit = async () => {
    if (!window.confirm('Are you sure you want to forfeit? You will be permanently removed from this group.')) return;
    setActionLoading('forfeit');
    try { await forfeitMembership(id); setMsg('You have forfeited your membership.'); load(); }
    catch (e) { setMsg(e.message); }
    finally { setActionLoading(''); }
  };

  const handleStartNextCircle = async (force = false) => {
    setActionLoading('start-next');
    try { await startNextCircle(id, { force }); setMsg(`Circle ${group.circle_number} started!`); load(); }
    catch (e) {
      if (e.message?.includes('have not yet re-confirmed')) {
        if (window.confirm(`${e.message}\n\nForce start and forfeit them?`)) handleStartNextCircle(true);
      } else { setMsg(e.message); }
    }
    finally { setActionLoading(''); }
  };

  if (loading) return <p>{t('loading')}</p>;
  if (!group)  return <p>{t('groupNotFound')}</p>;

  const pendingReconfirmCount = group.members?.filter(m => m.status === 'pending_reconfirm').length || 0;
  const confirmedCount        = group.members?.filter(m => m.status === 'approved').length || 0;

  return (
    <div>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>

      <div className={styles.hero}>
        <div>
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
          <div className={styles.meta}>
            <span>{Number(group.contribution_amount).toLocaleString()} XAF</span>
            <span>{group.cycle}</span>
            <span className={styles.status}>{group.status}</span>
            <span>{group.member_count}/{group.max_members} {t('members')}</span>
            {group.circle_number > 1 && <span>Circle {group.circle_number}</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {!isMember && group.status === 'forming'     && <button className={styles.btn} onClick={handleJoin}>{t('joinGroup')}</button>}
          {isMember  && group.status === 'active'      && <button className={styles.btn} onClick={() => navigate(`/groups/${id}/contribute`)}>{t('contribute')}</button>}
          {isMember  && <button className={`${styles.btn} ${styles.outline}`} onClick={() => navigate(`/groups/${id}/payouts`)}>{t('viewPayouts')}</button>}
          {isAdmin   && group.status === 'forming'     && <button className={`${styles.btn} ${styles.outline}`} onClick={handleStart}>{t('startGroup')}</button>}
          {isAdmin   && group.status === 'active'      && (
            <button className={`${styles.btn} ${styles.danger}`} onClick={() => {
              if (window.confirm('End this circle? The group will return to re-forming and all members will be asked to re-confirm.')) {
                // Ask about rules
                const keep = window.confirm('Keep existing rules for the next circle?\n\nOK = Keep rules\nCancel = Edit rules');
                handleEndCircle(keep);
              }
            }} disabled={actionLoading === 'end'}>
              {actionLoading === 'end' ? 'Ending...' : '🔄 End Circle'}
            </button>
          )}
          {isAdmin   && isReforming && <button className={`${styles.btn} ${styles.outline}`} onClick={() => setEditOpen(true)}>⚙️ Edit Rules</button>}
          {isAdmin   && isReforming && (
            <button className={styles.btn} onClick={() => handleStartNextCircle(false)} disabled={actionLoading === 'start-next'}>
              {actionLoading === 'start-next' ? 'Starting...' : `▶ Start Circle ${group.circle_number}`}
            </button>
          )}
          {isAdmin   && <button className={`${styles.btn} ${styles.outline}`} onClick={() => setEditOpen(true)}>⚙️ Edit Settings</button>}
        </div>
      </div>

      {/* Re-forming banner for members */}
      {isReforming && isMember && (
        <div className={styles.reformingBanner}>
          <div className={styles.reformingInfo}>
            <strong>Circle {(group.circle_number || 1) - 1} Complete!</strong>
            <p>The group is re-forming for Circle {group.circle_number}. Please confirm whether you want to continue.</p>
            <p className={styles.reformingStats}>{confirmedCount} confirmed · {pendingReconfirmCount} pending</p>
          </div>
          {myStatus === 'pending_reconfirm' && (
            <div className={styles.reformingActions}>
              <button className={styles.confirmBtn} onClick={handleReconfirm} disabled={actionLoading === 'reconfirm'}>
                {actionLoading === 'reconfirm' ? '...' : '✅ Re-confirm'}
              </button>
              <button className={styles.forfeitBtn} onClick={handleForfeit} disabled={actionLoading === 'forfeit'}>
                {actionLoading === 'forfeit' ? '...' : '❌ Forfeit'}
              </button>
            </div>
          )}
          {myStatus === 'approved' && <span className={styles.confirmedBadge}>✅ You re-confirmed</span>}
        </div>
      )}

      {msg && <div className={styles.msg}>{msg}</div>}

      {isMember && myMember?.status === 'approved' && group.status === 'forming' && (
        <div className={styles.section}>
          <h2>{t('inviteMembers')}</h2>
          <p className={styles.inviteHint}>{t('inviteHint')}</p>
          {inviteUrl ? (
            <div className={styles.inviteBox}>
              <span className={styles.inviteUrl}>{inviteUrl}</span>
              <button className={styles.copyBtn} onClick={handleCopy}>{copied ? t('copied') : t('copy')}</button>
            </div>
          ) : (
            <button className={styles.inviteBtn} onClick={handleGetInvite}>{t('generateInviteLink')}</button>
          )}
        </div>
      )}

      <div className={styles.section}>
        <h2>{t('membersTable')} ({group.members?.length})</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('name')}</th><th>{t('phone')}</th><th>{t('trustScoreCol')}</th>
              <th>{t('role')}</th><th>{t('status')}</th>
              {isAdmin && <th>{t('action')}</th>}
            </tr>
          </thead>
          <tbody>
            {group.members?.map(m => (
              <tr key={m.id}>
                <td>{m.name} {m.user_id === user?.id ? t('you') : ''}</td>
                <td>{m.phone}</td>
                <td>{m.trust_score}</td>
                <td><span className={styles.role}>{m.role}</span></td>
                <td>
                  <span className={`${styles.badge} ${
                    m.status === 'approved'          ? styles.approved :
                    m.status === 'pending_reconfirm' ? styles.pendingReconfirm :
                    m.status === 'forfeited'         ? styles.forfeited :
                    styles.pending
                  }`}>{m.status === 'pending_reconfirm' ? 'awaiting reconfirm' : m.status}</span>
                </td>
                {isAdmin && <td>{m.status === 'pending' && <button className={styles.approveBtn} onClick={() => handleApprove(m.user_id, m.name)}>{t('approve')}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <EditGroupModal
          group={group}
          onClose={() => setEditOpen(false)}
          onSaved={() => { load(); setMsg('Group settings updated!'); }}
        />
      )}

      {termsModal && (
        <TermsModal
          type={termsModal.type}
          groupId={id}
          memberName={termsModal.memberName}
          onAccept={termsModal.onConfirm}
          onCancel={() => setTermsModal(null)}
        />
      )}
    </div>
  );
}
