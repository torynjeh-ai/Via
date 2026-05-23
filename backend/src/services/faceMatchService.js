const logger = require('../utils/logger');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL;

/**
 * Compare a face in a document image against a selfie.
 * Requires the Python face service to be running and FACE_SERVICE_URL to be set.
 */
const compareFaces = async (documentImageBase64, selfieBase64) => {
  if (!FACE_SERVICE_URL) {
    logger.warn('[FaceMatch] FACE_SERVICE_URL not set — using mock (dev only)');
    await new Promise(r => setTimeout(r, 800));
    return { match: true, confidence: 98.7 };
  }

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
  logger.info(`[FaceMatch] match=${result.match} confidence=${result.confidence}%`);
  return { match: result.match, confidence: result.confidence, reason: result.reason || null };
};

module.exports = { compareFaces };
