import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  getGroup, joinGroup, startGroup, approveMember, rejectMember, getInviteLink,
  updateGroup, startNextCircle, reconfirmMembership, forfeitMembership,
  getGroupPool, submitAdminRequest, getMyAdminRequest, getAdminRequests, voteOnAdminRequest,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { checkTerms, acceptTerms } from '../api/terms';
import TermsModal from '../components/TermsModal';
import GroupChat from '../components/GroupChat';
import GroupPoolCard from '../components/GroupPoolCard';
import styles from './GroupDetail.module.css';

function EditGroupModal({ group, onClose, onSaved }) {
  const isReforming = group.status === 're-forming';
  const isForming   = group.status === 'forming';
  const [form, setForm] = useState({
    name:                group.name || '',
    description:         group.description || '',
    max_members:         group.max_members || '',
    contribution_amount: group.contribution_amount || '',
    cycle:               group.cycle || 'monthly',
    visibility:          group.visibility || 'public',
    visibility_country:  group.visibility_country || '',
    visibility_city:     group.visibility_city || '',
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
        if (form.contribution_amount) payload.contribution_amount = Number(form.contribution_amount);
        payload.cycle = form.cycle;
      }
      // Visibility can always be changed
      payload.visibility = form.visibility;
      if (form.visibility === 'region') {
        payload.visibility_country = form.visibility_country || null;
        payload.visibility_city    = form.visibility_city    || null;
      } else {
        payload.visibility_country = null;
        payload.visibility_city    = null;
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
            </>
          )}
          {(isForming || isReforming) && (
            <>
              <div className={styles.modalField}>
                <label>Contribution Amount (XAF)</label>
                <input type="number" min={1} value={form.contribution_amount} onChange={set('contribution_amount')} />
                {isReforming && <small>Applies to all members for the next circle</small>}
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
          {!isForming && !isReforming && (
            <div className={styles.modalNote}>
              <strong>Locked:</strong> Contribution amount and cycle can only be changed while the group is forming or re-forming.
            </div>
          )}

          {/* Visibility — always editable */}
          <div className={styles.modalField}>
            <label>Group Visibility</label>
            <select value={form.visibility} onChange={set('visibility')}>
              <option value="public">🌍 Public — anyone can find and join</option>
              <option value="private">🔒 Private — invite only, hidden from browse</option>
              <option value="region">📍 Region — only visible in a specific location</option>
            </select>
          </div>
          {form.visibility === 'region' && (
            <>
              <div className={styles.modalField}>
                <label>Country</label>
                <input value={form.visibility_country} onChange={set('visibility_country')} placeholder="e.g. Cameroon" />
              </div>
              <div className={styles.modalField}>
                <label>City (optional)</label>
                <input value={form.visibility_city} onChange={set('visibility_city')} placeholder="e.g. Yaoundé" />
              </div>
            </>
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
  const [termsModal, setTermsModal] = useState(null);
  const [memberProgress, setMemberProgress] = useState([]);
  const [myAdminRequest, setMyAdminRequest] = useState(null);
  const [adminRequestLoading, setAdminRequestLoading] = useState(false);
  const [adminRequests, setAdminRequests] = useState([]);
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [voteLoading, setVoteLoading] = useState('');

  const load = () => getGroup(id).then(r => setGroup(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  // Fetch pool data (for contribution status) when group is active
  useEffect(() => {
    if (group?.status === 'active') {
      getGroupPool(id).then(r => setMemberProgress(r.data?.member_progress || [])).catch(() => {});
    }
  }, [group?.status, id]);

  const myMember  = group?.members?.find(m => m.user_id === user?.id);

  // Fetch member's own admin request if they are an approved member
  useEffect(() => {
    if (myMember?.role === 'member' && myMember?.status === 'approved') {
      getMyAdminRequest(id).then(r => setMyAdminRequest(r.data?.data || null)).catch(() => {});
    }
  }, [myMember?.role, myMember?.status, id]);
  const isAdmin   = myMember?.role === 'admin';

  // Fetch admin requests when the user is an admin
  useEffect(() => {
    if (isAdmin) {
      getAdminRequests(id).then(r => setAdminRequests(r.data?.data || [])).catch(() => {});
    }
  }, [isAdmin, id]);
  const isMember  = myMember?.status === 'approved';  // pending users are NOT considered members
  const myStatus  = myMember?.status;
  const isReforming = group?.status === 're-forming';

  const approvedMemberCount = group?.members?.filter(m => m.status === 'approved').length || 0;
  const adminCount = group?.members?.filter(m => m.status === 'approved' && m.role === 'admin').length || 0;
  const adminCap = Math.max(1, Math.floor(approvedMemberCount / 10) * 3);
  const capReached = adminCount >= adminCap;

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
    if (!user?.profile_complete) { navigate('/setup-profile'); return; }
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

  const handleReject = async (uid) => {
    if (!window.confirm('Decline this member\'s request? They will be notified.')) return;
    try { await rejectMember(id, uid); load(); } catch (e) { setMsg(e.message); }
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

  const handleRequestAdminRole = async () => {
    setAdminRequestLoading(true);
    try {
      const res = await submitAdminRequest(id);
      setMyAdminRequest({ id: res.data?.data?.requestId, status: 'pending' });
      setMsg('Admin role request submitted!');
    } catch (e) {
      setMsg(e.response?.data?.message || e.message || 'Failed to submit request');
    } finally {
      setAdminRequestLoading(false);
    }
  };

  const handleAdminVote = async (requestId, vote, reason) => {
    setVoteLoading(requestId + vote);
    try {
      await voteOnAdminRequest(id, requestId, { vote, rejection_reason: reason || undefined });
      setAdminRequests(prev => prev.filter(r => r.id !== requestId));
      setRejectingRequestId(null);
      setRejectionReason('');
      setMsg(vote === 'approved' ? 'Request approved!' : 'Request rejected.');
    } catch (e) {
      setMsg(e.response?.data?.message || e.message || 'Failed to submit vote');
    } finally {
      setVoteLoading('');
    }
  };

  if (loading) return <p>{t('loading')}</p>;
  if (!group)  return <p>{t('groupNotFound')}</p>;

  // Redirect flexible groups to their dedicated page
  if (group.group_type === 'flexible') {
    return <Navigate to={`/groups/${id}/flexible`} replace />;
  }

  const pendingReconfirmCount = group.members?.filter(m => m.status === 'pending_reconfirm').length || 0;
  const confirmedCount        = group.members?.filter(m => m.status === 'approved').length || 0;

  return (
    <div>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>

      <div className={styles.hero}>
        <div>
          <div style={{ display: 'inline-block', background: 'var(--bg-hover)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginBottom: 8 }}>
            🔄 Savings Circle
          </div>
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
          <div className={styles.meta}>
            <span>{Number(group.contribution_amount).toLocaleString()} XAF</span>
            <span>{group.cycle}</span>
            <span className={styles.status}>{group.status}</span>
            <span>{group.member_count}/{group.max_members} {t('members')}</span>
            {group.circle_number > 1 && <span>Circle {group.circle_number}</span>}
            <span className={styles[`vis_${group.visibility || 'public'}`]}>
              {group.visibility === 'private' ? '🔒 Private' : group.visibility === 'region' ? '📍 Region' : '🌍 Public'}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          {/* Pending users see a waiting message instead of the join button */}
          {myMember?.status === 'pending' && (
            <span className={styles.pendingBadge}>⏳ Join request pending approval</span>
          )}
          {!myMember && (group.status === 'forming' || group.status === 're-forming') && <button className={styles.btn} onClick={handleJoin}>{t('joinGroup')}</button>}
          {isMember  && group.status === 'active'      && (
            <button className={styles.btn} onClick={() => {
              if (!user?.profile_complete) { navigate('/setup-profile'); return; }
              navigate(`/groups/${id}/contribute`);
            }}>{t('contribute')}</button>
          )}
          {isMember  && <button className={`${styles.btn} ${styles.outline}`} onClick={() => navigate(`/groups/${id}/payouts`)}>{t('viewPayouts')}</button>}
          {isAdmin   && group.status === 'forming'     && (
            <button
              className={`${styles.btn} ${styles.outline}`}
              onClick={handleStart}
              disabled={Number(group.member_count) < Number(group.max_members)}
              title={Number(group.member_count) < Number(group.max_members)
                ? `${group.member_count}/${group.max_members} members — group must be full to start`
                : 'Start group'}
            >
              {t('startGroup')} ({group.member_count}/{group.max_members})
            </button>
          )}
          {isAdmin   && group.status === 'active' && Number(group.circle_number) > 1 && (
            <button className={`${styles.btn} ${styles.danger}`} onClick={() => {
              if (window.confirm('End this circle and move the group to re-forming? All members will be asked to re-confirm.')) {
                const keep = window.confirm('Keep existing rules for the next circle?\n\nOK = Keep rules\nCancel = Edit rules');
                handleEndCircle(keep);
              }
            }} disabled={actionLoading === 'end'}>
              {actionLoading === 'end' ? 'Processing...' : 'Reform Group'}
            </button>
          )}
          {isAdmin   && isReforming && <button className={`${styles.btn} ${styles.outline}`} onClick={() => setEditOpen(true)}>Edit Rules</button>}
          {isAdmin   && isReforming && (
            <button className={styles.btn} onClick={() => handleStartNextCircle(false)} disabled={actionLoading === 'start-next'}>
              {actionLoading === 'start-next' ? 'Starting...' : `Start Circle ${group.circle_number}`}
            </button>
          )}
          {isAdmin   && !isReforming && <button className={`${styles.btn} ${styles.outline}`} onClick={() => setEditOpen(true)}>Edit Settings</button>}
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

      {isMember && myMember?.status === 'approved' && (group.status === 'forming' || group.status === 're-forming') && (
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

      {myMember?.role === 'member' && myMember?.status === 'approved' && (group.status === 'active' || group.status === 'forming') && (
        <div className={styles.section}>
          <h2>Admin Role</h2>
          {myAdminRequest?.status === 'pending' ? (
            <div>
              <p className={styles.inviteHint}>Your request to become an admin is being reviewed by the group admins.</p>
              <button className={`${styles.btn} ${styles.outline}`} disabled>
                ⏳ Admin Request Pending
              </button>
            </div>
          ) : !capReached ? (
            <div>
              <p className={styles.inviteHint}>Want to help manage this group? Request the admin role — all current admins must approve.</p>
              <button
                className={styles.btn}
                onClick={handleRequestAdminRole}
                disabled={adminRequestLoading}
              >
                {adminRequestLoading ? 'Submitting...' : '⭐ Request Admin Role'}
              </button>
            </div>
          ) : (
            <p className={styles.inviteHint}>The admin cap for this group has been reached. No more admins can be added at this time.</p>
          )}
        </div>
      )}

      {isAdmin && adminRequests.length > 0 && (
        <div className={styles.section}>
          <h2>Admin Requests</h2>
          {adminRequests.map(req => (
            <div key={req.id} className={styles.adminRequestCard}>
              <div className={styles.adminRequestInfo}>
                <strong>{req.requester_name}</strong>
                <span> requested admin role on {new Date(req.created_at).toLocaleDateString()}</span>
              </div>
              {rejectingRequestId === req.id ? (
                <div className={styles.rejectForm}>
                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className={styles.rejectInput}
                  />
                  <button
                    className={`${styles.btn} ${styles.danger}`}
                    onClick={() => handleAdminVote(req.id, 'rejected', rejectionReason)}
                    disabled={voteLoading === req.id + 'rejected'}
                  >
                    {voteLoading === req.id + 'rejected' ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.outline}`}
                    onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className={styles.adminRequestActions}>
                  <button
                    className={styles.approveBtn}
                    onClick={() => handleAdminVote(req.id, 'approved', null)}
                    disabled={voteLoading === req.id + 'approved'}
                  >
                    {voteLoading === req.id + 'approved' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => setRejectingRequestId(req.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <h2>Members Table ({group.members?.length})</h2>
        {!isMember ? (
          <p className={styles.inviteHint}>Join this group to see member details.</p>
        ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('phone')}</th>
              <th>{t('trustScoreCol')}</th>
              <th>{t('role')}</th>
              <th>{t('status')}</th>
              {/* Active: show contribution status for members; forming/re-forming: show action for admin */}
              {group.status === 'active' && isMember
                ? <th>Contribution</th>
                : isAdmin && <th>{t('action')}</th>
              }
            </tr>
          </thead>
          <tbody>
            {group.members?.map(m => {
              // Find this member's contribution progress
              const progress = memberProgress.find(p => p.user_id === m.user_id);
              const paid     = Number(progress?.paid) || 0;
              const target   = Number(progress?.target) || Number(group.contribution_amount);
              const pct      = target > 0 ? Math.round((paid / target) * 100) : 0;
              const contribDone = paid >= target && target > 0;
              const contribPartial = paid > 0 && !contribDone;

              return (
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
                  {/* Contribution status column (active groups, members only) */}
                  {group.status === 'active' && isMember && (
                    <td>
                      <span className={`${styles.badge} ${contribDone ? styles.approved : contribPartial ? styles.pendingReconfirm : styles.pending}`}>
                        {contribDone ? '✓ Paid' : contribPartial ? `${pct}%` : 'Not paid'}
                      </span>
                    </td>
                  )}
                  {/* Action column (forming/re-forming, admin only) */}
                  {group.status !== 'active' && isAdmin && (
                    <td>
                      {m.status === 'pending' && (
                        <div className={styles.actionBtns}>
                          <button className={styles.approveBtn} onClick={() => handleApprove(m.user_id, m.name)}>{t('approve')}</button>
                          <button className={styles.rejectBtn} onClick={() => handleReject(m.user_id)}>Decline</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Group Pool — group pool only on group detail page */}
      {group.status === 'active' && isMember && myMember?.status === 'approved' && (
        <div className={styles.section}>
          <GroupPoolCard groupId={id} groupName={group.name} groupOnly />
        </div>
      )}

      {/* Group Chat — visible to approved members */}
      {isMember && myMember?.status === 'approved' && (
        <div className={styles.section}>
          <GroupChat groupId={id} isAdmin={isAdmin} />
        </div>
      )}

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
