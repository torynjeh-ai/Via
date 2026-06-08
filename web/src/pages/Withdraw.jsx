import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { withdraw } from '../api/wallet';
import styles from './Withdraw.module.css';

const METHODS = [
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money', available: true },
  { value: 'orange_money', label: '🟠 Orange Money',      available: true },
  { value: 'bank_transfer',label: '🏦 Bank Transfer',     available: true },
  { value: 'card',         label: '💳 Card',         available: false },
];

export default function Withdraw() {
  const [tcAmount, setTcAmount]           = useState('');
  const [method, setMethod]               = useState('mtn_momo');
  const [phone, setPhone]                 = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [loading, setLoading]             = useState(false);
  const [success, setSuccess]             = useState(null);
  const [error, setError]                 = useState('');
  const [limitError, setLimitError]       = useState(null);

  const xafPreview = tcAmount && Number(tcAmount) >= 0.01
    ? (Number(tcAmount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : null;

  const buildDestination = () => {
    const dest = { method };
    if (method === 'mtn_momo' || method === 'orange_money') dest.phone = phone;
    else if (method === 'bank_transfer') dest.account_details = accountDetails;
    return dest;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLimitError(null); setSuccess(null);

    const amount = Number(tcAmount);
    if (!amount || amount < 0.01) { setError('Minimum withdrawal is 0.01 TC'); return; }

    setLoading(true);
    try {
      const res = await withdraw({ tc_amount: amount, destination: buildDestination() });
      setSuccess(res.data);
      setTcAmount(''); setPhone(''); setAccountDetails('');
    } catch (err) {
      if (err.code === 'LIMIT_EXCEEDED') setLimitError(err);
      else setError(err.message || 'Withdrawal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Withdraw TC</h1>
        <p className={styles.subtitle}>Convert your TC balance to fiat</p>
      </div>

      {/* Info banner — disbursements coming soon */}
      <div style={{ background:'#fef9c3', border:'1.5px solid #fcd34d', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#92400e' }}>
        ℹ️ Withdrawals are currently processed manually within 24 hours. You will be contacted once your withdrawal is approved.
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Withdrawal request submitted!</strong>
            <p>
              <strong>{Number(success.tc_amount).toFixed(4)} TC</strong> deducted.
              New balance: <strong>{Number(success.new_balance).toFixed(4)} TC</strong>
            </p>
          </div>
        </div>
      )}

      {error && <div className={styles.errorBanner}><span>⚠️</span><p>{error}</p></div>}

      {limitError && (
        <div className={styles.limitBanner}>
          <span>🚫</span>
          <div>
            <strong>Limit exceeded: {limitError.limitType}</strong>
            <p>
              {limitError.currentTotal != null && <>Used: {Number(limitError.currentTotal).toFixed(4)} TC / {Number(limitError.limit).toFixed(0)} TC limit. </>}
              {limitError.resetsAt && <>Resets: {new Date(limitError.resetsAt).toLocaleString()}</>}
            </p>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tcAmount">Amount (TC)</label>
          <input id="tcAmount" type="number" className={styles.input}
            value={tcAmount} onChange={e => setTcAmount(e.target.value)}
            placeholder="e.g. 1.0000" min="0.01" step="0.0001" required />
          {xafPreview && <p className={styles.preview}>≈ {xafPreview} XAF</p>}
          <p className={styles.hint}>Minimum: 0.01 TC · Max single: 200 TC · 1 TC = 10,000 XAF</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Destination Method</label>
          <div className={styles.methodGrid}>
            {METHODS.map(m => (
              <button key={m.value} type="button"
                className={`${styles.methodBtn} ${method === m.value ? styles.methodActive : ''}`}
                style={{ opacity: m.available ? 1 : 0.5, cursor: m.available ? 'pointer' : 'not-allowed' }}
                onClick={() => {
                  if (!m.available) { alert('Card payments are not available at the moment.'); return; }
                  setMethod(m.value);
                }}>
                {m.label}
                {!m.available && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Not available</div>}
              </button>
            ))}
          </div>
        </div>

        {(method === 'mtn_momo' || method === 'orange_money') && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">Phone Number</label>
            <input id="phone" type="tel" className={styles.input}
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX" required />
          </div>
        )}

        {method === 'bank_transfer' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="accountDetails">Account Details</label>
            <textarea id="accountDetails" className={`${styles.input} ${styles.textarea}`}
              value={accountDetails} onChange={e => setAccountDetails(e.target.value)}
              placeholder="Bank name, account number, account name..." rows={3} required />
          </div>
        )}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Submitting…' : `Request Withdrawal ${tcAmount ? `${Number(tcAmount).toFixed(4)} TC` : ''}`}
        </button>
      </form>
    </div>
  );
}
