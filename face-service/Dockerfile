FROM python:3.11-slim

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

# Pass CMake policy flag so dlib's bundled pybind11 builds with modern CMake
ENV CMAKE_POLICY_VERSION_MINIMUM=3.5

# Install dlib 19.24.6 which has the pybind11 CMake fix
RUN pip install --no-cache-dir dlib==19.24.6

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5001

CMD ["python", "app.py"]
