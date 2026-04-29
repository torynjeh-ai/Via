import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getTransferPreview, transfer } from '../api/wallet';
import TransferConfirm from '../components/TransferConfirm';
import styles from './Transfer.module.css';

export default function Transfer() {
  const [recipient, setRecipient] = useState('');
  const [tcAmount, setTcAmount] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  const handlePreview = async (e) => {
    e.preventDefault();
    setPreviewError('');
    setPreview(null);
    setError('');

    const amount = Number(tcAmount);
    if (!recipient.trim()) {
      setPreviewError('Please enter a recipient phone number or wallet code');
      return;
    }
    if (!amount || amount <= 0) {
      setPreviewError('Please enter a valid TC amount');
      return;
    }

    setPreviewLoading(true);
    setShowConfirm(true);
    try {
      const res = await getTransferPreview({
        recipient_identifier: recipient.trim(),
        tc_amount: amount,
      });
      setPreview(res.data);
    } catch (err) {
      setPreviewError(err.message || 'Could not load transfer preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setTransferLoading(true);
    try {
      const res = await transfer({
        recipient_identifier: recipient.trim(),
        tc_amount: Number(tcAmount),
      });
      setSuccess(res.data);
      setShowConfirm(false);
      setRecipient('');
      setTcAmount('');
      setPreview(null);
    } catch (err) {
      setError(err.message || 'Transfer failed. Please try again.');
      setShowConfirm(false);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPreview(null);
    setPreviewError('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Send TC</h1>
        <p className={styles.subtitle}>Transfer TC to another Via user by phone number or wallet code</p>
      </div>

      {success && (
        <div className={styles.successBanner}>
          <span>✅</span>
          <div>
            <strong>Transfer successful!</strong>
            <p>
              Sent <strong>{Number(success.tc_amount).toFixed(4)} TC</strong> to {success.recipient_name || 'recipient'}.
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

      <form className={styles.form} onSubmit={handlePreview}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="recipient">Recipient</label>
          <input
            id="recipient"
            type="text"
            className={styles.input}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Phone number or VIA-XXXXX wallet code"
            required
          />
          <p className={styles.hint}>Enter a phone number (e.g. +237 6XX XXX XXX) or a wallet code (e.g. VIA-AB12C)</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tcAmount">Amount (TC)</label>
          <input
            id="tcAmount"
            type="number"
            className={styles.input}
            value={tcAmount}
            onChange={(e) => setTcAmount(e.target.value)}
            placeholder="e.g. 1.0000"
            min="0.0001"
            step="0.0001"
            required
          />
          {tcAmount && Number(tcAmount) > 0 && (
            <p className={styles.preview}>
              ≈ {(Number(tcAmount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
            </p>
          )}
        </div>

        {previewError && !showConfirm && (
          <div className={styles.errorBanner}>
            <span>⚠️</span>
            <p>{previewError}</p>
          </div>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={previewLoading || transferLoading}
        >
          Preview Transfer →
        </button>
      </form>

      {showConfirm && (
        <TransferConfirm
          preview={preview}
          loading={previewLoading}
          error={previewError}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
