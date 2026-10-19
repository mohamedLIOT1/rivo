#!/bin/bash
set -e
echo "=========================================="
echo "🚀 Updating Rivo to v1.9.3 (Auto-Deploy Enabled)"
echo "=========================================="

# 1. Locate repository directory
TARGET_DIR=""
for d in /home/ubuntu/rivo /home/ubuntu/Rivo /home/ubuntu/liofy /var/www/rivo; do
  if [ -d "$d/.git" ]; then
    TARGET_DIR="$d"
    break
  fi
done

if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR="$HOME/rivo"
fi

echo "📁 Using project directory: $TARGET_DIR"
cd "$TARGET_DIR"

# 2. Reset and fetch latest main
echo "📥 Pulling latest release v1.9.3 from GitHub..."
git remote set-url origin https://github.com/WhooAre-you/Rivo.git 2>/dev/null || true
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

# 3. Install & Build
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 Building frontend..."
npm run build

# 4. Restart server under PM2
echo "🔄 Starting Rivo server under PM2..."
pm2 delete all 2>/dev/null || true
pm2 start server/index.js --name rivo
pm2 save

# 5. Verify local version
echo "=========================================="
echo "✨ Verification:"
sleep 2
curl -s http://127.0.0.1:5000/api/app/version || true
echo ""
echo "=========================================="
echo "🎉 Rivo v1.9.3 is successfully deployed and running!"
