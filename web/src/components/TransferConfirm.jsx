import React from 'react';
import styles from './TransferConfirm.module.css';

export default function TransferConfirm({ preview, loading, error, onConfirm, onCancel }) {
  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}>⏳</div>
            <p>Calculating transfer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠️</div>
            <p className={styles.errorMsg}>{error}</p>
            <button className={styles.cancelBtn} onClick={onCancel} type="button">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const {
    tc_amount,
    fee_tc,
    total_deducted,
    recipient_receives,
    recipient_name,
    recipient_wallet_code,
    fiat_equivalents = {},
    preferred_currency = 'XAF',
  } = preview;

  const fiat = fiat_equivalents[preferred_currency] || fiat_equivalents.XAF || {};

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Confirm Transfer</h3>

        <div className={styles.recipient}>
          <span className={styles.recipientIcon}>👤</span>
          <div>
            <div className={styles.recipientName}>{recipient_name || 'Recipient'}</div>
            {recipient_wallet_code && (
              <div className={styles.recipientCode}>{recipient_wallet_code}</div>
            )}
          </div>
        </div>

        <div className={styles.breakdown}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>You send</span>
            <span className={styles.rowValue}>{Number(tc_amount).toFixed(4)} TC</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Transfer fee</span>
            <span className={`${styles.rowValue} ${Number(fee_tc) > 0 ? styles.fee : styles.free}`}>
              {Number(fee_tc) > 0 ? `${Number(fee_tc).toFixed(4)} TC` : 'Free'}
            </span>
          </div>
          <div className={`${styles.row} ${styles.totalRow}`}>
            <span className={styles.rowLabel}>Total deducted</span>
            <span className={styles.rowValueBold}>{Number(total_deducted).toFixed(4)} TC</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Recipient gets</span>
            <span className={`${styles.rowValue} ${styles.credit}`}>{Number(recipient_receives).toFixed(4)} TC</span>
          </div>
          {fiat.total_deducted != null && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>≈ {preferred_currency}</span>
              <span className={styles.rowValue}>
                {Number(fiat.total_deducted).toLocaleString(undefined, { maximumFractionDigits: 2 })} {preferred_currency}
              </span>
            </div>
          )}
          {fiat_equivalents.XAF?.total_deducted != null && preferred_currency !== 'XAF' && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>≈ XAF</span>
              <span className={styles.rowValue}>
                {Number(fiat_equivalents.XAF.total_deducted).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
              </span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} type="button">Cancel</button>
          <button className={styles.confirmBtn} onClick={onConfirm} type="button">Confirm Transfer</button>
        </div>
      </div>
    </div>
  );
}
