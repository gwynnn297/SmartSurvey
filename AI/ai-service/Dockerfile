FROM python:3.10-slim

WORKDIR /app

# Cài dependencies hệ thống (cần cho numpy, chromadb, pymysql, v.v.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và install (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source (trừ .venv, chroma_db, .env — xem .dockerignore)
COPY . .

EXPOSE 8000

# Chạy với uvicorn, PORT tự động inject bởi Railway/Render
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
