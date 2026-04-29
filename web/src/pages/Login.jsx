import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import LanguagePicker from '../components/LanguagePicker';
import styles from './Auth.module.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await login({ phone, password });
      if (res.data?.token) { signIn(res.data.token, res.data.user); navigate('/'); }
      else navigate('/verify-otp', { state: { phone } });
    } catch (err) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <div className={styles.logo}>Via</div>
          <LanguagePicker compact />
        </div>
        <h1 className={styles.title}>{t('welcomeBack')}</h1>
        <p className={styles.subtitle}>{t('signInSubtitle')}</p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <PhoneInput label={t('phoneNumber')} value={phone} onChange={setPhone} required />
          <div className={styles.field}>
            <label>{t('password')}</label>
            <input type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className={styles.btn} disabled={loading}>
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>
        <p className={styles.switch}>{t('noAccount')} <Link to="/register">{t('register')}</Link></p>
      </div>
    </div>
  );
}
