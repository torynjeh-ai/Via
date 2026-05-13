import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contribute, getContributionInfo } from '../api/groups';
import { getContributionReceipt } from '../api/receipts';
import { useLanguage } from '../context/LanguageContext';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Contribute.module.css';

const METHODS = [
  { key: 'mtn_momo',     label: 'MTN Mobile Money', color: '#FFCC00', bg: '#FFFBEB' },
  { key: 'orange_money', label: 'Orange Money',      color: '#FF6600', bg: '#FFF7ED' },
  { key: 'tc_wallet',    label: 'TC Wallet',         color: '#6C63FF', bg: '#F0EEFF' },
];

export default function Contribute() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [method, setMethod]       = useState('mtn_momo');
  const [loading, setLoading]     = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);
  const [error, setError]         = useState('');
  const [receipt, setReceipt]     = useState(null);
  const [info, setInfo]           = useState(null); // contribution-info from backend

  useEffect(() => {
    getContributionInfo(id)
      .then(r => setInfo(r.data))
      .catch(() => {
        // Fallback to state amount if info endpoint fails
        setInfo({ contribution_amount: state?.amount || 0, is_late: false, penalty_amount: 0, total_due: state?.amount || 0 });
      })
      .finally(() => setInfoLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await contribute(id, { payment_method: method });
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

  if (infoLoading) return <div className={styles.container}><p>{t('loading')}</p></div>;

  const totalDue      = info?.total_due || 0;
  const isLate        = info?.is_late || false;
  const penaltyAmount = info?.penalty_amount || 0;
  const baseAmount    = info?.contribution_amount || 0;

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>
      <h1>{t('makeContribution')}</h1>

      {/* Amount card */}
      <div className={`${styles.amountCard} ${isLate ? styles.amountCardLate : ''}`}>
        <p>{t('amountToPay')}</p>
        <h2>{Number(totalDue).toLocaleString()} XAF</h2>
        {isLate && (
          <div className={styles.penaltyBreakdown}>
            <div className={styles.penaltyRow}>
              <span>Contribution</span>
              <span>{Number(baseAmount).toLocaleString()} XAF</span>
            </div>
            <div className={`${styles.penaltyRow} ${styles.penaltyLine}`}>
              <span>⚠️ Late penalty</span>
              <span>+ {Number(penaltyAmount).toLocaleString()} XAF</span>
            </div>
            <div className={`${styles.penaltyRow} ${styles.penaltyTotal}`}>
              <span>Total due</span>
              <span>{Number(totalDue).toLocaleString()} XAF</span>
            </div>
          </div>
        )}
      </div>

      {isLate && (
        <div className={styles.lateWarning}>
          ⚠️ Your payment is past the deadline. A penalty of <strong>{Number(penaltyAmount).toLocaleString()} XAF</strong> has been added. This penalty will be distributed to other group members.
        </div>
      )}

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
          {loading ? t('processing') : `${t('pay')} ${Number(totalDue).toLocaleString()} XAF`}
        </button>
      </form>

      {receipt && <ReceiptModal receipt={receipt} onClose={handleReceiptClose} />}
    </div>
  );
}
