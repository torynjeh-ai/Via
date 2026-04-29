const logger = require('../utils/logger');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';

/**
 * Compare a face in a document image against a selfie.
 *
 * Currently uses a mock — returns match: true always.
 * When the Python face service is running, set FACE_SERVICE_URL in .env
 * and switch USE_MOCK to false.
 *
 * To switch to Smile Identity later, replace this function body only.
 */
const USE_MOCK = !process.env.FACE_SERVICE_URL;

const compareFaces = async (documentImageBase64, selfieBase64) => {
  if (USE_MOCK) {
    logger.info('[FaceMatch] Using mock — always returns match (Python service not running)');
    await new Promise(r => setTimeout(r, 1000));
    return { match: true, confidence: 98.7 };
  }

  try {
    const response = await fetch(`${FACE_SERVICE_URL}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_image: documentImageBase64, face_image: selfieBase64 }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Face service returned ${response.status}`);
    }

    const result = await response.json();
    logger.info(`[FaceMatch] match=${result.match} distance=${result.distance} confidence=${result.confidence}%`);
    return { match: result.match, confidence: result.confidence, reason: result.reason || null };
  } catch (error) {
    logger.error(`[FaceMatch] Service error: ${error.message}`);
    throw new Error('Face verification service is unavailable. Please try again later.');
  }
};

module.exports = { compareFaces };
