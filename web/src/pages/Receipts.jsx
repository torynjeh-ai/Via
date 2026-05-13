import React, { useEffect, useState } from 'react';
import { getReceiptHistory, getContributionReceipt, getPayoutReceipt, getTransactionReceipt, getSavingsReceipt, getSavingsWithdrawalReceipt } from '../api/receipts';
import { formatDate } from '../utils/dateFormat';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Receipts.module.css';

const TYPE_CONFIG = {
  contribution:       { icon: '💳', label: 'Contribution',         color: 'var(--danger)',  sign: '-' },
  payout:             { icon: '💰', label: 'Payout',               color: 'var(--success)', sign: '+' },
  top_up:             { icon: '⬆️', label: 'Deposit',              color: 'var(--success)', sign: '+' },
  withdrawal:         { icon: '⬇️', label: 'Withdrawal',           color: 'var(--danger)',  sign: '-' },
  transfer_out:       { icon: '📤', label: 'Transfer Sent',        color: 'var(--danger)',  sign: '-' },
  transfer_in:        { icon: '📥', label: 'Transfer Received',    color: 'var(--success)', sign: '+' },
  savings_deposit:    { icon: '🏦', label: 'Savings Deposit',      color: 'var(--danger)',  sign: '-' },
  savings_withdrawal: { icon: '🏧', label: 'Savings Withdrawal',   color: 'var(--success)', sign: '+' },
};

const FILTERS = [
  { key: 'all',               label: 'All' },
  { key: 'contribution',      label: '💳 Contributions' },
  { key: 'payout',            label: '💰 Payouts' },
  { key: 'top_up',            label: '⬆️ Deposits' },
  { key: 'withdrawal',        label: '⬇️ Withdrawals' },
  { key: 'transfer_out',      label: '📤 Transfers' },
  { key: 'savings_deposit',   label: '🏦 Savings' },
];

export default function Receipts() {
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [receipt, setReceipt]     = useState(null);
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
      let res;
      if (item.type === 'contribution') {
        res = await getContributionReceipt(item.id);
      } else if (item.type === 'payout') {
        res = await getPayoutReceipt(item.id);
      } else if (item.type === 'savings_deposit') {
        res = await getSavingsReceipt(item.id);
      } else if (item.type === 'savings_withdrawal') {
        res = await getSavingsWithdrawalReceipt(item.id);
      } else {
        res = await getTransactionReceipt(item.id);
      }
      setReceipt(res.data);
    } catch { /* receipt may not exist yet */ }
    finally { setLoadingId(null); }
  };

  const filtered = filter === 'all'
    ? history
    : filter === 'transfer_out'
      ? history.filter(h => h.type === 'transfer_out' || h.type === 'transfer_in')
      : history.filter(h => h.type === filter);

  const totalIn  = history.filter(h => ['payout', 'top_up', 'transfer_in', 'savings_withdrawal'].includes(h.type)).reduce((s, h) => s + h.amount, 0);
  const totalOut = history.filter(h => ['contribution', 'withdrawal', 'transfer_out', 'savings_deposit'].includes(h.type)).reduce((s, h) => s + h.amount, 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>My Receipts</h1>

      {/* Summary cards */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📥</div>
          <div>
            <div className={styles.summaryLabel}>Total In</div>
            <div className={styles.summaryAmount} style={{ color: 'var(--success)' }}>+{totalIn.toLocaleString()} XAF</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📤</div>
          <div>
            <div className={styles.summaryLabel}>Total Out</div>
            <div className={styles.summaryAmount} style={{ color: 'var(--danger)' }}>-{totalOut.toLocaleString()} XAF</div>
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
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
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
          <small>All your transaction receipts will appear here</small>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(item => {
            const cfg = TYPE_CONFIG[item.type] || { icon: '💱', label: item.label || item.type, color: 'var(--text)', sign: '' };
            return (
              <div key={item.id} className={styles.item} onClick={() => handleView(item)}>
                <div className={styles.itemIcon}>{cfg.icon}</div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemTitle}>
                    {cfg.label}
                    {item.group_name && ` — ${item.group_name}`}
                    {item.goal_name && ` — ${item.goal_name}`}
                    {item.counterparty_name && ` — ${item.counterparty_name}`}
                  </div>
                  <div className={styles.itemMeta}>
                    {item.receipt_number}
                    {item.cycle_number && ` · Cycle #${item.cycle_number}`}
                    {item.position && ` · Position #${item.position}`}
                    {' · '}{formatDate(item.date)}
                  </div>
                </div>
                <div className={styles.itemRight}>
                  <div className={styles.itemAmount} style={{ color: cfg.color }}>
                    {cfg.sign}{item.amount.toLocaleString()} XAF
                  </div>
                  <div className={styles.viewBtn}>
                    {loadingId === item.id ? '⏳' : '🧾 View'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
