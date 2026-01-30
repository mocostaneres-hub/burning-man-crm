#!/bin/bash

# Check Railway MongoDB info
echo "🔍 Checking Railway MongoDB configuration..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not installed"
    echo ""
    echo "Install with: npm install -g @railway/cli"
    echo "Then run: railway login"
    echo ""
    exit 1
fi

# Get variables
echo "📋 Current Railway Variables:"
echo "=============================="
railway variables | grep -i mongo || echo "No MONGO variables found"
echo ""

echo "💡 To update MONGODB_URI:"
echo "1. Find your production database name (see above)"
echo "2. Run: railway variables set MONGODB_URI='mongodb://mongo:PASSWORD@HOST:PORT/DATABASE_NAME'"
echo ""
