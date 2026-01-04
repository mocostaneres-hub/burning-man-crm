#!/bin/bash

# GitHub Integration Diagnostic Script
# Run this to diagnose why pushes aren't working

echo "=========================================="
echo "GitHub Integration Diagnostic"
echo "=========================================="
echo ""

echo "1. Git Remote Configuration:"
echo "----------------------------"
git remote -v
echo ""

echo "2. Current Branch Status:"
echo "------------------------"
git branch -vv
echo ""

echo "3. Git Status:"
echo "-------------"
git status
echo ""

echo "4. Unpushed Commits (if any):"
echo "-----------------------------"
git log origin/main..HEAD --oneline 2>&1 || echo "Cannot determine unpushed commits - may need to fetch first"
echo ""

echo "5. Last 3 Local Commits:"
echo "-----------------------"
git log --oneline -3
echo ""

echo "6. Testing GitHub SSH Connection:"
echo "--------------------------------"
ssh -T git@github.com 2>&1 | head -3
echo ""

echo "7. Git Config User:"
echo "------------------"
echo "Name: $(git config user.name)"
echo "Email: $(git config user.email)"
echo ""

echo "8. Attempting Push (with verbose):"
echo "----------------------------------"
git push -v origin main 2>&1
echo ""

echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Review any error messages above"
echo "2. If you see authentication errors, you may need to:"
echo "   - Regenerate GitHub Personal Access Token"
echo "   - Update SSH keys"
echo "   - Re-authenticate with GitHub"
echo ""

