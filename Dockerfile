# SpeechFlaw Full Production Container
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PYTHONPATH="/app/src:${PYTHONPATH}"

WORKDIR /app

# Install system audio dependencies (ffmpeg, libsndfile1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade packaging tools and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code, documentation and project metadata
COPY pyproject.toml README.md ./
COPY src/ src/
RUN pip install --no-cache-dir -e . --no-deps

COPY api/ api/
COPY data/ data/
COPY docs/ docs/

# Expose FastAPI port
EXPOSE 8000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
