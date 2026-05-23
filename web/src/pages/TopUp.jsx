import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { topUp, getPaymentStatus } from '../api/wallet';
import styles from './TopUp.module.css';

const PAYMENT_METHODS = [
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
];

export default function TopUp() {
  const [xafAmount, setXafAmount]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [loading, setLoading]             = useState(false);
  const [success, setSuccess]             = useState(null);
  const [error, setError]                 = useState('');
  const [pendingTransId, setPendingTransId] = useState(null);
  const [pollStatus, setPollStatus]         = useState('');
  const pollRef = useRef(null);

  // Poll for payment confirmation after link is opened
  useEffect(() => {
    if (!pendingTransId) return;

    let attempts = 0;
    const MAX = 36; // 36 × 5s = 3 minutes

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await getPaymentStatus(pendingTransId);
        const { status, new_balance, tc_amount, xaf_amount } = res.data;

        if (status === 'SUCCESSFUL') {
          clearInterval(pollRef.current);
          setPendingTransId(null);
          setPollStatus('');
          setSuccess({ tc_amount, xaf_amount, new_balance });
          setXafAmount('');
          setLoading(false);
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          clearInterval(pollRef.current);
          setPendingTransId(null);
          setPollStatus('');
          setError(status === 'FAILED' ? 'Payment was declined. Please try again.' : 'Payment link expired. Please try again.');
          setLoading(false);
        } else {
          setPollStatus(status === 'PENDING' ? 'Payment in progress…' : 'Waiting for payment…');
        }
      } catch { /* ignore poll errors */ }

      if (attempts >= MAX) {
        clearInterval(pollRef.current);
        setPendingTransId(null);
        setPollStatus('');
        setError('Payment timed out. If you completed payment, your wallet will be credited shortly.');
        setLoading(false);
      }
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [pendingTransId]);

  const tcPreview = xafAmount && Number(xafAmount) >= 100
    ? (Number(xafAmount) / 10000).toFixed(4)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    const amount = Number(xafAmount);
    if (!amount || amount < 100) { setError('Minimum deposit amount is 100 XAF'); return; }

    setLoading(true);
    try {
      const res = await topUp({ xaf_amount: amount, payment_method: paymentMethod });
      const { transId, link } = res.data;

      // Open Fapshi payment page in new tab
      window.open(link, '_blank', 'noopener,noreferrer');

      // Start polling
      setPendingTransId(transId);
      setPollStatus('Waiting for payment…');
    } catch (err) {
      setError(err.message || 'Failed to generate payment link. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Top Up Wallet</h1>
        <p className={styles.subtitle}>Pay via MTN MoMo or Orange Money on Fapshi's secure page</p>
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Top-up successful!</strong>
            <p>
              Your wallet has been credited with{' '}
              <strong>{Number(success.tc_amount).toFixed(4)} TC</strong>.
              New balance: <strong>{Number(success.new_balance).toFixed(4)} TC</strong>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Polling state — payment link opened */}
      {pendingTransId && (
        <div className={styles.pendingBanner}>
          <div className={styles.spinner} />
          <div>
            <strong>{pollStatus || 'Waiting for payment…'}</strong>
            <p>Complete the payment on the Fapshi page that opened. This page updates automatically once confirmed.</p>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="xafAmount">Amount (XAF)</label>
          <input
            id="xafAmount" type="number" className={styles.input}
            value={xafAmount} onChange={e => setXafAmount(e.target.value)}
            placeholder="e.g. 10000" min="100" step="100" required disabled={loading}
          />
          {tcPreview && <p className={styles.preview}>≈ {tcPreview} TC will be credited</p>}
          <p className={styles.hint}>Minimum: 100 XAF · 1 TC = 10,000 XAF</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Payment Method</label>
          <div className={styles.methodGrid}>
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} type="button"
                className={`${styles.methodBtn} ${paymentMethod === m.value ? styles.methodActive : ''}`}
                onClick={() => setPaymentMethod(m.value)} disabled={loading}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading
            ? (pollStatus || 'Opening payment page…')
            : `Top Up ${xafAmount ? `${Number(xafAmount).toLocaleString()} XAF` : ''}`}
        </button>

        {pendingTransId && (
          <p style={{ fontSize: 13, color: 'var(--subtext)', textAlign: 'center', marginTop: 8 }}>
            Payment page didn't open?{' '}
            <button type="button" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
              onClick={() => window.open(`https://live.fapshi.com`, '_blank')}>
              Go to Fapshi
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
