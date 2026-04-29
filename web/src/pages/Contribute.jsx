import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contribute } from '../api/groups';
import { getContributionReceipt } from '../api/receipts';
import { useLanguage } from '../context/LanguageContext';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Contribute.module.css';

const METHODS = [
  { key: 'mtn_momo', label: 'MTN Mobile Money', color: '#FFCC00', bg: '#FFFBEB' },
  { key: 'orange_money', label: 'Orange Money', color: '#FF6600', bg: '#FFF7ED' },
];

export default function Contribute() {
  const { id } = useParams();
  const { state } = useLocation();
  const amount = state?.amount || 0;
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [method, setMethod] = useState('mtn_momo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await contribute(id, { payment_method: method });
      // Fetch and show receipt
      const receiptRes = await getContributionReceipt(res.data.contributionId);
      setReceipt(receiptRes.data);
    } catch (err) {
      setError(err.message || t('paymentFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptClose = () => {
    setReceipt(null);
    navigate(`/groups/${id}`);
  };

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>
      <h1>{t('makeContribution')}</h1>

      <div className={styles.amountCard}>
        <p>{t('amountToPay')}</p>
        <h2>{Number(amount).toLocaleString()} XAF</h2>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <h3>{t('selectPaymentMethod')}</h3>
        <div className={styles.methods}>
          {METHODS.map(m => (
            <div
              key={m.key}
              className={`${styles.method} ${method === m.key ? styles.selected : ''}`}
              style={{ borderColor: method === m.key ? m.color : 'var(--border)', background: method === m.key ? m.bg : 'var(--bg-card)' }}
              onClick={() => setMethod(m.key)}
            >
              <div className={styles.dot} style={{ background: m.color }} />
              <span>{m.label}</span>
              {method === m.key && <span className={styles.check}>✓</span>}
            </div>
          ))}
        </div>
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? t('processing') : `${t('pay')} ${Number(amount).toLocaleString()} XAF`}
        </button>
      </form>

      {receipt && <ReceiptModal receipt={receipt} onClose={handleReceiptClose} />}
    </div>
  );
}
