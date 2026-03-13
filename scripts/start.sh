#!/bin/bash
# Family Hub Kiosk Startup
cd "$(dirname "$0")/.."
npm run start &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server ready
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Server ready"
    break
  fi
  sleep 1
done

# Launch Chrome in kiosk mode
open -a "Google Chrome" --args --kiosk --no-first-run --disable-translate --disable-infobars "http://localhost:3000?device=tv"
echo "Kiosk launched at $(date)"
