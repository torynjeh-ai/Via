import React, { useState } from 'react';
import styles from './TCBalance.module.css';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES'];

const CURRENCY_SYMBOLS = {
  XAF: 'XAF', USD: '$', EUR: '€', GBP: '£', NGN: '₦', GHS: 'GH₵', KES: 'KSh',
};

export default function TCBalance({ tcBalance = 0, rates = {} }) {
  const [currencyIdx, setCurrencyIdx] = useState(0);

  const xafAmount = rates.XAF != null
    ? (tcBalance * rates.XAF).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : (tcBalance * 10000).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const currentCurrency = CURRENCIES[currencyIdx];
  const currentRate = rates[currentCurrency];
  const currentAmount = currentRate != null
    ? (tcBalance * currentRate).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '—';

  const handleToggle = () => {
    setCurrencyIdx((prev) => (prev + 1) % CURRENCIES.length);
  };

  return (
    <div className={styles.container}>
      {rates.stale && (
        <div className={styles.staleWarning}>⚠️ Rates may be outdated</div>
      )}
      <div className={styles.tcAmount}>
        <span className={styles.tcValue}>{Number(tcBalance).toFixed(2)}</span>
        <span className={styles.tcLabel}>TC</span>
      </div>
      <div className={styles.xafAmount}>
        ≈ {xafAmount} XAF
      </div>
      <button className={styles.currencyToggle} onClick={handleToggle} type="button">
        <span className={styles.currencySymbol}>{CURRENCY_SYMBOLS[currentCurrency]}</span>
        <span className={styles.currencyAmount}>{currentAmount}</span>
        <span className={styles.toggleHint}>↻</span>
      </button>
    </div>
  );
}
