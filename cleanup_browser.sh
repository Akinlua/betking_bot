#!/bin/bash
# cleanup_browser.sh

echo "Starting browser cleanup at $(date)"

# Kill chrome and chromium processes matching the pattern
echo "Killing chrome processes..."
pkill -f chrome || echo "No chrome processes found"

echo "Killing chromium processes..."
pkill -f chromium || echo "No chromium processes found"

# Restart the betking_api service
echo "Restarting betking_api.service..."
systemctl restart betking_api.service

echo "Browser cleanup and service restart completed at $(date)"
