# One Render service that runs Express (public) + the AI service (private, 127.0.0.1:8000).
# Repo layout this file expects (build context = repo root):
#   Dockerfile
#   start.sh
#   server/                          (Express)
#   ai-service/src/ai_service/       (requirements.txt + studyhub_rag/)

# ---- stage 1: install Node dependencies
FROM node:22-slim AS node_deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./

# ---- stage 2: Python image that also carries the node binary
FROM python:3.13-slim
WORKDIR /app
COPY --from=node_deps /usr/local/bin/node /usr/local/bin/node

COPY ai-service/src/ai_service/requirements.txt ai_service/requirements.txt
RUN pip install --no-cache-dir -r ai_service/requirements.txt

COPY ai-service/src/ai_service/ ai_service/
COPY --from=node_deps /app/server server/
COPY start.sh .

ENV PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=180
CMD ["bash", "start.sh"]