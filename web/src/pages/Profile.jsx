import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateMe, updateProfilePicture } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, setUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [pictureLoading, setPictureLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const res = await updateMe({ name });
      setUser(res.data);
      setMsg(t('profileUpdated'));
    } catch (err) { setMsg(err.message || t('updateFailed')); }
    finally { setLoading(false); }
  };

  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMsg('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMsg('Image size must be less than 5MB');
      return;
    }

    setPictureLoading(true);
    setMsg('');

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64String = event.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
          const res = await updateProfilePicture({ 
            profile_picture: base64String 
          });
          setUser(res.data);
          setMsg('Profile picture updated successfully');
        } catch (err) {
          setMsg(err.message || 'Failed to update profile picture');
        } finally {
          setPictureLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setMsg('Failed to process image');
      setPictureLoading(false);
    }
  };

  const handleSignOut = () => { signOut(); navigate('/login'); };

  return (
    <div className={styles.container}>
      <div className={styles.heroCard}>
        <div className={styles.avatarContainer}>
          {user?.profile_picture_url ? (
            <img 
              src={user.profile_picture_url} 
              alt="Profile" 
              className={styles.profileImage}
              onClick={handleProfilePictureClick}
            />
          ) : (
            <div className={styles.avatar} onClick={handleProfilePictureClick}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.phone}</p>
        </div>
      </div>
      <div className={styles.card}>
        <h3>{t('editProfile')}</h3>
        {msg && <div className={styles.msg}>{msg}</div>}
        <form onSubmit={handleUpdate}>
          <div className={styles.field}>
            <label>{t('fullName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <button type="submit" className={styles.btn} disabled={loading}>{loading ? t('saving') : t('saveChanges')}</button>
        </form>
      </div>
      <div className={styles.card}>
        <h3>{t('accountInfo')}</h3>
        <div className={styles.info}><span>{t('role')}</span><span className={styles.val}>{user?.role}</span></div>
        <div className={styles.info}><span>{t('verified')}</span><span className={styles.val}>{user?.is_verified ? t('yes') : t('no')}</span></div>
        <div className={styles.info}><span>{t('phone')}</span><span className={styles.val}>{user?.phone}</span></div>
      </div>
      <button className={styles.signOut} onClick={handleSignOut}>{t('signOut')}</button>
    </div>
  );
}