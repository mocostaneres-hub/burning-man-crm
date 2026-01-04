#!/bin/bash

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node server/index.js" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
sleep 2

# Start backend server
echo "Starting backend server on port 5001..."
cd /Users/mauricio/burning-man-crm/burning-man-crm
GOOGLE_CLIENT_ID="115710029109-99h025pi7c43bbf058fim6fjog07qdj5.apps.googleusercontent.com" \
GOOGLE_CLIENT_SECRET="GOCSPX-fn-e0RMt2LgaZkbCxJOc4CGE8hC" \
JWT_SECRET="your-super-secret-jwt-key-here" \
PORT=5001 \
node server/index.js &

# Wait for backend to start
sleep 5

# Start frontend server
echo "Starting frontend server on port 3000..."
cd /Users/mauricio/burning-man-crm/burning-man-crm/client
npm start &

# Wait for frontend to start
sleep 10

# Check if servers are running
echo "Checking server status..."
lsof -i :3000 -i :5001

echo "Servers should be running now!"
echo "Backend: http://127.0.0.1:5001"
echo "Frontend: http://127.0.0.1:3000"
