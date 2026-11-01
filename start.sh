#!/bin/bash
# Starts both processes in one container. If either one dies, the container exits
# and Render restarts it (better than running half a server).

cd /app/ai_service
uvicorn studyhub_rag.main:app --host 127.0.0.1 --port 8000 --workers 1 &

cd /app/server
node index.js &

wait -n          # returns as soon as the first process exits
kill 0 2>/dev/null
exit 1
