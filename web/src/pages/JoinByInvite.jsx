import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinByInvite, getInviteGroupInfo } from '../api/groups';
import { useAuth } from '../context/AuthContext';
import TermsModal from '../components/TermsModal';
import styles from './JoinByInvite.module.css';

export default function JoinByInvite() {
  const { token }   = useParams();
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const [groupInfo, setGroupInfo]   = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [status, setStatus]         = useState('idle'); // idle | loading | success | error
  const [msg, setMsg]               = useState('');
  const [showTerms, setShowTerms]   = useState(false);

  // Fetch group info publicly (no auth required)
  useEffect(() => {
    getInviteGroupInfo(token)
      .then(r => setGroupInfo(r.data))
      .catch(() => setMsg('Invalid or expired invite link.'))
      .finally(() => setInfoLoading(false));
  }, [token]);

  useEffect(() => {
    if (!user) { navigate(`/login?redirect=/join/${token}`); }
    else if (!user.profile_complete) { navigate('/setup-profile'); }
  }, [user]);

  const doJoin = async () => {
    setStatus('loading');
    try {
      await joinByInvite(token);
      setStatus('success');
    } catch (err) {
      setMsg(err.message || 'Invalid or expired invite link.');
      setStatus('error');
    }
  };

  if (infoLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p style={{ color: 'var(--text-sub)', textAlign: 'center' }}>Loading group info…</p>
        </div>
      </div>
    );
  }

  if (!groupInfo && !infoLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>❌</div>
          <h1>Invalid Link</h1>
          <p>{msg || 'This invite link is invalid or has expired.'}</p>
          <button className={styles.btnOutline} onClick={() => navigate('/')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const statusColor = groupInfo?.status === 'forming' ? '#ca8a04' : groupInfo?.status === 're-forming' ? 'var(--primary)' : '#6b7280';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>👥</div>
        <h1>You've been invited!</h1>
        <p>Someone invited you to join a Via savings group.</p>

        {/* Group info preview */}
        {groupInfo && status === 'idle' && (
          <div style={{
            background: 'var(--bg-subtle)', borderRadius: 12, padding: 16,
            margin: '16px 0', textAlign: 'left', width: '100%'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {groupInfo.name}
            </div>
            {groupInfo.description && (
              <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.5 }}>
                {groupInfo.description}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Contribution</div>
                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  {Number(groupInfo.contribution_amount).toLocaleString()} XAF
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Cycle</div>
                <div style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                  {groupInfo.cycle}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Members</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {groupInfo.member_count}/{groupInfo.max_members}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Status</div>
                <div style={{ fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
                  {groupInfo.status}
                </div>
              </div>
            </div>

            {/* Group rules reminder */}
            <div style={{
              marginTop: 12, padding: '10px 12px', background: '#fffbeb',
              border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#92400e'
            }}>
              ⚠️ <strong>Before joining:</strong> You are committing to contribute {Number(groupInfo.contribution_amount).toLocaleString()} XAF every {groupInfo.cycle} cycle. You cannot leave mid-circle.
            </div>
          </div>
        )}

        {status === 'idle' && groupInfo && (
          <button className={styles.btn} onClick={() => setShowTerms(true)}>
            Accept Invite & Join
          </button>
        )}

        {status === 'idle' && groupInfo && (
          <button className={styles.btnOutline} style={{ marginTop: 8 }} onClick={() => navigate('/')}>
            Decline
          </button>
        )}

        {status === 'loading' && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Processing...</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.success}>
            <div className={styles.successIcon}>✅</div>
            <h2>Request Sent!</h2>
            <p>
              Your request to join <strong>{groupInfo?.name}</strong> has been sent.
              An admin will review and approve it shortly.
            </p>
            <button className={styles.btn} onClick={() => navigate('/')}>Go to Dashboard</button>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.error}>
            <p>{msg}</p>
            <button className={styles.btnOutline} onClick={() => navigate('/')}>Go to Dashboard</button>
          </div>
        )}
      </div>

      {showTerms && (
        <TermsModal
          type="member_joining"
          onAccept={() => { setShowTerms(false); doJoin(); }}
          onCancel={() => setShowTerms(false)}
        />
      )}
    </div>
  );
}
