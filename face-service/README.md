# Via Face Service

A lightweight Python microservice that compares two face images using the `face_recognition` library (dlib).

## Endpoints

### `GET /health`
Returns `{ "status": "ok" }` — use to check the service is running.

### `POST /compare`
Compares a face in a document photo against a selfie.

**Request body:**
```json
{
  "doc_image":  "<base64 or data-URL of document photo>",
  "face_image": "<base64 or data-URL of selfie>"
}
```

**Response:**
```json
{
  "match":      true,
  "distance":   0.38,
  "confidence": 36.7,
  "threshold":  0.55
}
```

- `match` — `true` if the faces belong to the same person
- `distance` — raw face distance (lower = more similar, < 0.55 = match)
- `confidence` — human-readable percentage (100% = identical, 0% = no match)

## Running locally

### Option 1 — Direct Python

**Prerequisites:** Python 3.8+, cmake, C++ build tools

```bash
cd face-service

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies (dlib takes a few minutes to compile)
pip install -r requirements.txt

# Start the service
python app.py
# Runs on http://localhost:5001
```

### Option 2 — Docker (recommended, handles dlib build automatically)

```bash
cd face-service
docker build -t via-face-service .
docker run -p 5001:5001 via-face-service
```

## Environment variable

Add to `backend/.env`:
```
FACE_SERVICE_URL=http://localhost:5001
```
