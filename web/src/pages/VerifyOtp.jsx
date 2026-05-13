import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyOtp } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ViaLogo from '../components/ViaLogo';
import styles from './Auth.module.css';

export default function VerifyOtp() {
  const { state } = useLocation();
  const phone = state?.phone || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await verifyOtp({ phone, code });
      signIn(res.data.token, res.data.user);
      navigate('/');
    } catch (err) { setError(err.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}><ViaLogo size={72} /></div>
        <h1 className={styles.title}>{t('verifyPhone')}</h1>
        <p className={styles.subtitle}>{t('otpSentTo')} {phone}</p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>{t('otpCode')}</label>
            <input placeholder="123456" value={code} onChange={e => setCode(e.target.value)} maxLength={6} required />
          </div>
          <button className={styles.btn} disabled={loading}>{loading ? t('verifying') : t('verify')}</button>
        </form>
        <p className={styles.switch}><Link to="/login">{t('backToLogin')}</Link></p>
      </div>
    </div>
  );
}
