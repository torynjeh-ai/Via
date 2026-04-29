const { admin, initializeFirebase } = require('../config/firebase');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const sendPushNotification = async ({ fcmToken, title, body, data = {} }) => {
  try {
    initializeFirebase();
    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      token: fcmToken,
    };
    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    logger.error(`Push notification failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};

const sendNotificationToUser = async ({ userId, title, message, type, groupId = null }) => {
  // Store in DB
  await query(
    'INSERT INTO notifications (user_id, group_id, title, message, type) VALUES ($1, $2, $3, $4, $5)',
    [userId, groupId, title, message, type]
  );

  // Get FCM token
  const userResult = await query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  if (user?.fcm_token) {
    await sendPushNotification({
      fcmToken: user.fcm_token,
      title,
      body: message,
      data: { type, groupId: groupId || '' },
    });
  }
};

const sendBulkNotifications = async (notifications) => {
  const promises = notifications.map(n => sendNotificationToUser(n));
  return Promise.allSettled(promises);
};

module.exports = { sendPushNotification, sendNotificationToUser, sendBulkNotifications };
