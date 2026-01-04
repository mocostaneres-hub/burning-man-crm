#!/bin/bash

echo "🚀 Adding SendGrid Environment Variables to Railway"
echo "=================================================="
echo ""
echo "This script will add the SendGrid configuration to your Railway project."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo ""
    echo "Please install it first:"
    echo "  npm i -g @railway/cli"
    echo ""
    echo "Or visit: https://docs.railway.app/guides/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ You're not logged in to Railway."
    echo ""
    echo "Please run: railway login"
    exit 1
fi

echo "✅ Railway CLI is installed and you're logged in"
echo ""

# Read the SendGrid API key from .env file
if [ -f .env ]; then
    SENDGRID_KEY=$(grep "SENDGRID_API_KEY=" .env | cut -d'=' -f2)
    if [ -z "$SENDGRID_KEY" ]; then
        echo "❌ SENDGRID_API_KEY not found in .env file"
        exit 1
    fi
    echo "✅ Found SendGrid API key in .env file"
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "Adding environment variables to Railway..."
echo ""

# Add the variables
railway variables set SENDGRID_API_KEY="$SENDGRID_KEY"
railway variables set SENDGRID_FROM_EMAIL="noreply@g8road.com"
railway variables set SENDGRID_FROM_NAME="G8Road"

echo ""
echo "✅ Environment variables added successfully!"
echo ""
echo "Railway will automatically redeploy your application."
echo "Wait a few minutes for the deployment to complete."
echo ""
echo "To verify, run: railway variables"
echo ""

