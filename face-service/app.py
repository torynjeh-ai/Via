import os
import base64
import io
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify

app = Flask(__name__)

def decode_image(data: str):
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    return np.array(img)

def save_temp(arr: np.ndarray, name: str) -> str:
    path = f'/tmp/{name}.jpg'
    Image.fromarray(arr).save(path, quality=85)
    return path

# Pre-load DeepFace model at startup to avoid cold-start timeout
print('[startup] Pre-loading DeepFace Facenet model...')
try:
    from deepface import DeepFace
    # Warm up by building the model
    DeepFace.build_model('Facenet')
    print('[startup] DeepFace model loaded.')
except Exception as e:
    print(f'[startup] Warning: could not pre-load model: {e}')

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

    doc_path  = save_temp(doc_arr,  'doc')
    face_path = save_temp(face_arr, 'face')

    try:
        from deepface import DeepFace
        result = DeepFace.verify(
            img1_path=doc_path,
            img2_path=face_path,
            model_name='Facenet',
            detector_backend='opencv',
            enforce_detection=False,
        )
        match      = bool(result.get('verified', False))
        distance   = float(result.get('distance', 1.0))
        confidence = round(max(0.0, (1 - distance) * 100), 1)

        app.logger.info(f'match={match} distance={distance:.4f} confidence={confidence}%')
        return jsonify({'match': match, 'distance': round(distance, 4), 'confidence': confidence})

    except Exception as e:
        app.logger.error(f'DeepFace error: {e}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
