#!/bin/bash

echo "🔄 Restarting React Development Server..."
echo ""
echo "1️⃣ Stopping any running React processes..."
pkill -f "react-scripts start" || true
sleep 2

echo "2️⃣ Clearing React cache..."
rm -rf node_modules/.cache

echo "3️⃣ Starting React development server..."
echo "✅ Ready to start! Run: npm start"
echo ""

