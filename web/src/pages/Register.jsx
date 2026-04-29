import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';
import { useLanguage } from '../context/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import LanguagePicker from '../components/LanguagePicker';
import styles from './Auth.module.css';

export default function Register() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await register({ name, phone, password });
      navigate('/verify-otp', { state: { phone } });
    } catch (err) { setError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <div className={styles.logo}>Via</div>
          <LanguagePicker compact />
        </div>
        <h1 className={styles.title}>{t('createAccount')}</h1>
        <p className={styles.subtitle}>{t('registerSubtitle')}</p>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>{t('fullName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <PhoneInput label={t('phoneNumber')} value={phone} onChange={setPhone} required />
          <div className={styles.field}>
            <label>{t('passwordOptional')}</label>
            <input type="password" placeholder={t('passwordHint')} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className={styles.btn} disabled={loading}>
            {loading ? t('registering') : t('register')}
          </button>
        </form>
        <p className={styles.switch}>{t('alreadyHaveAccount')} <Link to="/login">{t('signIn')}</Link></p>
      </div>
    </div>
  );
}
