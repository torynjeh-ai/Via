import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWallet, getTransactions } from '../api/wallet';
import TCBalance from '../components/TCBalance';
import WalletCode from '../components/WalletCode';
import styles from './Wallet.module.css';

const TX_ICONS = {
  top_up: '⬆️',
  withdrawal: '⬇️',
  contribution: '💳',
  payout: '💰',
  transfer_in: '📥',
  transfer_out: '📤',
};

const TX_LABELS = {
  top_up: 'Top Up',
  withdrawal: 'Withdrawal',
  contribution: 'Contribution',
  payout: 'Payout',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
};

const CREDIT_TYPES = new Set(['top_up', 'payout', 'transfer_in']);

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getWallet(),
      getTransactions({ limit: 5, offset: 0 }),
    ])
      .then(([walletRes, txRes]) => {
        setWallet(walletRes.data);
        setTransactions(txRes.data?.transactions || []);
      })
      .catch((err) => setError(err.message || 'Failed to load wallet'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading wallet...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  const rates = wallet?.rates || {};

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 My Wallet</h1>

      <div className={styles.balanceSection}>
        <TCBalance tcBalance={wallet?.tc_balance ?? 0} rates={rates} />
        <WalletCode walletCode={wallet?.wallet_code} />
      </div>

      <div className={styles.actions}>
        <Link to="/wallet/topup" className={styles.actionBtn}>
          <span className={styles.actionIcon}>⬆️</span>
          <span>Top Up</span>
        </Link>
        <Link to="/wallet/withdraw" className={styles.actionBtn}>
          <span className={styles.actionIcon}>⬇️</span>
          <span>Withdraw</span>
        </Link>
        <Link to="/wallet/transfer" className={styles.actionBtn}>
          <span className={styles.actionIcon}>📤</span>
          <span>Transfer</span>
        </Link>
        <Link to="/wallet/transactions" className={styles.actionBtn}>
          <span className={styles.actionIcon}>📋</span>
          <span>History</span>
        </Link>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Transactions</h2>
          <Link to="/wallet/transactions" className={styles.viewAll}>View all →</Link>
        </div>
        {transactions.length === 0 ? (
          <div className={styles.empty}>
            <p>No transactions yet</p>
            <small>Your wallet activity will appear here</small>
          </div>
        ) : (
          <div className={styles.txList}>
            {transactions.map((tx) => (
              <div key={tx.id} className={styles.txItem}>
                <div className={styles.txIcon}>{TX_ICONS[tx.type] || '💱'}</div>
                <div className={styles.txInfo}>
                  <div className={styles.txType}>{TX_LABELS[tx.type] || tx.type}</div>
                  <div className={styles.txMeta}>
                    {tx.counterparty_name && <span>{tx.counterparty_name} · </span>}
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={styles.txRight}>
                  <div className={`${styles.txAmount} ${CREDIT_TYPES.has(tx.type) ? styles.credit : styles.debit}`}>
                    {CREDIT_TYPES.has(tx.type) ? '+' : '-'}{Number(tx.tc_amount).toFixed(4)} TC
                  </div>
                  <div className={styles.txXaf}>
                    {Number(tx.xaf_amount || tx.tc_amount * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
