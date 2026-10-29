#!/bin/bash
# Start Sal's Galaxy Zone Arcade local server
PORT=${1:-8000}
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   SAL'S GALAXY ZONE ARCADE              ║"
echo "  ║   Server running on port $PORT            ║"
echo "  ║   http://localhost:$PORT                  ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || echo "Open http://localhost:$PORT in your browser"
cd "$(dirname "$0")"
python3 -m http.server "$PORT"
