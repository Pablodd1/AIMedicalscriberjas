#!/bin/bash

# GitHub Push Script for Healthcare Voice Control System
# This script handles the authentication and push to GitHub

set -e

echo "🚀 Starting GitHub push process for Healthcare Voice Control System..."

# Check if GitHub token is available
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GitHub token not found. Please set GITHUB_TOKEN environment variable."
    exit 1
fi

# Create repository using GitHub API
echo "📁 Creating GitHub repository..."
RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "healthcare-voice-control-system",
    "description": "Production-ready hands-free voice control system for healthcare kiosks with HIPAA compliance",
    "private": false,
    "has_issues": true,
    "has_projects": true,
    "has_wiki": true,
    "auto_init": false
  }')

# Check if repository was created successfully
if echo "$RESPONSE" | grep -q ""Bad credentials""; then
    echo "❌ Invalid GitHub token. Please check your GITHUB_TOKEN environment variable."
    echo "You can create a personal access token at: https://github.com/settings/tokens"
    exit 1
elif echo "$RESPONSE" | grep -q ""already exists""; then
    echo "⚠️  Repository already exists. Proceeding with push..."
else
    echo "✅ Repository created successfully!"
fi

# Add remote and push
echo "📤 Pushing code to GitHub..."
git remote add origin https://${GITHUB_TOKEN}@github.com/Pablodd1/healthcare-voice-control-system.git

# Try to push, handle potential errors
if git push -u origin main; then
    echo "✅ Code pushed successfully!"
    echo "🌐 Repository URL: https://github.com/Pablodd1/healthcare-voice-control-system"
else
    echo "❌ Push failed. Trying alternative method..."
    
    # Remove and re-add remote with different format
    git remote remove origin
    git remote add origin https://github.com/Pablodd1/healthcare-voice-control-system.git
    
    # Try push with explicit credentials
    if git push -u origin main; then
        echo "✅ Code pushed successfully with alternative method!"
    else
        echo "❌ Push failed again. Manual intervention required."
        echo "Please check the GITHUB_PUSH_INSTRUCTIONS.md file for manual steps."
        exit 1
    fi
fi

echo "🎉 GitHub push completed successfully!"
echo "📋 Repository: https://github.com/Pablodd1/healthcare-voice-control-system"
echo "🔍 Branch: main"
echo "📊 Total commits: $(git rev-list --count HEAD)"
echo "📁 Total files: $(git ls-files | wc -l)"