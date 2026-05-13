import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { updateMe, updateProfilePicture, removeProfilePicture, getMyGroups } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import styles from './Profile.module.css';

const STATUS_LABEL = {
  approved:          { label: 'Member',           cls: 'statusApproved' },
  pending:           { label: 'Pending approval',  cls: 'statusPending' },
  pending_reconfirm: { label: 'Awaiting reconfirm', cls: 'statusPending' },
  forfeited:         { label: 'Forfeited',          cls: 'statusForfeited' },
  rejected:          { label: 'Rejected',           cls: 'statusForfeited' },
};

export default function Profile() {
  const { user, setUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [name, setName]                   = useState(user?.name || '');
  const [loading, setLoading]             = useState(false);
  const [pictureLoading, setPictureLoading] = useState(false);
  const [msg, setMsg]                     = useState('');
  const [groups, setGroups]               = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  useEffect(() => {
    getMyGroups()
      .then(r => setGroups(r.data || []))
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const res = await updateMe({ name });
      setUser(res.data);
      setMsg(t('profileUpdated'));
    } catch (err) { setMsg(err.message || t('updateFailed')); }
    finally { setLoading(false); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { setMsg('Image size must be less than 5MB'); return; }
    setPictureLoading(true); setMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await updateProfilePicture({ profile_picture: ev.target.result.split(',')[1] });
        setUser(res.data);
        setMsg('Profile picture updated successfully');
      } catch (err) { setMsg(err.message || 'Failed to update profile picture'); }
      finally { setPictureLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    setPictureLoading(true); setMsg('');
    try {
      const res = await removeProfilePicture();
      setUser(prev => ({ ...prev, profile_picture_url: null, ...res.data }));
      setMsg('Profile picture removed');
    } catch (err) { setMsg(err.message || 'Failed to remove profile picture'); }
    finally { setPictureLoading(false); }
  };

  const handleSignOut = () => { signOut(); navigate('/login'); };

  // Derived group stats
  const adminGroups  = groups.filter(g => g.my_role === 'admin');
  const memberGroups = groups.filter(g => g.my_role !== 'admin');

  return (
    <div className={styles.container}>

      {/* ── Hero card ── */}
      <div className={styles.heroCard}>
        <div className={styles.avatarContainer} onClick={() => !pictureLoading && fileInputRef.current?.click()}>
          {pictureLoading ? (
            <div className={styles.avatar}><span className={styles.avatarSpinner} /></div>
          ) : user?.profile_picture_url ? (
            <img src={user.profile_picture_url} alt="Profile" className={styles.profileImage} />
          ) : (
            <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          )}
          {!user?.profile_picture_url && !pictureLoading && (
            <div className={styles.avatarEdit}>📷</div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        <div className={styles.heroInfo}>
          <h2>{user?.name}</h2>
          <p>{user?.phone}</p>
          <div className={styles.heroBadges}>
            {/* Phone verification */}
            <span className={user?.is_verified ? styles.badgeGreen : styles.badgeRed}>
              {user?.is_verified ? '✓ Phone verified' : '✗ Phone unverified'}
            </span>
            {/* Identity verification */}
            <span className={user?.profile_complete ? styles.badgeGreen : styles.badgeOrange}>
              {user?.profile_complete ? '🛡 Identity verified' : '⚠ Identity unverified'}
            </span>
          </div>
          {user?.profile_picture_url && (
            <button className={styles.removePicBtn} onClick={handleRemovePicture} disabled={pictureLoading}>
              Remove photo
            </button>
          )}
        </div>
      </div>

      {/* ── Identity verification prompt (unverified only) ── */}
      {!user?.profile_complete && (
        <div className={styles.verifyPrompt}>
          <div className={styles.verifyPromptIcon}>🛡️</div>
          <div className={styles.verifyPromptBody}>
            <strong>Complete identity verification</strong>
            <p>You need to verify your identity before you can create groups, join, or contribute.</p>
          </div>
          <Link to="/setup-profile" className={styles.verifyPromptBtn}>Verify now →</Link>
        </div>
      )}

      {/* ── Edit name ── */}
      <div className={styles.card}>
        <h3>{t('editProfile')}</h3>
        {msg && <div className={styles.msg}>{msg}</div>}
        <form onSubmit={handleUpdate}>
          <div className={styles.field}>
            <label>{t('fullName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? t('saving') : t('saveChanges')}
          </button>
        </form>
      </div>

      {/* ── Account info ── */}
      <div className={styles.card}>
        <h3>{t('accountInfo')}</h3>

        <div className={styles.info}>
          <span>{t('phone')}</span>
          <span className={styles.val}>{user?.phone}</span>
        </div>

        <div className={styles.info}>
          <span>Phone verified</span>
          <span className={user?.is_verified ? styles.valGreen : styles.valRed}>
            {user?.is_verified ? '✓ Yes' : '✗ No'}
          </span>
        </div>

      </div>

      {/* ── Group memberships ── */}
      <div className={styles.card}>
        <h3>Group Memberships</h3>

        {groupsLoading ? (
          <p className={styles.loadingText}>Loading groups...</p>
        ) : groups.length === 0 ? (
          <div className={styles.emptyGroups}>
            <p>You're not in any groups yet.</p>
            <Link to="/groups" className={styles.browseLink}>Browse groups →</Link>
          </div>
        ) : (
          <>
            {/* Groups where user is admin */}
            {adminGroups.length > 0 && (
              <div className={styles.groupSection}>
                <div className={styles.groupSectionLabel}>Admin ({adminGroups.length})</div>
                {adminGroups.map(g => (
                  <Link to={`/groups/${g.id}`} key={g.id} className={styles.groupRow}>
                    <div className={styles.groupRowLeft}>
                      <span className={styles.groupName}>{g.name}</span>
                      <span className={styles.groupMeta}>{g.cycle} · {Number(g.contribution_amount).toLocaleString()} XAF</span>
                    </div>
                    <div className={styles.groupRowRight}>
                      <span className={styles.roleAdmin}>👑 Admin</span>
                      <span className={`${styles.groupStatus} ${styles['gs_' + g.status]}`}>{g.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Groups where user is a member */}
            {memberGroups.length > 0 && (
              <div className={styles.groupSection}>
                <div className={styles.groupSectionLabel}>Member ({memberGroups.length})</div>
                {memberGroups.map(g => {
                  const statusInfo = STATUS_LABEL[g.my_status] || { label: g.my_status, cls: 'statusPending' };
                  return (
                    <Link to={`/groups/${g.id}`} key={g.id} className={styles.groupRow}>
                      <div className={styles.groupRowLeft}>
                        <span className={styles.groupName}>{g.name}</span>
                        <span className={styles.groupMeta}>{g.cycle} · {Number(g.contribution_amount).toLocaleString()} XAF</span>
                      </div>
                      <div className={styles.groupRowRight}>
                        <span className={styles[statusInfo.cls]}>{statusInfo.label}</span>
                        <span className={`${styles.groupStatus} ${styles['gs_' + g.status]}`}>{g.status}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <button className={styles.signOut} onClick={handleSignOut}>{t('signOut')}</button>
    </div>
  );
}
