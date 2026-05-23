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

  logger.info(`[FaceMatch] Calling face service at ${FACE_SERVICE_URL}/compare`);

  const response = await fetch(`${FACE_SERVICE_URL}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_image: documentImageBase64, face_image: selfieBase64 }),
    signal: AbortSignal.timeout(120000), // 120s — TF inference is slow on first run
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    logger.error(`[FaceMatch] Service returned ${response.status}: ${JSON.stringify(err)}`);
    throw new Error(err.error || `Face service returned ${response.status}`);
  }

  const result = await response.json();
  logger.info(`[FaceMatch] match=${result.match} confidence=${result.confidence}%`);
  return { match: result.match, confidence: result.confidence, reason: result.reason || null };
};

module.exports = { compareFaces };
