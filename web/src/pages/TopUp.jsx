import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { topUp } from '../api/wallet';
import styles from './TopUp.module.css';

const PAYMENT_METHODS = [
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer',label: '🏦 Bank Transfer' },
  { value: 'card',         label: '💳 Card' },
  { value: 'apple_pay',    label: '🍎 Apple Pay' },
  { value: 'paypal',       label: '🅿️ PayPal' },
];

export default function TopUp() {
  const [xafAmount, setXafAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  const tcPreview = xafAmount && Number(xafAmount) >= 100
    ? (Number(xafAmount) / 10000).toFixed(4)
    : null;

  const needsPhone = paymentMethod === 'mtn_momo' || paymentMethod === 'orange_money';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    const amount = Number(xafAmount);
    if (!amount || amount < 100) {
      setError('Minimum deposit amount is 100 XAF');
      return;
    }

    setLoading(true);
    try {
      const res = await topUp({
        xaf_amount: amount,
        payment_method: paymentMethod,
        ...(needsPhone && phone ? { phone } : {}),
      });
      setSuccess(res.data);
      setXafAmount('');
      setPhone('');
    } catch (err) {
      setError(err.message || 'Deposit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Deposit to Wallet</h1>
        <p className={styles.subtitle}>Add funds to your TC wallet using a payment method below</p>
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Deposit successful!</strong>
            <p>
              Your wallet has been credited with{' '}
              <strong>{Number(success.tc_amount || success.tc_credited).toFixed(4)} TC</strong>.
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

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="xafAmount">Amount (XAF)</label>
          <input
            id="xafAmount"
            type="number"
            className={styles.input}
            value={xafAmount}
            onChange={(e) => setXafAmount(e.target.value)}
            placeholder="e.g. 10000"
            min="100"
            step="100"
            required
          />
          {tcPreview && (
            <p className={styles.preview}>≈ {tcPreview} TC will be credited</p>
          )}
          <p className={styles.hint}>Minimum: 100 XAF · 1 TC = 10,000 XAF</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Payment Method</label>
          <div className={styles.methodGrid}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`${styles.methodBtn} ${paymentMethod === m.value ? styles.methodActive : ''}`}
                onClick={() => setPaymentMethod(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {needsPhone && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
            />
          </div>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Processing...' : `Deposit ${xafAmount ? `${Number(xafAmount).toLocaleString()} XAF` : ''}`}
        </button>
      </form>
    </div>
  );
}
