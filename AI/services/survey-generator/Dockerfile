FROM python:3.10-slim

WORKDIR /app

# Cài dependencies hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy và install Python deps trước (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (trừ .env, .venv, __pycache__)
COPY . .

EXPOSE 8002

# Chạy với uvicorn - lắng nghe trên PORT env var (Railway inject PORT tự động)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002} --workers 1"]
