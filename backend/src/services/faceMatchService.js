const logger = require('../utils/logger');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';

/**
 * Compare a face in a document image against a selfie.
 *
 * Uses the Python face service if FACE_SERVICE_URL is set and reachable.
 * Falls back to mock approval if the service is unavailable.
 */
const compareFaces = async (documentImageBase64, selfieBase64) => {
  if (!process.env.FACE_SERVICE_URL) {
    logger.info('[FaceMatch] FACE_SERVICE_URL not set — using mock (always match)');
    await new Promise(r => setTimeout(r, 800));
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
    logger.info(`[FaceMatch] match=${result.match} confidence=${result.confidence}%`);
    return { match: result.match, confidence: result.confidence, reason: result.reason || null };
  } catch (error) {
    logger.error(`[FaceMatch] Service error: ${error.message} — falling back to mock approval`);
    // Face service is unreachable — allow verification to proceed
    // so users are not blocked. Replace with a hard failure once the
    // face service is stable.
    return { match: true, confidence: 0, reason: 'face-service-unavailable' };
  }
};

module.exports = { compareFaces };
