import { useState } from 'react';
import styles from './TCBalance.module.css';

const CURRENCIES = ['XAF', 'USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES'];

const CURRENCY_SYMBOLS = {
  XAF: 'XAF', USD: '$', EUR: '€', GBP: '£', NGN: '₦', GHS: 'GH₵', KES: 'KSh',
};

export default function TCBalance({ tcBalance = 0, rates = {}, preferredCurrency = 'XAF' }) {
  // Start on the user's preferred currency
  const prefIdx = CURRENCIES.indexOf(preferredCurrency);
  const [currencyIdx, setCurrencyIdx] = useState(prefIdx >= 0 ? prefIdx : 0);

  const currentCurrency = CURRENCIES[currencyIdx];
  const symbol = CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;

  // Calculate display amount in current currency
  let displayAmount;
  if (currentCurrency === 'XAF') {
    const xafRate = rates.XAF ?? 10000;
    displayAmount = (tcBalance * xafRate).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else {
    const rate = rates[currentCurrency];
    displayAmount = rate != null
      ? (tcBalance * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : '—';
  }

  const handleToggle = () => setCurrencyIdx(i => (i + 1) % CURRENCIES.length);

  return (
    <div className={styles.container}>
      {rates.stale && (
        <div className={styles.staleWarning}>⚠️ Rates may be outdated</div>
      )}

      {/* Primary: user's currency — large */}
      <div className={styles.primaryAmount}>
        <span className={styles.primarySymbol}>{symbol}</span>
        <span className={styles.primaryValue}>{displayAmount}</span>
      </div>

      {/* Secondary: TC balance — smaller, below */}
      <div className={styles.tcAmount}>
        <span className={styles.tcValue}>{Number(tcBalance).toFixed(4)}</span>
        <span className={styles.tcLabel}>TC</span>
      </div>

      {/* Currency toggle */}
      <button className={styles.currencyToggle} onClick={handleToggle} type="button">
        <span>Switch currency</span>
        <span className={styles.toggleHint}>↻</span>
      </button>
    </div>
  );
}
