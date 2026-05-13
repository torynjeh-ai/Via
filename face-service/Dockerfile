FROM python:3.9-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use older cmake that is compatible with dlib 19.24.2
RUN pip install --no-cache-dir "cmake==3.25.0"

# Install dlib (compiles from source — takes ~10 min)
RUN pip install --no-cache-dir dlib==19.24.2

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5001

CMD ["python", "app.py"]
