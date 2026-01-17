#!/bin/bash

# Update Railway Environment Variables for Resend
# This script updates the email configuration from SendGrid to Resend

echo "🚂 Updating Railway Environment Variables for Resend..."
echo ""

# Set Resend variables
echo "Setting RESEND_API_KEY..."
railway variables set RESEND_API_KEY=re_Xg8pdQfL_JWSfPtXN1MZWw3MzbEuQ7fzh

echo "Setting RESEND_FROM_EMAIL..."
railway variables set RESEND_FROM_EMAIL=noreply@g8road.com

echo "Setting RESEND_FROM_NAME..."
railway variables set RESEND_FROM_NAME=G8Road

echo ""
echo "Removing old SendGrid variables..."
railway variables delete SENDGRID_API_KEY --yes || echo "SENDGRID_API_KEY not found"
railway variables delete SENDGRID_FROM_EMAIL --yes || echo "SENDGRID_FROM_EMAIL not found"
railway variables delete SENDGRID_FROM_NAME --yes || echo "SENDGRID_FROM_NAME not found"

echo ""
echo "✅ Railway environment variables updated!"
echo ""
echo "Next step: Redeploy your application"
echo "railway up"

