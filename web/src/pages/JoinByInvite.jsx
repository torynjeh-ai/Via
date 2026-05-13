import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinByInvite } from '../api/groups';
import { useAuth } from '../context/AuthContext';
import TermsModal from '../components/TermsModal';
import styles from './JoinByInvite.module.css';

export default function JoinByInvite() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus]       = useState('idle'); // idle | loading | success | error
  const [msg, setMsg]             = useState('');
  const [groupName, setGroupName] = useState('');
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!user) { navigate(`/login?redirect=/join/${token}`); return; }
    if (!user.profile_complete) { navigate('/setup-profile'); }
  }, [user]);

  const doJoin = async () => {
    setStatus('loading');
    try {
      const res = await joinByInvite(token);
      setGroupName(res.data.group_name);
      setStatus('success');
    } catch (err) {
      setMsg(err.message || 'Invalid or expired invite link.');
      setStatus('error');
    }
  };

  const handleAcceptInvite = () => {
    // Show terms first — joining happens only after they agree
    setShowTerms(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>👥</div>
        <h1>You've been invited!</h1>
        <p>You were invited to join a Via savings group.</p>

        {status === 'idle' && (
          <button className={styles.btn} onClick={handleAcceptInvite}>
            Accept Invite
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
            <p>Your request to join <strong>{groupName}</strong> has been sent. An admin will review and approve it shortly.</p>
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
