# SpeechFlaw Full Production Container
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system audio dependencies (ffmpeg, libsndfile1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and project metadata
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir -e . --no-deps

COPY api/ api/
COPY data/ data/
COPY docs/ docs/

# Expose FastAPI port
EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
