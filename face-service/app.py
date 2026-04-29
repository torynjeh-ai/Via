import face_recognition
import numpy as np
import base64
import io
from PIL import Image
from flask import Flask, request, jsonify

app = Flask(__name__)


def decode_image(data: str):
    """Decode a base64 or data-URL string into a numpy RGB array."""
    if ',' in data:
        data = data.split(',', 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    return np.array(img)


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

    distance = float(face_recognition.face_distance([doc_encoding], face_encoding)[0])
    tolerance = 0.55
    match = bool(distance <= tolerance)
    confidence = round(max(0.0, (1 - distance / 0.6)) * 100, 1)

    return jsonify({
        'match':      match,
        'distance':   round(distance, 4),
        'confidence': confidence,
        'threshold':  tolerance,
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
