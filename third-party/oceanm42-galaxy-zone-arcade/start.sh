#!/bin/bash
# Serve the whole Galaxy Zone franchise (all three locations) locally.
# Needed to PLAY the March 2026 location (it uses ES modules); the other
# two, and this landing page, also work straight from file://.
PORT="${1:-8080}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   SAL'S GALAXY ZONE — THREE LOCATIONS    ║"
echo "  ║   http://localhost:$PORT                   ║"
echo "  ╚══════════════════════════════════════════╝"
cd "$(dirname "$0")"
(command -v open >/dev/null && open "http://localhost:$PORT") || (command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT")
python3 -m http.server "$PORT"
