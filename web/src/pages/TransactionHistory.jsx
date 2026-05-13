import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getTransactions } from '../api/wallet';
import { formatDateTime } from '../utils/dateFormat';
import styles from './TransactionHistory.module.css';

const PAGE_SIZE = 50;

const TX_ICONS = {
  top_up: '⬆️',
  withdrawal: '⬇️',
  contribution: '💳',
  payout: '💰',
  transfer_in: '📥',
  transfer_out: '📤',
};

const TX_LABELS = {
  top_up: 'Deposit',
  withdrawal: 'Withdrawal',
  contribution: 'Contribution',
  payout: 'Payout',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
};

const STATUS_COLORS = {
  completed: '#4CAF50',
  pending: '#FF9800',
  failed: '#f44336',
  reversed: '#9E9E9E',
};

const CREDIT_TYPES = new Set(['top_up', 'payout', 'transfer_in']);

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'top_up', label: '⬆️ Deposit' },
  { value: 'withdrawal', label: '⬇️ Withdrawal' },
  { value: 'contribution', label: '💳 Contribution' },
  { value: 'payout', label: '💰 Payout' },
  { value: 'transfer_in', label: '📥 Transfer In' },
  { value: 'transfer_out', label: '📤 Transfer Out' },
];

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTransactions = useCallback(async (currentPage, currentFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      };
      if (currentFilter !== 'all') params.type = currentFilter;

      const res = await getTransactions(params);
      setTransactions(res.data?.transactions || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions(page, filter);
  }, [page, filter, fetchTransactions]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/wallet" className={styles.back}>← Back to Wallet</Link>
        <h1 className={styles.title}>Transaction History</h1>
        <p className={styles.subtitle}>{total} transaction{total !== 1 ? 's' : ''} total</p>
      </div>

      {/* Filter tabs */}
      <div className={styles.filters}>
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ''}`}
            onClick={() => handleFilterChange(f.value)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {loading ? (
        <div className={styles.empty}>Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <p>No transactions found</p>
          <small>
            {filter !== 'all'
              ? `No ${TX_LABELS[filter] || filter} transactions yet`
              : 'Your wallet activity will appear here'}
          </small>
        </div>
      ) : (
        <div className={styles.list}>
          {transactions.map((tx) => (
            <div key={tx.id} className={styles.item}>
              <div className={styles.itemIcon}>{TX_ICONS[tx.type] || '💱'}</div>
              <div className={styles.itemInfo}>
                <div className={styles.itemType}>{TX_LABELS[tx.type] || tx.type}</div>
                <div className={styles.itemMeta}>
                  {tx.counterparty_name && <span>{tx.counterparty_name} · </span>}
                  {tx.group_id && <span>Group · </span>}
                  {formatDateTime(tx.created_at)}
                </div>
              </div>
              <div className={styles.itemRight}>
                <div className={`${styles.itemAmount} ${CREDIT_TYPES.has(tx.type) ? styles.credit : styles.debit}`}>
                  {CREDIT_TYPES.has(tx.type) ? '+' : '-'}{Number(tx.tc_amount).toFixed(4)} TC
                </div>
                <div className={styles.itemXaf}>
                  {Number(tx.xaf_amount || tx.tc_amount * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
                </div>
                <span
                  className={styles.statusBadge}
                  style={{ background: STATUS_COLORS[tx.status] || '#9E9E9E' }}
                >
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            type="button"
          >
            ← Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            type="button"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
