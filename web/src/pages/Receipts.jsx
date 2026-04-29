import React, { useEffect, useState } from 'react';
import { getReceiptHistory, getContributionReceipt, getPayoutReceipt } from '../api/receipts';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Receipts.module.css';

export default function Receipts() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // all | contribution | payout
  const [receipt, setReceipt]   = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    getReceiptHistory()
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleView = async (item) => {
    setLoadingId(item.id);
    try {
      const res = item.type === 'contribution'
        ? await getContributionReceipt(item.id)
        : await getPayoutReceipt(item.id);
      setReceipt(res.data);
    } catch { /* receipt may not exist yet */ }
    finally { setLoadingId(null); }
  };

  const filtered = filter === 'all' ? history : history.filter(h => h.type === filter);

  const totalContributions = history.filter(h => h.type === 'contribution').reduce((s, h) => s + h.amount, 0);
  const totalPayouts       = history.filter(h => h.type === 'payout').reduce((s, h) => s + h.amount, 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>My Receipts</h1>

      {/* Summary cards */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>💳</div>
          <div>
            <div className={styles.summaryLabel}>Total Contributed</div>
            <div className={styles.summaryAmount}>{totalContributions.toLocaleString()} XAF</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>💰</div>
          <div>
            <div className={styles.summaryLabel}>Total Received</div>
            <div className={styles.summaryAmount}>{totalPayouts.toLocaleString()} XAF</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>🧾</div>
          <div>
            <div className={styles.summaryLabel}>Total Receipts</div>
            <div className={styles.summaryAmount}>{history.length}</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filters}>
        {['all', 'contribution', 'payout'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'contribution' ? '💳 Contributions' : '💰 Payouts'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧾</div>
          <p>No receipts yet</p>
          <small>Your contribution and payout receipts will appear here</small>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(item => (
            <div key={item.id} className={styles.item} onClick={() => handleView(item)}>
              <div className={styles.itemIcon}>
                {item.type === 'contribution' ? '💳' : '💰'}
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemTitle}>
                  {item.type === 'contribution' ? 'Contribution' : 'Payout'} — {item.group_name}
                </div>
                <div className={styles.itemMeta}>
                  {item.receipt_number}
                  {item.type === 'contribution' && ` · Cycle #${item.cycle_number}`}
                  {item.type === 'payout' && ` · Position #${item.position}`}
                  {' · '}{new Date(item.date).toLocaleDateString()}
                </div>
              </div>
              <div className={styles.itemRight}>
                <div className={`${styles.itemAmount} ${item.type === 'payout' ? styles.payout : ''}`}>
                  {item.type === 'payout' ? '+' : '-'}{item.amount.toLocaleString()} XAF
                </div>
                <div className={styles.viewBtn}>
                  {loadingId === item.id ? '⏳' : '🧾 View'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
