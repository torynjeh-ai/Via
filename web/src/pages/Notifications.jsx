import React, { useEffect, useState } from 'react';
import { getNotifications, markRead } from '../api/users';
import { formatDateTime } from '../utils/dateFormat';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import styles from './Notifications.module.css';

const TYPE_ICON = {
  contribution: '💳',
  group_update: '👥',
  payout:       '💰',
  transfer:     '📤',
  savings:      '🏦',
};

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications().then(r => setNotifications(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRead = async (id) => {
    await markRead(id);
    setNotifications(n => n.map(item => item.id === id ? { ...item, is_read: true } : item));
  };

  const handleClick = (n) => {
    if (!n.is_read) handleRead(n.id);
    // Navigate to relevant group if notification has group_id
    if (n.group_id) navigate(`/groups/${n.group_id}`);
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
            <div
              key={n.id}
              className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
              onClick={() => handleClick(n)}
            >
              <div className={styles.iconWrap}>
                <span className={styles.typeIcon}>{TYPE_ICON[n.type] || '🔔'}</span>
                <div className={styles.dot} style={{ background: n.is_read ? '#E5E7EB' : 'var(--primary)' }} />
              </div>
              <div className={styles.content}>
                <div className={styles.title}>{n.title}</div>
                <div className={styles.message}>{n.message}</div>
                <div className={styles.meta}>
                  <span className={styles.time}>{formatDateTime(n.created_at)}</span>
                  {n.group_id && (
                    <span className={styles.groupTag}>👥 View Group →</span>
                  )}
                </div>
              </div>
              {!n.is_read && (
                <button
                  className={styles.readBtn}
                  onClick={e => { e.stopPropagation(); handleRead(n.id); }}
                >
                  {t('markRead')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
