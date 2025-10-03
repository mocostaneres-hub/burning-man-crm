#!/bin/bash

# G8Road CRM Production Build Script

echo "🚀 Building G8Road CRM for Production..."

# Install dependencies
echo "📦 Installing dependencies..."
npm run install-all

# Build React app
echo "🔨 Building React application..."
cd client
npm run build
cd ..

# Create production environment file
echo "⚙️ Creating production environment configuration..."
cat > .env.production << EOF
# Production Environment Variables for G8Road CRM
# Copy this file to .env and fill in your actual values

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/g8road-crm

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
JWT_EXPIRE=7d

# Server Configuration
PORT=5001
NODE_ENV=production

# Domain Configuration
FRONTEND_URL=https://g8road.com
BACKEND_URL=https://g8road.com/api

# OAuth Configuration (Optional)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
APPLE_CLIENT_ID=your-apple-client-id-here
APPLE_CLIENT_SECRET=your-apple-client-secret-here

# Email Configuration (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloudinary Configuration (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
EOF

# Create client production environment
echo "📱 Creating client production environment..."
cat > client/.env.production << EOF
# Production environment variables for React app
REACT_APP_API_URL=https://g8road.com/api
REACT_APP_SOCKET_URL=https://g8road.com
GENERATE_SOURCEMAP=false
EOF

echo "✅ Production build complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update environment variables in .env.production"
echo "2. Deploy using one of the methods in deploy-setup.md"
echo "3. Configure your domain DNS to point to your deployment"
echo ""
echo "🌐 Your CRM will be available at: https://g8road.com"
