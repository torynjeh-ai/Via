import React, { useEffect, useState } from 'react';
import { getNotifications, markRead } from '../api/users';
import { formatDateTime } from '../utils/dateFormat';
import { useLanguage } from '../context/LanguageContext';
import styles from './Notifications.module.css';

export default function Notifications() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications().then(r => setNotifications(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRead = async (id) => {
    await markRead(id);
    setNotifications(n => n.map(item => item.id === id ? { ...item, is_read: true } : item));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div className={styles.header}>
        <h1>{t('notificationsTitle')}</h1>
        {unread > 0 && <span className={styles.unreadBadge}>{unread} {t('unread')}</span>}
      </div>
      {loading ? <p>{t('loading')}</p> : notifications.length === 0 ? (
        <div className={styles.empty}>{t('noNotifications')}</div>
      ) : (
        <div className={styles.list}>
          {notifications.map(n => (
            <div key={n.id} className={`${styles.item} ${!n.is_read ? styles.unread : ''}`} onClick={() => !n.is_read && handleRead(n.id)}>
              <div className={styles.dot} style={{ background: n.is_read ? '#E5E7EB' : 'var(--primary)' }} />
              <div className={styles.content}>
                <div className={styles.title}>{n.title}</div>
                <div className={styles.message}>{n.message}</div>
                <div className={styles.time}>{formatDateTime(n.created_at)}</div>
              </div>
              {!n.is_read && <button className={styles.readBtn} onClick={(e) => { e.stopPropagation(); handleRead(n.id); }}>{t('markRead')}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
