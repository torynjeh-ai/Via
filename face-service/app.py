import re
import face_recognition
import numpy as np
import base64
import io
from PIL import Image, ImageFilter, ImageOps
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def decode_image(data: str):
    """Decode a base64 or data-URL string into a numpy RGB array."""
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    return np.array(img)


def decode_pil(data: str) -> Image.Image:
    """Decode a base64 or data-URL string into a PIL Image."""
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert('RGB')


# ---------------------------------------------------------------------------
# MRZ parsing helpers (no external OCR library required)
# ---------------------------------------------------------------------------

MRZ_CHARSET = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<')

# Common OCR confusions to fix before parsing
OCR_FIXES = str.maketrans({
    'O': '0', 'o': '0',
    'I': '1', 'l': '1',
    'S': '5',
    'B': '8',
    'G': '6',
    'Z': '2',
})


def clean_mrz_line(line: str) -> str:
    """Normalise a raw OCR line to valid MRZ characters."""
    line = line.upper().replace(' ', '').translate(OCR_FIXES)
    return ''.join(c if c in MRZ_CHARSET else '<' for c in line)


def mrz_ratio(line: str) -> float:
    if not line:
        return 0.0
    return sum(1 for c in line.upper() if c in MRZ_CHARSET) / len(line)


def extract_mrz_lines(text: str):
    """Return lines that look like MRZ (>85 % MRZ chars, length >= 20)."""
    candidates = []
    for raw in text.split('\n'):
        stripped = raw.strip().replace(' ', '')
        if len(stripped) >= 20 and mrz_ratio(stripped) > 0.85:
            candidates.append(clean_mrz_line(stripped))
    return candidates


def parse_doc_number_td3(lines) -> str | None:
    """TD3 (passport): line 2, positions 0-8 = document number."""
    if len(lines) < 2:
        return None
    num = lines[1][:9].rstrip('<')
    return num if len(num) >= 6 else None


def parse_doc_number_td1(lines) -> str | None:
    """TD1 (national ID): line 1, positions 5-13 = document number."""
    if not lines:
        return None
    line1 = lines[0]
    if len(line1) < 14:
        return None
    num = line1[5:14].rstrip('<')
    return num if len(num) >= 5 else None


def regex_fallback(text: str, doc_type: str) -> str | None:
    """Last-resort regex scan when MRZ parsing fails."""
    upper = text.upper()
    if doc_type == 'passport':
        m = re.search(r'\b([A-Z]{1,2}[0-9]{6,8})\b', upper)
    else:
        m = re.search(r'\b([A-Z0-9]{7,12})\b', upper)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/compare', methods=['POST'])
def compare():
    body = request.get_json(force=True)
    doc_image_b64  = body.get('doc_image')
    face_image_b64 = body.get('face_image')

    if not doc_image_b64 or not face_image_b64:
        return jsonify({'error': 'doc_image and face_image are required'}), 400

    try:
        doc_array  = decode_image(doc_image_b64)
        face_array = decode_image(face_image_b64)
    except Exception as e:
        return jsonify({'error': f'Failed to decode images: {str(e)}'}), 400

    doc_locations  = face_recognition.face_locations(doc_array,  model='hog')
    face_locations = face_recognition.face_locations(face_array, model='hog')

    if not doc_locations:
        return jsonify({'match': False, 'reason': 'No face detected in document image'}), 200

    if not face_locations:
        return jsonify({'match': False, 'reason': 'No face detected in selfie'}), 200

    doc_encoding  = face_recognition.face_encodings(doc_array,  [doc_locations[0]])[0]
    face_encoding = face_recognition.face_encodings(face_array, [face_locations[0]])[0]

    distance   = float(face_recognition.face_distance([doc_encoding], face_encoding)[0])
    tolerance  = 0.55
    match      = bool(distance <= tolerance)
    confidence = round(max(0.0, (1 - distance / 0.6)) * 100, 1)

    return jsonify({
        'match':      match,
        'distance':   round(distance, 4),
        'confidence': confidence,
        'threshold':  tolerance,
    })


@app.route('/scan', methods=['POST'])
def scan():
    """
    Extract the document number from a document image.

    Tries (in order):
      1. pytesseract (if installed + Tesseract binary present)
      2. Returns null with method='unavailable' so the frontend
         falls back to its own Tesseract.js scan.

    Request body:
      { "doc_image": "<base64 or data-URL>", "doc_type": "passport"|"id" }

    Response:
      { "doc_number": "A12345678"|null, "confidence": 87.3,
        "method": "tesseract"|"unavailable" }
    """
    body     = request.get_json(force=True)
    doc_b64  = body.get('doc_image')
    doc_type = body.get('doc_type', 'passport')

    if not doc_b64:
        return jsonify({'error': 'doc_image is required'}), 400

    # ── Try pytesseract ──────────────────────────────────────────────────────
    try:
        import pytesseract  # noqa: F401 — only available if installed

        pil_img = decode_pil(doc_b64)

        # Pre-process: upscale, greyscale, sharpen, threshold
        w, h = pil_img.size
        scale = max(1, 2000 // max(w, h))
        pil_img = pil_img.resize((w * scale, h * scale), Image.LANCZOS)
        grey    = ImageOps.grayscale(pil_img)
        sharp   = grey.filter(ImageFilter.SHARPEN)

        # OCR with MRZ-optimised config
        custom_cfg = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
        raw_text   = pytesseract.image_to_string(sharp, config=custom_cfg)

        mrz_lines  = extract_mrz_lines(raw_text)
        doc_number = None

        if doc_type == 'passport':
            doc_number = parse_doc_number_td3(mrz_lines)
        else:
            doc_number = parse_doc_number_td1(mrz_lines) or parse_doc_number_td3(mrz_lines)

        if not doc_number:
            doc_number = regex_fallback(raw_text, doc_type)

        return jsonify({
            'doc_number': doc_number,
            'confidence': 80.0 if doc_number else 0.0,
            'method':     'tesseract',
        })

    except (ImportError, Exception):
        pass  # fall through to unavailable response

    # ── No OCR available on server — tell client to use its own scanner ──────
    return jsonify({
        'doc_number': None,
        'confidence': 0,
        'method':     'unavailable',
        'reason':     'No OCR engine available on server; use client-side scan',
    }), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
