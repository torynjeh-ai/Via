import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPayouts } from '../api/groups';
import { getPayoutReceipt } from '../api/receipts';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Payouts.module.css';

const statusColor = { upcoming: '#6B7280', current: 'var(--primary)', completed: '#16A34A', skipped: '#DC2626' };

export default function Payouts() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(null); // holds payout id being loaded

  useEffect(() => {
    getPayouts(id).then(r => setPayouts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleViewReceipt = async (payout) => {
    if (payout.status !== 'completed') return;
    setReceiptLoading(payout.id);
    try {
      const res = await getPayoutReceipt(payout.id);
      setReceipt(res.data);
    } catch {
      // silently ignore — payout may not have a receipt yet
    } finally {
      setReceiptLoading(null);
    }
  };

  return (
    <div>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>
      <p className={styles.title}>{t('payoutQueue')}</p>

      {loading ? <p>{t('loading')}</p> : payouts.length === 0 ? (
        <div className={styles.empty}>{t('noPayoutYet')}</div>
      ) : (
        <div className={styles.list}>
          {payouts.map(p => (
            <div
              key={p.id}
              className={`${styles.item} ${p.user_id === user?.id ? styles.mine : ''} ${p.status === 'current' ? styles.current : ''} ${p.status === 'completed' && p.user_id === user?.id ? styles.clickable : ''}`}
              onClick={() => p.status === 'completed' && p.user_id === user?.id && handleViewReceipt(p)}
              title={p.status === 'completed' && p.user_id === user?.id ? 'Click to view receipt' : ''}
            >
              <div className={styles.position} style={{ background: statusColor[p.status] }}>#{p.position}</div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {p.name} {p.user_id === user?.id ? <span className={styles.you}>{t('you')}</span> : ''}
                </div>
                <div className={styles.meta}>
                  {Number(p.amount).toLocaleString()} XAF
                  {p.payout_date && ` · ${new Date(p.payout_date).toLocaleDateString()}`}
                </div>
              </div>
              <div className={styles.right}>
                <span className={styles.badge} style={{ background: statusColor[p.status] + '20', color: statusColor[p.status] }}>
                  {p.status}
                </span>
                {p.status === 'completed' && p.user_id === user?.id && (
                  <span className={styles.receiptHint}>
                    {receiptLoading === p.id ? '⏳' : '🧾 Receipt'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
