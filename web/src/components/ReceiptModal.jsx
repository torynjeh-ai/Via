import React from 'react';
import { formatDateTime } from '../utils/dateFormat';
import ViaLogo from './ViaLogo';
import styles from './ReceiptModal.module.css';

const TYPE_LABELS = {
  contribution:       { title: '💳 Contribution Receipt',        amountLabel: 'Amount Paid' },
  payout:             { title: '💰 Payout Receipt',              amountLabel: 'Amount Received' },
  top_up:             { title: '⬆️ Deposit Receipt',             amountLabel: 'Amount Deposited' },
  withdrawal:         { title: '⬇️ Withdrawal Receipt',          amountLabel: 'Amount Withdrawn' },
  transfer_out:       { title: '📤 Transfer Sent Receipt',       amountLabel: 'Amount Sent' },
  transfer_in:        { title: '📥 Transfer Received Receipt',   amountLabel: 'Amount Received' },
  savings_deposit:    { title: '🏦 Savings Deposit Receipt',     amountLabel: 'Amount Deposited' },
  savings_withdrawal: { title: '🏧 Savings Withdrawal Receipt',  amountLabel: 'Net Amount Received' },
};

export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const type   = receipt.receipt_type;
  const config = TYPE_LABELS[type] || { title: '🧾 Transaction Receipt', amountLabel: 'Amount' };

  // Determine amount based on receipt type
  let amount = 0;
  if (type === 'contribution')       amount = receipt.payment?.amount_xaf || receipt.payment?.amount || 0;
  else if (type === 'payout')        amount = receipt.payout?.amount || 0;
  else if (type === 'savings_deposit')    amount = receipt.savings?.amount_xaf || 0;
  else if (type === 'savings_withdrawal') amount = receipt.savings?.net_amount_xaf || 0;
  else                               amount = receipt.payment?.amount_xaf || 0;

  const handlePrint = () => window.print();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}><ViaLogo size={48} /></div>
          <div className={styles.badge}>{config.title}</div>
        </div>

        {/* Status banner */}
        <div className={`${styles.statusBanner} ${receipt.status === 'completed' ? styles.success : styles.pending}`}>
          <span className={styles.statusIcon}>{receipt.status === 'completed' ? '✅' : '⏳'}</span>
          <span>{receipt.status === 'completed' ? 'Confirmed' : receipt.status}</span>
        </div>

        {/* Amount */}
        <div className={styles.amountSection}>
          <div className={styles.amountLabel}>{config.amountLabel}</div>
          <div className={styles.amount}>{Number(amount).toLocaleString()} XAF</div>
        </div>

        {/* Details */}
        <div className={styles.details}>
          <Row label="Receipt No."    value={receipt.receipt_number} mono />
          {receipt.transaction_id && <Row label="Transaction ID" value={receipt.transaction_id} mono />}
          <Row label="Date"           value={formatDateTime(receipt.issued_at)} />

          {/* User info */}
          {receipt.user && (
            <>
              <Row label="Name"  value={receipt.user.name} />
              <Row label="Phone" value={receipt.user.phone} />
            </>
          )}
          {receipt.member && (
            <>
              <Row label="Member" value={receipt.member.name} />
              <Row label="Phone"  value={receipt.member.phone} />
            </>
          )}

          {/* Counterparty (transfers) */}
          {receipt.counterparty && (
            <>
              <Row label={type === 'transfer_out' ? 'Sent To' : 'Received From'} value={receipt.counterparty.name} />
              <Row label="Phone" value={receipt.counterparty.phone} />
            </>
          )}

          {/* Group info (contributions/payouts) */}
          {receipt.group && (
            <>
              <Row label="Group" value={receipt.group.name} />
              <Row label="Cycle" value={receipt.group.cycle} capitalize />
            </>
          )}

          {/* Contribution-specific */}
          {type === 'contribution' && receipt.payment && (
            <>
              <Row label="Payment Method" value={receipt.payment.method} />
              <Row label="Cycle Number"   value={`#${receipt.payment.cycle_number}`} />
            </>
          )}

          {/* Payout-specific */}
          {type === 'payout' && receipt.payout && (
            <>
              <Row label="Queue Position"  value={`#${receipt.payout.position}`} />
              {receipt.payout.payout_date && (
                <Row label="Payout Date" value={formatDateTime(receipt.payout.payout_date)} />
              )}
              {receipt.group?.member_count && (
                <Row label="Members in Group" value={receipt.group.member_count} />
              )}
            </>
          )}

          {/* Wallet transaction-specific */}
          {['top_up', 'withdrawal', 'transfer_out', 'transfer_in'].includes(type) && receipt.payment && (
            <>
              <Row label="Payment Method" value={receipt.payment.method} />
              {receipt.payment.fee_xaf > 0 && (
                <>
                  <Row label="Fee"        value={`${Number(receipt.payment.fee_xaf).toLocaleString()} XAF`} />
                  <Row label="Net Amount" value={`${Number(receipt.payment.net_xaf).toLocaleString()} XAF`} />
                </>
              )}
            </>
          )}

          {/* Savings deposit-specific */}
          {type === 'savings_deposit' && receipt.savings && (
            <>
              <Row label="Goal"           value={receipt.savings.goal_name} />
              <Row label="Category"       value={receipt.savings.category} />
              <Row label="Payment Method" value={receipt.savings.method} />
              <Row label="Total Saved"    value={`${Number(receipt.savings.saved_amount).toLocaleString()} XAF`} />
              <Row label="Target"         value={`${Number(receipt.savings.target_amount).toLocaleString()} XAF`} />
              <Row label="Goal Status"    value={receipt.savings.goal_status} capitalize />
            </>
          )}

          {/* Savings withdrawal-specific */}
          {type === 'savings_withdrawal' && receipt.savings && (
            <>
              <Row label="Goal"           value={receipt.savings.goal_name} />
              <Row label="Category"       value={receipt.savings.category} />
              <Row label="Withdrawal To"  value={receipt.savings.method} />
              <Row label="Gross Amount"   value={`${Number(receipt.savings.gross_amount_xaf).toLocaleString()} XAF`} />
              <Row label="2% Fee"         value={`-${Number(receipt.savings.fee_xaf).toLocaleString()} XAF`} />
              <Row label="Net Received"   value={`${Number(receipt.savings.net_amount_xaf).toLocaleString()} XAF`} />
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
