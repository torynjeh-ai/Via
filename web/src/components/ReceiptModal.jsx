import React from 'react';
import styles from './ReceiptModal.module.css';

const formatMethod = (m) => ({ mtn_momo: 'MTN Mobile Money', orange_money: 'Orange Money' }[m] || m);

export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const isContribution = receipt.receipt_type === 'contribution';
  const amount = isContribution ? receipt.payment?.amount : receipt.payout?.amount;
  const date = new Date(receipt.issued_at).toLocaleString();

  const handlePrint = () => window.print();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>Via</div>
          <div className={styles.badge}>
            {isContribution ? '💳 Contribution Receipt' : '💰 Payout Receipt'}
          </div>
        </div>

        {/* Status banner */}
        <div className={`${styles.statusBanner} ${receipt.status === 'completed' ? styles.success : styles.pending}`}>
          <span className={styles.statusIcon}>{receipt.status === 'completed' ? '✅' : '⏳'}</span>
          <span>{receipt.status === 'completed' ? 'Payment Confirmed' : receipt.status}</span>
        </div>

        {/* Amount */}
        <div className={styles.amountSection}>
          <div className={styles.amountLabel}>{isContribution ? 'Amount Paid' : 'Amount Received'}</div>
          <div className={styles.amount}>{Number(amount).toLocaleString()} XAF</div>
        </div>

        {/* Details */}
        <div className={styles.details}>
          <Row label="Receipt No." value={receipt.receipt_number} mono />
          {receipt.transaction_id && <Row label="Transaction ID" value={receipt.transaction_id} mono />}
          <Row label="Date" value={date} />
          <Row label="Member" value={receipt.member.name} />
          <Row label="Phone" value={receipt.member.phone} />
          <Row label="Group" value={receipt.group.name} />
          <Row label="Cycle" value={receipt.group.cycle} capitalize />
          {isContribution && (
            <>
              <Row label="Payment Method" value={receipt.payment.method} />
              <Row label="Cycle Number" value={`#${receipt.payment.cycle_number}`} />
            </>
          )}
          {!isContribution && (
            <>
              <Row label="Queue Position" value={`#${receipt.payout.position}`} />
              {receipt.payout.payout_date && (
                <Row label="Payout Date" value={new Date(receipt.payout.payout_date).toLocaleDateString()} />
              )}
              <Row label="Members in Group" value={receipt.group.member_count} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p>Thank you for using Via 🙏</p>
          <p className={styles.footerSub}>Keep this receipt for your records.</p>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.printBtn} onClick={handlePrint}>🖨️ Print</button>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, capitalize }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={`${styles.rowValue} ${mono ? styles.mono : ''} ${capitalize ? styles.capitalize : ''}`}>
        {value}
      </span>
    </div>
  );
}
