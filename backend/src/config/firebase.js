const admin = require('firebase-admin');

let initialized = false;

const initializeFirebase = () => {
  if (initialized) return;
  const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('[Firebase] Missing credentials — push notifications disabled');
    return;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: FIREBASE_CLIENT_EMAIL,
    }),
  });
  initialized = true;
};

module.exports = { admin, initializeFirebase };
