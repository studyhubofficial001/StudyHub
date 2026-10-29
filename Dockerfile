# One container = Node (public) + Python AI service (private, 127.0.0.1:8000)
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PDF_CACHE_DIR=/tmp/pdf-cache

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Node dependencies (cached layer)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# 2) Python dependencies (cached layer)
COPY ai-service/requirements.txt ./ai-service/requirements.txt
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install -r ai-service/requirements.txt

# 3) Your code
COPY server ./server
COPY ai-service ./ai-service
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Render sets PORT (Node listens on it). Python always uses 127.0.0.1:8000 (not reachable from outside).
CMD ["/app/start.sh"]