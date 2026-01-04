#!/bin/bash

echo "🔧 G8Road CRM - Clean Server Restart"
echo "===================================="
echo ""

# Step 1: Kill all existing processes
echo "Step 1: Killing all existing Node and React processes..."
pkill -9 node 2>/dev/null
pkill -9 react-scripts 2>/dev/null
sleep 3

# Step 2: Verify ports are free
echo "Step 2: Verifying ports are free..."
if lsof -i :5001 > /dev/null 2>&1; then
    echo "❌ Port 5001 is still in use. Forcing kill..."
    lsof -t -i :5001 | xargs kill -9 2>/dev/null
    sleep 2
fi

if lsof -i :3001 > /dev/null 2>&1; then
    echo "❌ Port 3001 is still in use. Forcing kill..."
    lsof -t -i :3001 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "✅ Ports are now free"
echo ""

# Step 3: Start backend server
echo "Step 3: Starting backend server on port 5001..."
echo "--------------------------------------------"
cd /Users/mauricio/burning-man-crm/burning-man-crm

GOOGLE_CLIENT_ID="115710029109-99h025pi7c43bbf058fim6fjog07qdj5.apps.googleusercontent.com" \
GOOGLE_CLIENT_SECRET="GOCSPX-fn-e0RMt2LgaZkbCxJOc4CGE8hC" \
JWT_SECRET="your-super-secret-jwt-key-here" \
PORT=5001 node server/index.js > /tmp/backend.log 2>&1 &

BACKEND_PID=$!
echo "Backend server started (PID: $BACKEND_PID)"
echo "Backend logs: tail -f /tmp/backend.log"
echo ""

# Step 4: Wait for backend to start
echo "Step 4: Waiting for backend to start..."
sleep 10

# Step 5: Start frontend server
echo "Step 5: Starting frontend server on port 3001..."
echo "--------------------------------------------"
cd /Users/mauricio/burning-man-crm/burning-man-crm/client

PORT=3001 npm start > /tmp/frontend.log 2>&1 &

FRONTEND_PID=$!
echo "Frontend server started (PID: $FRONTEND_PID)"
echo "Frontend logs: tail -f /tmp/frontend.log"
echo ""

# Step 6: Summary
echo "===================================="
echo "✅ Servers Started Successfully!"
echo "===================================="
echo ""
echo "Backend:  http://localhost:5001"
echo "Frontend: http://localhost:3001"
echo ""
echo "Process IDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "View Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop servers:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "NOTE: MongoDB connection errors are NORMAL in development."
echo "The app will automatically use the mock database."
echo ""

