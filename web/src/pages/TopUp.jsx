import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { topUp, getPaymentStatus } from '../api/wallet';
import styles from './TopUp.module.css';

const PAYMENT_METHODS = [
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money', available: true },
  { value: 'orange_money', label: '🟠 Orange Money',      available: true },
  { value: 'card',         label: '💳 Card',            available: false },
];

export default function TopUp() {
  const [xafAmount, setXafAmount]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [loading, setLoading]             = useState(false);
  const [success, setSuccess]             = useState(null);
  const [error, setError]                 = useState('');
  const [paymentLink, setPaymentLink]     = useState(null); // Fapshi link
  const [storedLink, setStoredLink]       = useState(null); // keep link for reopen
  const [pendingTransId, setPendingTransId] = useState(null);
  const [pollStatus, setPollStatus]         = useState('');
  const pollRef = useRef(null);

  // Poll for payment confirmation
  useEffect(() => {
    if (!pendingTransId) return;

    let attempts = 0;
    const MAX = 36; // 3 minutes

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await getPaymentStatus(pendingTransId);
        const { status, new_balance, tc_amount, xaf_amount } = res.data;

        if (status === 'SUCCESSFUL') {
          clearInterval(pollRef.current);
          setPendingTransId(null);
          setPaymentLink(null);
          setPollStatus('');
          setSuccess({ tc_amount, xaf_amount, new_balance });
          setXafAmount('');
          setLoading(false);
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          clearInterval(pollRef.current);
          setPendingTransId(null);
          setPaymentLink(null);
          setPollStatus('');
          setError(status === 'FAILED' ? 'Payment was declined. Please try again.' : 'Payment link expired. Please try again.');
          setLoading(false);
        } else {
          setPollStatus(status === 'PENDING' ? 'Payment in progress…' : 'Waiting for payment…');
        }
      } catch { /* ignore */ }

      if (attempts >= MAX) {
        clearInterval(pollRef.current);
        setPendingTransId(null);
        setPaymentLink(null);
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
      setPaymentLink(link);
      setStoredLink(link);
      setPendingTransId(transId);
      setPollStatus('Waiting for payment…');
    } catch (err) {
      setError(err.message || 'Failed to generate payment link. Please try again.');
      setLoading(false);
    }
  };

  const handleClosePayment = () => {
    setPaymentLink(null);
    // Keep polling — user may have paid before closing
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Top Up Wallet</h1>
        <p className={styles.subtitle}>Pay via MTN MoMo or Orange Money</p>
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Top-up successful!</strong>
            <p>Credited <strong>{Number(success.tc_amount).toFixed(4)} TC</strong>. New balance: <strong>{Number(success.new_balance).toFixed(4)} TC</strong></p>
          </div>
        </div>
      )}

      {error && <div className={styles.errorBanner}><span>⚠️</span><p>{error}</p></div>}

      {/* Polling status bar */}
      {pendingTransId && !paymentLink && (
        <div className={styles.pendingBanner}>
          <div className={styles.spinner} />
          <div>
            <strong>{pollStatus || 'Waiting for payment…'}</strong>
            <p>This page updates automatically once payment is confirmed.</p>
            {pendingTransId && (
              <button type="button" className={styles.reopenBtn}
                onClick={() => setPaymentLink(storedLink)}>
                Reopen payment page
              </button>
            )}
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="xafAmount">Amount (XAF)</label>
          <input id="xafAmount" type="number" className={styles.input}
            value={xafAmount} onChange={e => setXafAmount(e.target.value)}
            placeholder="e.g. 10000" min="100" step="100" required disabled={loading} />
          {tcPreview && <p className={styles.preview}>≈ {tcPreview} TC will be credited</p>}
          <p className={styles.hint}>Minimum: 100 XAF · 1 TC = 10,000 XAF</p>
        </div>

          <div className={styles.field}>
          <label className={styles.label}>Payment Method</label>
          <div className={styles.methodGrid}>
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} type="button"
                className={`${styles.methodBtn} ${paymentMethod === m.value ? styles.methodActive : ''} ${!m.available ? styles.methodDisabled : ''}`}
                onClick={() => {
                  if (!m.available) return;
                  setPaymentMethod(m.value);
                }}
                disabled={loading}
                title={!m.available ? 'Card payments are not available at the moment' : undefined}
              >
                {m.label}
                {!m.available && <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Not available</span>}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading || !!pendingTransId}>
          {loading ? (pollStatus || 'Opening payment…') : `Top Up ${xafAmount ? `${Number(xafAmount).toLocaleString()} XAF` : ''}`}
        </button>
      </form>

      {/* Fapshi payment iframe modal */}
      {paymentLink && (
        <div className={styles.paymentOverlay}>
          <div className={styles.paymentModal}>
            <div className={styles.paymentHeader}>
              <span>Complete Payment</span>
              <button className={styles.closeBtn} onClick={handleClosePayment}>✕</button>
            </div>
            {pendingTransId && (
              <div className={styles.paymentStatus}>
                <div className={styles.spinnerSm} />
                <span>{pollStatus || 'Waiting for payment…'}</span>
              </div>
            )}
            <iframe
              src={paymentLink}
              title="Fapshi Payment"
              className={styles.paymentFrame}
              allow="payment"
            />
          </div>
        </div>
      )}
    </div>
  );
}
