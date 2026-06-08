import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contribute, getContributionInfo, confirmContribution } from '../api/groups';
import { getContributionReceipt } from '../api/receipts';
import { useLanguage } from '../context/LanguageContext';
import ReceiptModal from '../components/ReceiptModal';
import styles from './Contribute.module.css';

const METHODS = [
  { key: 'mtn_momo',     label: 'MTN Mobile Money', color: '#FFCC00', bg: '#FFFBEB', available: true },
  { key: 'orange_money', label: 'Orange Money',      color: '#FF6600', bg: '#FFF7ED', available: true },
  { key: 'tc_wallet',    label: 'TC Wallet',         color: '#6C63FF', bg: '#F0EEFF', available: true },
  { key: 'card',         label: '💳 Card (Stripe)',  color: '#6b7280', bg: '#f9fafb', available: false },
];

export default function Contribute() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [method, setMethod]           = useState('mtn_momo');
  const [loading, setLoading]         = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);
  const [error, setError]             = useState('');
  const [receipt, setReceipt]         = useState(null);
  const [info, setInfo]               = useState(null);

  // Fapshi pending state
  const [pendingData, setPendingData] = useState(null); // { contributionId, transId }
  const [paymentLink, setPaymentLink] = useState(null); // Fapshi iframe link
  const [pollStatus, setPollStatus]   = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    getContributionInfo(id)
      .then(r => setInfo(r.data))
      .catch(() => setInfo({ contribution_amount: state?.amount || 0, is_late: false, penalty_amount: 0, total_due: state?.amount || 0 }))
      .finally(() => setInfoLoading(false));
  }, [id]);

  // Poll for Fapshi confirmation
  useEffect(() => {
    if (!pendingData) return;

    let attempts = 0;
    const MAX = 24;

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await confirmContribution(id, {
          contributionId: pendingData.contributionId,
          transId: pendingData.transId,
        });

        const { status } = res.data || {};

        if (res.success && (!status || status === 'completed')) {
          clearInterval(pollRef.current);
          setPendingData(null);
          setPaymentLink(null);
          setPollStatus('');
          setLoading(false);
          // Fetch receipt
          try {
            const receiptRes = await getContributionReceipt(pendingData.contributionId);
            setReceipt(receiptRes.data);
          } catch {
            navigate(`/groups/${id}`);
          }
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          clearInterval(pollRef.current);
          setPendingData(null);
          setPaymentLink(null);
          setPollStatus('');
          setError(status === 'FAILED' ? 'Payment was declined.' : 'Payment request expired.');
          setLoading(false);
        } else {
          setPollStatus(status === 'PENDING' ? 'Waiting for your approval…' : 'Sending payment request…');
        }
      } catch (err) {
        if (err.message && (err.message.includes('declined') || err.message.includes('expired'))) {
          clearInterval(pollRef.current);
          setPendingData(null);
          setPollStatus('');
          setError(err.message);
          setLoading(false);
        }
      }

      if (attempts >= MAX) {
        clearInterval(pollRef.current);
        setPendingData(null);
        setPaymentLink(null);
        setPollStatus('');
        setError('Payment timed out. Please check your phone and try again.');
        setLoading(false);
      }
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [pendingData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await contribute(id, { payment_method: method });

      if (res.data?.pending && res.data?.transId) {
        // Fapshi — show payment iframe
        if (res.data.link) setPaymentLink(res.data.link);
        setPendingData({ contributionId: res.data.contributionId, transId: res.data.transId });
        setPollStatus('Waiting for payment…');
      } else {
        // TC wallet — immediate
        const receiptRes = await getContributionReceipt(res.data.contributionId);
        setReceipt(receiptRes.data);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || t('paymentFailed'));
      setLoading(false);
    }
  };

  const handleReceiptClose = () => { setReceipt(null); navigate(`/groups/${id}`); };

  if (infoLoading) return <div className={styles.container}><p>{t('loading')}</p></div>;

  const totalDue      = info?.total_due || 0;
  const isLate        = info?.is_late || false;
  const penaltyAmount = info?.penalty_amount || 0;
  const baseAmount    = info?.contribution_amount || 0;

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(-1)}>{t('back')}</button>
      <h1>{t('makeContribution')}</h1>

      <div className={`${styles.amountCard} ${isLate ? styles.amountCardLate : ''}`}>
        <p>{t('amountToPay')}</p>
        <h2>{Number(totalDue).toLocaleString()} XAF</h2>
        {isLate && (
          <div className={styles.penaltyBreakdown}>
            <div className={styles.penaltyRow}><span>Contribution</span><span>{Number(baseAmount).toLocaleString()} XAF</span></div>
            <div className={`${styles.penaltyRow} ${styles.penaltyLine}`}><span>⚠️ Late penalty</span><span>+ {Number(penaltyAmount).toLocaleString()} XAF</span></div>
            <div className={`${styles.penaltyRow} ${styles.penaltyTotal}`}><span>Total due</span><span>{Number(totalDue).toLocaleString()} XAF</span></div>
          </div>
        )}
      </div>

      {isLate && (
        <div className={styles.lateWarning}>
          ⚠️ Your payment is past the deadline. A penalty of <strong>{Number(penaltyAmount).toLocaleString()} XAF</strong> has been added.
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {/* Fapshi pending state */}
      {pendingData && (
        <div style={{ background:'#eff6ff', border:'1.5px solid #3b82f6', borderRadius:10, padding:'14px 16px', marginBottom:16, display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ width:20, height:20, border:'3px solid #bfdbfe', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0, marginTop:2 }} />
          <div>
            <strong style={{ color:'#1d4ed8', display:'block', marginBottom:4 }}>{pollStatus || 'Waiting for payment…'}</strong>
            <p style={{ fontSize:13, color:'#1e40af', margin:0 }}>Complete the payment on the Fapshi page that opened. This page updates automatically.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <h3>{t('selectPaymentMethod')}</h3>
        <div className={styles.methods}>
          {METHODS.map(m => (
            <div key={m.key}
              className={`${styles.method} ${method === m.key && m.available ? styles.selected : ''}`}
              style={{
                borderColor: method === m.key && m.available ? m.color : 'var(--border)',
                background: method === m.key && m.available ? m.bg : 'var(--bg-card)',
                opacity: m.available ? 1 : 0.5,
                cursor: m.available ? 'pointer' : 'not-allowed',
              }}
              onClick={() => {
                if (!m.available) {
                  alert('Card payments are coming soon — we are completing our Stripe business registration.');
                  return;
                }
                if (!loading) setMethod(m.key);
              }}>
              <div className={styles.dot} style={{ background: m.color }} />
              <div>
                <span>{m.label}</span>
                {!m.available && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Coming soon</div>}
              </div>
              {method === m.key && m.available && <span className={styles.check}>✓</span>}
            </div>
          ))}
        </div>
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? (pollStatus || t('processing')) : `${t('pay')} ${Number(totalDue).toLocaleString()} XAF`}
        </button>
      </form>

      {receipt && <ReceiptModal receipt={receipt} onClose={handleReceiptClose} />}

      {/* Fapshi payment iframe modal */}
      {paymentLink && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'var(--bg-card)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, height:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:15 }}>
              <span>Complete Payment</span>
              <button onClick={() => setPaymentLink(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-sub)', padding:'4px 8px' }}>✕</button>
            </div>
            {pendingData && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'#eff6ff', fontSize:13, color:'#1d4ed8' }}>
                <div style={{ width:14, height:14, border:'2px solid #bfdbfe', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                <span>{pollStatus || 'Waiting for payment…'}</span>
              </div>
            )}
            <iframe src={paymentLink} title="Fapshi Payment" style={{ flex:1, width:'100%', border:'none' }} allow="payment" />
          </div>
        </div>
      )}
    </div>
  );
}
