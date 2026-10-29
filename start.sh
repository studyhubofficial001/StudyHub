#!/bin/bash
# Starts both programs. If one dies, the container stops so Render restarts it.

cd /app/ai-service || exit 1
/opt/venv/bin/uvicorn studyhub_ingestion.main:app --host 127.0.0.1 --port 8000 --workers 1 &
PY=$!

cd /app/server || exit 1
node index.js &
NODE=$!

trap 'kill $PY $NODE 2>/dev/null' TERM INT

wait -n                      # returns when the first of the two exits
echo "A process stopped, shutting the container down"
kill $PY $NODE 2>/dev/null
exit 1