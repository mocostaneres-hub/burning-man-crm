#!/bin/bash

echo "🔍 Checking Railway Environment Variables"
echo "=========================================="
echo ""

# Try to check if railway CLI is available
if command -v railway &> /dev/null; then
    echo "✅ Railway CLI found"
    echo ""
    echo "Checking environment variables..."
    railway variables 2>&1 | grep -i sendgrid || echo "⚠️  No SENDGRID variables found in Railway"
else
    echo "❌ Railway CLI not installed"
    echo ""
    echo "To check environment variables manually:"
    echo "1. Go to https://railway.app/dashboard"
    echo "2. Select your project"
    echo "3. Click 'Variables' tab"
    echo "4. Verify these exist:"
    echo "   - SENDGRID_API_KEY"
    echo "   - SENDGRID_FROM_EMAIL"
    echo "   - SENDGRID_FROM_NAME"
fi

echo ""
echo "Checking local .env file..."
if [ -f .env ]; then
    echo "✅ Local .env exists"
    if grep -q "SENDGRID_API_KEY" .env; then
        echo "✅ SENDGRID_API_KEY found in .env"
    else
        echo "❌ SENDGRID_API_KEY NOT found in .env"
    fi
else
    echo "❌ No .env file found"
fi

