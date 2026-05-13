import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSavingsGoals, getSavingsGoal, depositToGoal, withdrawFromGoal, deleteSavingsGoal } from '../api/savings';
import { getSavingsReceipt } from '../api/receipts';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import styles from './Savings.module.css';

const CATEGORY_ICONS = {
  General: '💰', Education: '📚', Health: '🏥', Travel: '✈️',
  Business: '💼', Emergency: '🚨', Housing: '🏠', Technology: '💻', Other: '🎯',
};

const PAYMENT_METHODS = [
  { value: 'tc_wallet',    label: '💎 TC Wallet' },
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer',label: '🏦 Bank Transfer' },
  { value: 'card',         label: '💳 Card' },
  { value: 'apple_pay',    label: '🍎 Apple Pay' },
  { value: 'paypal',       label: '🅿️ PayPal' },
];

const WITHDRAWAL_METHODS = [
  { value: 'tc_wallet',    label: '💎 TC Wallet (instant)' },
  { value: 'mtn_momo',     label: '📱 MTN Mobile Money' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer',label: '🏦 Bank Transfer' },
  { value: 'card',         label: '💳 Card' },
  { value: 'apple_pay',    label: '🍎 Apple Pay' },
  { value: 'paypal',       label: '🅿️ PayPal' },
];
// ── Goal Detail Modal ──────────────────────────────────────────────────────
function GoalDetailModal({ goalId, onClose, onDeposit, onWithdraw, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSavingsGoal(goalId)
      .then(r => setDetail(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [goalId]);

  if (!detail && loading) return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p style={{ padding: 24, color: 'var(--text-sub)' }}>Loading...</p>
      </div>
    </div>
  );
  if (!detail) return null;

  const icon       = CATEGORY_ICONS[detail.category] || '💰';
  const pct        = detail.target_amount > 0 ? Math.round((detail.saved_amount / detail.target_amount) * 100) : 0;
  const remaining  = Math.max(0, detail.target_amount - detail.saved_amount);
  const daysLeft   = Math.ceil((new Date(detail.target_date) - new Date()) / (1000 * 60 * 60 * 24));
  const isComplete  = detail.status === 'completed';
  const isWithdrawn = detail.status === 'withdrawn';

  const statusLabel = isComplete ? '✓ Completed' : isWithdrawn ? 'Withdrawn' : 'Active';
  const statusColor = isComplete ? 'var(--success)' : isWithdrawn ? 'var(--text-muted)' : 'var(--primary)';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 36 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{detail.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{detail.category}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor,
            background: 'var(--bg-subtle)', padding: '3px 10px', borderRadius: 20 }}>
            {statusLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(detail.saved_amount).toLocaleString()} XAF saved</span>
            <span style={{ color: 'var(--text-sub)' }}>{Number(detail.target_amount).toLocaleString()} XAF target</span>
          </div>
          <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pct)}%`,
              background: isComplete ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), var(--success))',
              borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
            <span>{pct}% complete</span>
            {!isComplete && !isWithdrawn && <span>{remaining.toLocaleString()} XAF to go</span>}
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>
          {[
            { label: 'Target Date',   value: formatDate(detail.target_date) },
            { label: 'Created',       value: formatDateTime(detail.created_at) },
            { label: 'Days Left',     value: isComplete || isWithdrawn ? '—' : daysLeft > 0 ? `${daysLeft} days` : 'Overdue' },
            { label: 'Status',        value: statusLabel },
            detail.completed_at && { label: 'Completed On', value: formatDateTime(detail.completed_at) },
            detail.withdrawn_at && { label: 'Withdrawn On', value: formatDateTime(detail.withdrawn_at) },
            detail.bonus_earned > 0 && { label: '🎁 Bonus Earned', value: `${Number(detail.bonus_earned).toLocaleString()} XAF` },
            detail.auto_save_enabled && { label: 'Auto-Save',  value: `${Number(detail.auto_save_amount).toLocaleString()} XAF / ${detail.auto_save_frequency}` },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Deposit history */}
        {detail.deposits?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Deposit History ({detail.deposits.length})
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {detail.deposits.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 13, padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>+{Number(d.amount_xaf).toLocaleString()} XAF</span>
                  <span style={{ color: 'var(--text-muted)' }}>{d.payment_method?.replace('_', ' ')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatDate(d.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.modalBtns}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
          {!isComplete && !isWithdrawn && (
            <button className={styles.confirmBtn} onClick={() => { onClose(); onDeposit(detail); }}>
              + Deposit
            </button>
          )}
        </div>

        {/* Withdraw / Delete links */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center' }}>
          {!isComplete && !isWithdrawn && Number(detail.saved_amount) > 0 && (
            <button style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13,
              fontWeight: 600, cursor: 'pointer' }}
              onClick={() => { onClose(); onWithdraw(detail); }}>
              Withdraw (2% fee)
            </button>
          )}
          {Number(detail.saved_amount) === 0 && !isComplete && (
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13,
              cursor: 'pointer' }}
              onClick={() => { onClose(); onDelete(detail.id); }}>
              Delete Goal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal, onDeposit, onWithdraw, onDelete, onViewDetail }) {
  const pct       = goal.target_amount > 0 ? Math.round((goal.saved_amount / goal.target_amount) * 100) : 0;
  const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
  const daysLeft  = Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24));
  const isComplete = goal.status === 'completed';
  const isWithdrawn = goal.status === 'withdrawn';
  const icon = CATEGORY_ICONS[goal.category] || '💰';

  return (
    <div className={`${styles.goalCard} ${isComplete ? styles.goalComplete : isWithdrawn ? styles.goalWithdrawn : ''}`}
      onClick={onViewDetail} style={{ cursor: 'pointer' }}>
      <div className={styles.goalHeader}>
        <div className={styles.goalIcon}>{icon}</div>
        <div className={styles.goalInfo}>
          <div className={styles.goalName}>{goal.name}</div>
          <div className={styles.goalCategory}>{goal.category}</div>
        </div>
        <div className={styles.goalStatus}>
          {isComplete  && <span className={styles.badgeComplete}>✓ Complete</span>}
          {isWithdrawn && <span className={styles.badgeWithdrawn}>Withdrawn</span>}
          {!isComplete && !isWithdrawn && daysLeft > 0 && (
            <span className={styles.daysLeft}>{daysLeft}d left</span>
          )}
          {!isComplete && !isWithdrawn && daysLeft <= 0 && (
            <span className={styles.overdue}>Overdue</span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className={styles.amounts}>
        <span className={styles.saved}>{Number(goal.saved_amount).toLocaleString()} XAF</span>
        <span className={styles.target}>{Number(goal.target_amount).toLocaleString()} XAF</span>
      </div>
      <div className={styles.barWrap}>
        <div
          className={`${styles.bar} ${isComplete ? styles.barDone : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className={styles.barFooter}>
        <span className={styles.pct}>{pct}%</span>
        <span className={styles.deadline}>Due: {formatDate(goal.target_date)}</span>
      </div>

      {!isComplete && !isWithdrawn && (
        <p className={styles.remaining}>
          {remaining > 0
            ? `${remaining.toLocaleString()} XAF to go — keep saving!`
            : '🎉 Target reached!'}
        </p>
      )}

      {goal.bonus_earned > 0 && (
        <p className={styles.bonus}>🎁 Bonus earned: {Number(goal.bonus_earned).toLocaleString()} XAF</p>
      )}

      {/* Actions */}
      {!isComplete && !isWithdrawn && (
        <div className={styles.goalActions}>
          <button className={styles.depositBtn} onClick={e => { e.stopPropagation(); onDeposit(goal); }}>+ Deposit</button>
          {Number(goal.saved_amount) > 0 && (
            <button className={styles.withdrawBtn} onClick={e => { e.stopPropagation(); onWithdraw(goal); }}>
              Withdraw (2% fee)
            </button>
          )}
        </div>
      )}
      {Number(goal.saved_amount) === 0 && !isComplete && (
        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(goal.id); }}>Delete</button>
      )}
    </div>
  );
}

function DepositModal({ goal, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState('tc_wallet');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const remaining = Math.max(0, goal.target_amount - goal.saved_amount);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await depositToGoal(goal.id, { amount_xaf: Number(amount), payment_method: method });
      onSuccess(res.message, res.data?.deposit_id);
    } catch (err) { setError(err.message || 'Deposit failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>Deposit to "{goal.name}"</h3>
        <p className={styles.modalHint}>{remaining.toLocaleString()} XAF remaining to reach your goal</p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalField}>
            <label>Amount (XAF)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000" min="1" max={remaining} required />
          </div>
          <div className={styles.modalField}>
            <label>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className={styles.modalBtns}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.confirmBtn} disabled={loading}>
              {loading ? 'Processing...' : `Deposit ${amount ? Number(amount).toLocaleString() + ' XAF' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Savings() {
  const navigate = useNavigate();
  const [goals, setGoals]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [depositGoal, setDepositGoal] = useState(null);
  const [detailGoalId, setDetailGoalId] = useState(null);
  const [msg, setMsg]               = useState('');
  const [lastReceiptId, setLastReceiptId] = useState(null);

  const load = () => {
    getSavingsGoals().then(r => setGoals(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleWithdraw = async (goal) => {
    if (!window.confirm(
      `Withdraw ${Number(goal.saved_amount).toLocaleString()} XAF from "${goal.name}"?\n\n` +
      `A 2% early withdrawal fee (${Math.round(goal.saved_amount * 0.02).toLocaleString()} XAF) will be deducted.\n` +
      `Any completion bonus will be forfeited.`
    )) return;
    try {
      const res = await withdrawFromGoal(goal.id);
      setMsg(res.message); load();
    } catch (err) { setMsg(err.message || 'Withdrawal failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try { await deleteSavingsGoal(id); load(); } catch (err) { setMsg(err.message); }
  };

  const handleDepositSuccess = (message, depositId) => {
    setMsg(message);
    setLastReceiptId(depositId || null);
    setDepositGoal(null);
    load();
    setTimeout(() => { setMsg(''); setLastReceiptId(null); }, 6000);
  };

  const active    = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const withdrawn = goals.filter(g => g.status === 'withdrawn');

  const totalSaved  = active.reduce((s, g) => s + Number(g.saved_amount),  0);
  const totalTarget = active.reduce((s, g) => s + Number(g.target_amount), 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>💰 My Savings</h1>
          <p>Set goals, save consistently, earn bonuses</p>
        </div>
        <Link to="/savings/new" className={styles.newBtn}>+ New Goal</Link>
      </div>

      {msg && (
        <div className={styles.msg}>
          {msg}
          {lastReceiptId && (
            <Link to="/receipts" className={styles.receiptLink}>🧾 View Receipt</Link>
          )}
        </div>
      )}

      {/* Summary */}
      {active.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryNum}>{active.length}</div>
            <div className={styles.summaryLabel}>Active Goals</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryNum}>{totalSaved.toLocaleString()}</div>
            <div className={styles.summaryLabel}>Total Saved (XAF)</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryNum}>{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</div>
            <div className={styles.summaryLabel}>Overall Progress</div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : goals.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <p>No savings goals yet</p>
          <small>Create your first goal and start saving today</small>
          <Link to="/savings/new" className={styles.newBtn} style={{ marginTop: 16 }}>Create a Goal</Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className={styles.section}>
              <h2>Active Goals</h2>
              <div className={styles.grid}>
                {active.map(g => (
                  <GoalCard key={g.id} goal={g}
                    onDeposit={setDepositGoal}
                    onWithdraw={handleWithdraw}
                    onDelete={handleDelete}
                    onViewDetail={() => setDetailGoalId(g.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div className={styles.section}>
              <h2>Completed Goals 🎉</h2>
              <div className={styles.grid}>
                {completed.map(g => <GoalCard key={g.id} goal={g} onDeposit={() => {}} onWithdraw={() => {}} onDelete={() => {}} onViewDetail={() => setDetailGoalId(g.id)} />)}
              </div>
            </div>
          )}
          {withdrawn.length > 0 && (
            <div className={styles.section}>
              <h2>Withdrawn</h2>
              <div className={styles.grid}>
                {withdrawn.map(g => <GoalCard key={g.id} goal={g} onDeposit={() => {}} onWithdraw={() => {}} onDelete={() => {}} onViewDetail={() => setDetailGoalId(g.id)} />)}
              </div>
            </div>
          )}
        </>
      )}

      {depositGoal && (
        <DepositModal
          goal={depositGoal}
          onClose={() => setDepositGoal(null)}
          onSuccess={handleDepositSuccess}
        />
      )}

      {detailGoalId && (
        <GoalDetailModal
          goalId={detailGoalId}
          onClose={() => setDetailGoalId(null)}
          onDeposit={(goal) => { setDetailGoalId(null); setDepositGoal(goal); }}
          onWithdraw={(goal) => { setDetailGoalId(null); handleWithdraw(goal); }}
          onDelete={(id) => { setDetailGoalId(null); handleDelete(id); }}
        />
      )}
    </div>
  );
}
