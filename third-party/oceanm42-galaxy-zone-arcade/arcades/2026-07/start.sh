#!/usr/bin/env bash
# start.sh — optional convenience server for Sal's Galaxy Zone Arcade.
#
# The whole site works by just double-clicking index.html (file://), but a
# local server avoids browser file:// quirks (some browsers restrict
# ResizeObserver/canvas behavior or CORS-style checks on local files) and
# is handy for the game agents while iterating.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "Sal's Galaxy Zone Arcade — serving http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
python3 -m http.server "${PORT}"
