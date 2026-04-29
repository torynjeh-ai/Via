import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { withdraw } from '../api/wallet';
import styles from './Withdraw.module.css';

const METHODS = [
  { value: 'mtn_momo', label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'card', label: '💳 Card' },
];

export default function Withdraw() {
  const [tcAmount, setTcAmount] = useState('');
  const [method, setMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [cardDetails, setCardDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [limitError, setLimitError] = useState(null);

  const xafPreview = tcAmount && Number(tcAmount) >= 0.01
    ? (Number(tcAmount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : null;

  const buildDestination = () => {
    const dest = { method };
    if (method === 'mtn_momo' || method === 'orange_money') {
      dest.phone = phone;
    } else if (method === 'bank_transfer') {
      dest.account_details = accountDetails;
    } else if (method === 'card') {
      dest.card_details = cardDetails;
    }
    return dest;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLimitError(null);
    setSuccess(null);

    const amount = Number(tcAmount);
    if (!amount || amount < 0.01) {
      setError('Minimum withdrawal is 0.01 TC');
      return;
    }

    setLoading(true);
    try {
      const res = await withdraw({
        tc_amount: amount,
        destination: buildDestination(),
      });
      setSuccess(res.data);
      setTcAmount('');
      setPhone('');
      setAccountDetails('');
      setCardDetails('');
    } catch (err) {
      if (err.code === 'LIMIT_EXCEEDED') {
        setLimitError(err);
      } else {
        setError(err.message || 'Withdrawal failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Withdraw TC</h1>
        <p className={styles.subtitle}>Convert your TC balance to fiat and receive it via your preferred method</p>
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Withdrawal successful!</strong>
            <p>
              <strong>{Number(success.tc_amount).toFixed(4)} TC</strong> withdrawn.
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

      {limitError && (
        <div className={styles.limitBanner}>
          <span>🚫</span>
          <div>
            <strong>Limit exceeded: {limitError.limitType}</strong>
            <p>
              {limitError.currentTotal != null && (
                <>Used: {Number(limitError.currentTotal).toFixed(4)} TC / {Number(limitError.limit).toFixed(0)} TC limit. </>
              )}
              {limitError.resetsAt && (
                <>Resets: {new Date(limitError.resetsAt).toLocaleString()}</>
              )}
            </p>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tcAmount">Amount (TC)</label>
          <input
            id="tcAmount"
            type="number"
            className={styles.input}
            value={tcAmount}
            onChange={(e) => setTcAmount(e.target.value)}
            placeholder="e.g. 1.0000"
            min="0.01"
            step="0.0001"
            required
          />
          {xafPreview && (
            <p className={styles.preview}>≈ {xafPreview} XAF</p>
          )}
          <p className={styles.hint}>Minimum: 0.01 TC · Max single: 200 TC · 1 TC = 10,000 XAF</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Destination Method</label>
          <div className={styles.methodGrid}>
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`${styles.methodBtn} ${method === m.value ? styles.methodActive : ''}`}
                onClick={() => setMethod(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {(method === 'mtn_momo' || method === 'orange_money') && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
              required
            />
          </div>
        )}

        {method === 'bank_transfer' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="accountDetails">Account Details</label>
            <textarea
              id="accountDetails"
              className={`${styles.input} ${styles.textarea}`}
              value={accountDetails}
              onChange={(e) => setAccountDetails(e.target.value)}
              placeholder="Bank name, account number, account name..."
              rows={3}
              required
            />
          </div>
        )}

        {method === 'card' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cardDetails">Card Details</label>
            <input
              id="cardDetails"
              type="text"
              className={styles.input}
              value={cardDetails}
              onChange={(e) => setCardDetails(e.target.value)}
              placeholder="Card number or reference"
              required
            />
          </div>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Processing...' : `Withdraw ${tcAmount ? `${Number(tcAmount).toFixed(4)} TC` : ''}`}
        </button>
      </form>
    </div>
  );
}
