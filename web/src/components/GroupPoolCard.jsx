import React, { useState, useEffect } from 'react';
import { getGroupPool, payInstallment, requestEarlyPayout, toggleAutopay } from '../api/groups';
import { formatDate } from '../utils/dateFormat';
import styles from './GroupPoolCard.module.css';

const ENCOURAGEMENT = [
  "Keep going, you're doing great!",
  "Almost there, stay consistent!",
  "Every payment counts — keep it up!",
  "You're building trust with every contribution!",
  "Great progress! Don't stop now.",
];

/**
 * Props:
 *   groupId   — required
 *   groupName — required
 *   compact   — true = personal progress only (dashboard)
 *   groupOnly — true = group pool + member status, no personal progress (group detail)
 */
export default function GroupPoolCard({ groupId, groupName, compact = false, groupOnly = false }) {
  const [pool, setPool]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [paying, setPaying]       = useState(false);
  const [amount, setAmount]       = useState('');
  const [showInput, setShowInput] = useState(false);
  const [msg, setMsg]             = useState('');
  const [earlyDismissed, setEarlyDismissed] = useState(false);

  const load = () => {
    getGroupPool(groupId)
      .then(r => setPool(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [groupId]);

  const handleInstallment = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setPaying(true); setMsg('');
    try {
      const res = await payInstallment(groupId, { amount_xaf: Number(amount), payment_method: 'tc_wallet' });
      setMsg(res.message); setAmount(''); setShowInput(false); load();
    } catch (err) { setMsg(err.message || 'Payment failed'); }
    finally { setPaying(false); }
  };

  const handleAutopay = async (enabled) => {
    try {
      await toggleAutopay(groupId, { enabled });
      setPool(prev => ({ ...prev, autopay_enabled: enabled }));
    } catch (err) { setMsg(err.message || 'Failed to update autopay'); }
  };

  const handleEarlyPayout = async (accept) => {
    try {
      const res = await requestEarlyPayout(groupId, { payout_id: pool.current_payout_id, accept });
      setMsg(res.message); setEarlyDismissed(true);
      if (accept) load();
    } catch (err) { setMsg(err.message || 'Failed'); }
  };

  if (loading) return <div className={styles.card}><div className={styles.loading}>Loading...</div></div>;
  if (!pool)   return null;

  const {
    my_paid, my_target, my_remaining, my_percent,
    pool_percent, collected, target,
    autopay_enabled, show_early_payout_banner,
    early_payout_amount, early_payout_fee_percent,
    deadline_date, member_progress,
  } = pool;

  const isComplete    = my_remaining <= 0;
  const encouragement = ENCOURAGEMENT[Math.floor(my_percent / 20) % ENCOURAGEMENT.length];

  // ── GROUP ONLY MODE (group detail page) ───────────────────────────────────
  if (groupOnly) {
    return (
      <div className={styles.card}>
        {/* Early payout banner */}
        {show_early_payout_banner && !earlyDismissed && (
          <div className={styles.earlyBanner}>
            <p>💰 All contributions are in! Receive your payout now with a {early_payout_fee_percent}% fee ({Number(early_payout_amount).toLocaleString()} XAF) or wait for the scheduled date.</p>
            <div className={styles.earlyBtns}>
              <button className={styles.earlyAccept} onClick={() => handleEarlyPayout(true)}>
                Receive now ({Number(early_payout_amount).toLocaleString()} XAF)
              </button>
              <button className={styles.earlyDecline} onClick={() => handleEarlyPayout(false)}>
                Wait for full amount
              </button>
            </div>
          </div>
        )}

        {/* Group pool — no autopay toggle here */}
        <div className={styles.poolSection} style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className={styles.poolLabel}>Group Pool</div>
          <div className={styles.poolAmounts}>
            <span>{Number(collected).toLocaleString()} XAF collected</span>
            <span>of {Number(target).toLocaleString()} XAF</span>
          </div>
          <div className={styles.poolBarWrap}>
            <div className={styles.poolBar} style={{ width: `${Math.min(100, pool_percent)}%` }} />
          </div>
          <div className={styles.poolFooter}>
            <span className={styles.poolPct}>{pool_percent}% of group target</span>
            {deadline_date && (
              <span className={styles.deadline}>Deadline: {formatDate(deadline_date)}</span>
            )}
          </div>
        </div>

        {msg && <p className={styles.msg}>{msg}</p>}
      </div>
    );
  }

  // ── PERSONAL PROGRESS MODE (dashboard) ────────────────────────────────────
  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.groupName}>{groupName}</div>
        <div className={styles.autopayRow}>
          <span className={styles.autopayLabel}>Auto-pay</span>
          <button
            className={`${styles.toggle} ${autopay_enabled ? styles.toggleOn : ''}`}
            onClick={() => handleAutopay(!autopay_enabled)}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>

      {/* Early payout banner */}
      {show_early_payout_banner && !earlyDismissed && (
        <div className={styles.earlyBanner}>
          <p>💰 All contributions are in! Receive your payout now with a {early_payout_fee_percent}% fee ({Number(early_payout_amount).toLocaleString()} XAF) or wait for the scheduled date.</p>
          <div className={styles.earlyBtns}>
            <button className={styles.earlyAccept} onClick={() => handleEarlyPayout(true)}>
              Receive now ({Number(early_payout_amount).toLocaleString()} XAF)
            </button>
            <button className={styles.earlyDecline} onClick={() => handleEarlyPayout(false)}>
              Wait for full amount
            </button>
          </div>
        </div>
      )}

      {/* Personal amounts — smaller font */}
      <div className={styles.amounts}>
        <span className={styles.paid}>{Number(my_paid).toLocaleString()} XAF</span>
        <span className={styles.target}>{Number(my_target).toLocaleString()} XAF</span>
      </div>

      {/* Progress bar */}
      <div className={styles.barWrap}>
        <div
          className={`${styles.bar} ${isComplete ? styles.barComplete : ''}`}
          style={{ width: `${Math.min(100, my_percent)}%` }}
        />
      </div>

      {/* Percentage centered below bar */}
      <div className={styles.pctCenter}>{my_percent}%</div>

      {/* Footer: message + deadline */}
      <div className={styles.personalFooter}>
        {isComplete ? (
          <p className={styles.congrats}>🎉 Contribution complete!</p>
        ) : (
          <p className={styles.encourage}>{Number(my_remaining).toLocaleString()} XAF left — {encouragement}</p>
        )}
        {deadline_date && (
          <span className={styles.deadline}>Due: {formatDate(deadline_date)}</span>
        )}
      </div>

      {msg && <p className={styles.msg}>{msg}</p>}

      {/* Pay installment */}
      {!isComplete && (
        <div className={styles.paySection}>
          {showInput ? (
            <form onSubmit={handleInstallment} className={styles.payForm}>
              <input
                type="number"
                className={styles.payInput}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount (XAF)"
                min="1"
                max={my_remaining}
                required
              />
              <button type="submit" className={styles.payBtn} disabled={paying}>{paying ? '...' : 'Pay'}</button>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowInput(false)}>Cancel</button>
            </form>
          ) : (
            <button className={styles.contributeBtn} onClick={() => setShowInput(true)}>+ Contribute</button>
          )}
        </div>
      )}
    </div>
  );
}
