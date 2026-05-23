import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { topUp, getPaymentStatus } from '../api/wallet';
import styles from './TopUp.module.css';

const PAYMENT_METHODS = [
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
];

export default function TopUp() {
  const [xafAmount, setXafAmount]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [phone, setPhone]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(null);
  const [error, setError]               = useState('');

  // Fapshi polling state
  const [pendingTransId, setPendingTransId] = useState(null);
  const [pollStatus, setPollStatus]         = useState('');
  const pollRef = useRef(null);

  // Poll for payment confirmation
  useEffect(() => {
    if (!pendingTransId) return;

    let attempts = 0;
    const MAX = 24; // 24 × 5s = 2 minutes

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
          setPhone('');
          setLoading(false);
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          clearInterval(pollRef.current);
          setPendingTransId(null);
          setPollStatus('');
          setError(status === 'FAILED' ? 'Payment was declined. Please try again.' : 'Payment request expired. Please try again.');
          setLoading(false);
        } else {
          setPollStatus(status === 'PENDING' ? 'Waiting for your approval…' : 'Sending payment request…');
        }
      } catch {
        // ignore poll errors, keep trying
      }

      if (attempts >= MAX) {
        clearInterval(pollRef.current);
        setPendingTransId(null);
        setPollStatus('');
        setError('Payment timed out. Please check your phone and try again.');
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
    if (!phone) { setError('Phone number is required'); return; }

    setLoading(true);
    setPollStatus('Sending payment request…');
    try {
      const res = await topUp({ xaf_amount: amount, payment_method: paymentMethod, phone });
      setPendingTransId(res.data.transId);
    } catch (err) {
      setError(err.message || 'Deposit failed. Please try again.');
      setLoading(false);
      setPollStatus('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Top Up Wallet</h1>
        <p className={styles.subtitle}>Add funds via MTN MoMo or Orange Money</p>
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

      {/* Waiting for phone approval */}
      {pendingTransId && (
        <div className={styles.pendingBanner}>
          <div className={styles.spinner} />
          <div>
            <strong>{pollStatus || 'Waiting for payment…'}</strong>
            <p>Check your phone and approve the payment prompt. This page will update automatically.</p>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="xafAmount">Amount (XAF)</label>
          <input
            id="xafAmount" type="number" className={styles.input}
            value={xafAmount} onChange={e => setXafAmount(e.target.value)}
            placeholder="e.g. 10000" min="100" step="100" required
            disabled={loading}
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone">Phone Number</label>
          <input
            id="phone" type="tel" className={styles.input}
            value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+237 6XX XXX XXX" required disabled={loading}
          />
          <p className={styles.hint}>The payment prompt will be sent to this number</p>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? (pollStatus || 'Processing…') : `Top Up ${xafAmount ? `${Number(xafAmount).toLocaleString()} XAF` : ''}`}
        </button>
      </form>
    </div>
  );
}
