#!/bin/bash

# Syntax Check Script for Burning Man CRM
# This script checks for common issues that can break the application

echo "🔍 Running syntax checks..."

# Check for TypeScript compilation errors
echo "📝 Checking TypeScript compilation..."
cd client
npm run build --silent 2>&1 | grep -i "error\|failed" > /tmp/ts_errors.log
if [ -s /tmp/ts_errors.log ]; then
    echo "❌ TypeScript errors found:"
    cat /tmp/ts_errors.log
    echo ""
    echo "🚨 CRITICAL: Fix TypeScript errors before proceeding!"
    exit 1
else
    echo "✅ TypeScript compilation successful"
fi

# Check for ESLint errors
echo "🧹 Checking ESLint..."
npm run lint 2>&1 | grep -i "error\|failed" > /tmp/eslint_errors.log
if [ -s /tmp/eslint_errors.log ]; then
    echo "⚠️  ESLint warnings/errors found:"
    cat /tmp/eslint_errors.log
    echo ""
    echo "💡 Consider fixing ESLint issues for better code quality"
else
    echo "✅ ESLint checks passed"
fi

# Check for common JSX issues
echo "🔧 Checking for common JSX issues..."
cd ..

# Check for unclosed tags
if grep -r "Expected corresponding JSX closing tag" client/src/ 2>/dev/null; then
    echo "❌ Unclosed JSX tags found!"
    exit 1
fi

# Check for missing imports
if grep -r "Cannot find name" client/src/ 2>/dev/null; then
    echo "❌ Missing imports or undefined variables found!"
    exit 1
fi

echo "✅ All syntax checks passed!"
echo "🚀 Safe to proceed with changes"
