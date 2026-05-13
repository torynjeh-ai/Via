/**
 * Client-side document OCR using Tesseract.js.
 *
 * Scans the front image of a passport or national ID,
 * extracts the MRZ (Machine Readable Zone), and parses
 * the document number from it.
 *
 * MRZ formats:
 *   TD3 (passport)   — 2 lines × 44 chars
 *   TD1 (national ID) — 3 lines × 30 chars
 */

import { createWorker } from 'tesseract.js';

// MRZ character set — only uppercase letters, digits, and filler '<'
const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/**
 * Clean up an OCR line to valid MRZ characters.
 * Tesseract sometimes confuses O/0, I/1, etc.
 */
function cleanMrzLine(line) {
  return line
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')   // common OCR confusion
    .replace(/[^A-Z0-9<]/g, '<'); // replace anything invalid with filler
}

/**
 * Parse document number from a TD3 (passport) MRZ.
 * Line 2: positions 0–8 = document number (9 chars, padded with <)
 */
function parseTD3(lines) {
  if (lines.length < 2) return null;
  const line2 = cleanMrzLine(lines[1]);
  if (line2.length < 9) return null;
  const raw = line2.slice(0, 9).replace(/<+$/, '');
  return raw.length >= 6 ? raw : null;
}

/**
 * Parse document number from a TD1 (national ID) MRZ.
 * Line 1: positions 5–13 = document number (9 chars)
 */
function parseTD1(lines) {
  if (lines.length < 1) return null;
  const line1 = cleanMrzLine(lines[0]);
  if (line1.length < 14) return null;
  const raw = line1.slice(5, 14).replace(/<+$/, '');
  return raw.length >= 5 ? raw : null;
}

/**
 * Extract MRZ lines from raw OCR text.
 * Looks for lines that are mostly MRZ characters and long enough.
 */
function extractMrzLines(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 20);

  const mrzLines = lines.filter(line => {
    const cleaned = line.toUpperCase().replace(/\s+/g, '');
    const mrzCharCount = [...cleaned].filter(c => MRZ_CHARS.includes(c)).length;
    return mrzCharCount / cleaned.length > 0.85; // >85% MRZ chars
  });

  return mrzLines;
}

/**
 * Scan a document image (base64 data URL) and extract the document number.
 *
 * @param {string} imageDataUrl - base64 data URL of the document front image
 * @param {'passport'|'id'} docType
 * @param {function} onProgress - optional callback(progress 0–100)
 * @returns {{ docNumber: string|null, confidence: number, raw: string }}
 */
export async function scanDocument(imageDataUrl, docType, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    // Use LSTM engine with character whitelist tuned for MRZ
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      tessedit_pageseg_mode: '6', // assume uniform block of text
    });

    const { data } = await worker.recognize(imageDataUrl);
    const mrzLines = extractMrzLines(data.text);

    let docNumber = null;

    if (docType === 'passport') {
      docNumber = parseTD3(mrzLines);
    } else {
      // Try TD1 first, fall back to TD3
      docNumber = parseTD1(mrzLines) || parseTD3(mrzLines);
    }

    // If MRZ parsing failed, try a simple regex scan on the raw text
    if (!docNumber) {
      const passportMatch = data.text.match(/\b([A-Z]{1,2}[0-9]{6,8})\b/);
      const idMatch       = data.text.match(/\b([A-Z0-9]{7,12})\b/);
      const match = docType === 'passport' ? passportMatch : (idMatch || passportMatch);
      if (match) docNumber = match[1];
    }

    return {
      docNumber,
      confidence: data.confidence,
      raw: data.text,
    };
  } finally {
    await worker.terminate();
  }
}
