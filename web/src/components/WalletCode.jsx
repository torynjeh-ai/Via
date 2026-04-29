import React, { useState } from 'react';
import styles from './WalletCode.module.css';

export default function WalletCode({ walletCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!walletCode) return;
    try {
      await navigator.clipboard.writeText(walletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className={styles.container}>
      <span className={styles.label}>Wallet Code</span>
      <div className={styles.codeRow}>
        <span className={styles.code}>{walletCode || '—'}</span>
        <button
          className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
          type="button"
          disabled={!walletCode}
          aria-label="Copy wallet code"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      <p className={styles.hint}>Share this code so others can send you TC</p>
    </div>
  );
}
