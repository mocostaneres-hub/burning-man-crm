#!/bin/bash

echo "🛑 Stopping ALL React development server processes..."

# Find and kill processes on port 3000 (React default)
PORT_PIDS=$(lsof -ti tcp:3000 2>/dev/null)
if [ ! -z "$PORT_PIDS" ]; then
  echo "   Found processes on port 3000: $PORT_PIDS"
  echo "$PORT_PIDS" | xargs kill -9 2>/dev/null
  echo "   ✅ Killed port 3000 processes"
else
  echo "   No processes found on port 3000"
fi

# Find and kill node processes that might be react-scripts
REACT_PIDS=$(ps aux | grep 'react-scripts start' | grep -v grep | awk '{print $2}')
if [ ! -z "$REACT_PIDS" ]; then
  echo "   Found react-scripts processes: $REACT_PIDS"
  echo "$REACT_PIDS" | xargs kill -9 2>/dev/null
  echo "   ✅ Killed react-scripts processes"
else
  echo "   No react-scripts processes found"
fi

# Find and kill any node process running from the client directory
CLIENT_PIDS=$(ps aux | grep "node.*client" | grep -v grep | awk '{print $2}')
if [ ! -z "$CLIENT_PIDS" ]; then
  echo "   Found client node processes: $CLIENT_PIDS"
  echo "$CLIENT_PIDS" | xargs kill -9 2>/dev/null
  echo "   ✅ Killed client node processes"
else
  echo "   No client node processes found"
fi

sleep 2

echo ""
echo "✅ All React development server processes stopped!"
echo ""
echo "📦 Clearing React cache..."
rm -rf /Users/mauricio/burning-man-crm/client/node_modules/.cache
echo "✅ React cache cleared!"
echo ""
echo "🚀 NOW run this command to start React:"
echo "   cd /Users/mauricio/burning-man-crm/client && npm start"

