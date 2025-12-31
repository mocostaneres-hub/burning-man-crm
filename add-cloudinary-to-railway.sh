#!/bin/bash

# Script to add Cloudinary variables to Railway
# Run this after: npx railway login && npx railway link

echo "🚂 Adding Cloudinary variables to Railway..."
echo ""

# Check if logged in
if ! npx railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway!"
    echo ""
    echo "Please run these commands first:"
    echo "  npx railway login"
    echo "  npx railway link"
    echo ""
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Add variables
echo "Adding CLOUDINARY_CLOUD_NAME..."
npx railway variables set CLOUDINARY_CLOUD_NAME=dkcf729ek

echo "Adding CLOUDINARY_API_KEY..."
npx railway variables set CLOUDINARY_API_KEY=33b8150dfec4825e1790b84678b00f

echo "Adding CLOUDINARY_API_SECRET..."
npx railway variables set CLOUDINARY_API_SECRET=HACvPVreq_u3QKxwy9sDXwU1_zs

echo ""
echo "✅ All Cloudinary variables added successfully!"
echo ""
echo "Railway will now automatically redeploy your app."
echo "Wait ~2 minutes, then test photo upload on your production site!"

