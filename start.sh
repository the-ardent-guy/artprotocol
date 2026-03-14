#!/bin/bash
# Art Protocol OS - Start both backend and frontend

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔═══════════════════════════════════╗"
echo "║     ART PROTOCOL OS               ║"
echo "╚═══════════════════════════════════╝"
echo ""

# Start backend
echo "[1/2] Starting FastAPI backend on :8000..."
cd "$ROOT/backend"

if [ ! -d "../venv311" ]; then
  echo "  Installing backend deps..."
  pip install -r requirements.txt
fi

cd "$ROOT/backend"
# Use the project venv if available
if [ -f "../venv311/Scripts/python" ]; then
  PYTHON="../venv311/Scripts/python"
elif [ -f "../venv311/bin/python" ]; then
  PYTHON="../venv311/bin/python"
else
  PYTHON="python"
fi

$PYTHON -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Start frontend
echo "[2/2] Starting Next.js frontend on :3000..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing frontend deps..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both"

# Wait and handle shutdown
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
