#!/bin/bash

# Script to run FAQ migration on production server
# Make sure you have access to the production server and MongoDB

echo "🚀 Starting FAQ migration on production server..."

# Set environment variables (adjust these for your production setup)
export MONGODB_URI="your-production-mongodb-uri"
export ADMIN_EMAIL="your-admin-email"
export ADMIN_PASSWORD="your-admin-password"

# Run the migration script
node migrate-faqs-to-database.js

echo "✅ Migration completed!"
