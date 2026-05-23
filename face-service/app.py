import os
import base64
import io
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Lightweight face comparison using histogram + structural similarity
# No TensorFlow, no heavy ML models — works within 512MB RAM
# ---------------------------------------------------------------------------

def decode_image(data: str) -> np.ndarray:
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    return np.array(img)

def resize(img: np.ndarray, size=(160, 160)) -> np.ndarray:
    pil = Image.fromarray(img).resize(size, Image.LANCZOS)
    return np.array(pil)

def to_gray(img: np.ndarray) -> np.ndarray:
    return np.dot(img[..., :3], [0.2989, 0.5870, 0.1140])

def histogram_similarity(img1: np.ndarray, img2: np.ndarray) -> float:
    """Compare normalised colour histograms — fast and memory-efficient."""
    def hist(img):
        h = []
        for c in range(3):
            channel = img[:, :, c].flatten()
            counts, _ = np.histogram(channel, bins=64, range=(0, 256))
            counts = counts.astype(float)
            counts /= counts.sum() + 1e-7
            h.append(counts)
        return np.concatenate(h)

    h1, h2 = hist(img1), hist(img2)
    # Bhattacharyya-like coefficient
    score = float(np.sum(np.sqrt(h1 * h2)))
    return score  # 0..1, higher = more similar

def ssim_score(img1: np.ndarray, img2: np.ndarray) -> float:
    """Structural similarity on greyscale thumbnails."""
    g1 = to_gray(resize(img1, (64, 64))).astype(float)
    g2 = to_gray(resize(img2, (64, 64))).astype(float)
    mu1, mu2 = g1.mean(), g2.mean()
    s1, s2 = g1.std(), g2.std()
    cov = ((g1 - mu1) * (g2 - mu2)).mean()
    C1, C2 = 6.5025, 58.5225
    ssim = ((2*mu1*mu2 + C1) * (2*cov + C2)) / \
           ((mu1**2 + mu2**2 + C1) * (s1**2 + s2**2 + C2))
    return float(ssim)

def detect_face_region(img: np.ndarray) -> np.ndarray:
    """
    Try OpenCV Haar cascade to crop face region.
    Falls back to centre crop if no face detected.
    """
    try:
        import cv2
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        detector = cv2.CascadeClassifier(cascade_path)
        faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
        if len(faces) > 0:
            x, y, w, h = faces[0]
            # Add 20% padding
            pad = int(0.2 * min(w, h))
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(img.shape[1], x + w + pad)
            y2 = min(img.shape[0], y + h + pad)
            return img[y1:y2, x1:x2]
    except Exception:
        pass
    # Centre crop fallback
    h, w = img.shape[:2]
    m = min(h, w)
    y0 = (h - m) // 2
    x0 = (w - m) // 2
    return img[y0:y0+m, x0:x0+m]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/compare', methods=['POST'])
def compare():
    body = request.get_json(force=True)
    doc_b64  = body.get('doc_image')
    face_b64 = body.get('face_image')

    if not doc_b64 or not face_b64:
        return jsonify({'error': 'doc_image and face_image are required'}), 400

    try:
        doc_arr  = decode_image(doc_b64)
        face_arr = decode_image(face_b64)
    except Exception as e:
        return jsonify({'error': f'Failed to decode images: {str(e)}'}), 400

    # Crop to face regions
    doc_face  = detect_face_region(doc_arr)
    face_face = detect_face_region(face_arr)

    # Resize to common size
    doc_r  = resize(doc_face)
    face_r = resize(face_face)

    # Compute similarity scores
    hist_sim = histogram_similarity(doc_r, face_r)
    ssim     = ssim_score(doc_r, face_r)

    # Combined score (weighted average)
    combined = 0.5 * hist_sim + 0.5 * ((ssim + 1) / 2)
    threshold = 0.55
    match = bool(combined >= threshold)
    confidence = round(combined * 100, 1)

    app.logger.info(f'hist={hist_sim:.3f} ssim={ssim:.3f} combined={combined:.3f} match={match}')

    return jsonify({
        'match':      match,
        'confidence': confidence,
        'distance':   round(1 - combined, 4),
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
