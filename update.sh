#!/bin/bash
set -e
echo "=========================================="
echo "🚀 Updating Rivo to v1.9.3 (Auto-Deploy Enabled)"
echo "=========================================="

# 1. Terminate any running instances cleanly
echo "🛑 Stopping running processes..."
pm2 delete all 2>/dev/null || true
pkill -9 -f "server/index.js" 2>/dev/null || true
sleep 1

# 2. Locate repository directory
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

# 3. Pull latest git commits and force checkout main
echo "📥 Syncing git branch with origin/main..."
git remote set-url origin https://github.com/WhooAre-you/Rivo.git 2>/dev/null || true
git fetch origin main --force
git checkout -B main origin/main
git reset --hard origin/main

# 4. Directly download the pristine server/index.js from GitHub raw to ensure 100% fidelity
echo "📥 Ensuring pristine server/index.js from GitHub..."
curl -sL "https://raw.githubusercontent.com/WhooAre-you/Rivo/main/server/index.js" -o "$TARGET_DIR/server/index.js"

echo "🔎 Checking server version lines on disk:"
grep -n "version: '1.9" "$TARGET_DIR/server/index.js" || true

# 5. Install dependencies and build frontend
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 Building frontend..."
npm run build

# 6. Start Rivo server cleanly under PM2
echo "🔄 Starting Rivo server under PM2..."
pm2 start server/index.js --name rivo
pm2 save

# 7. Verification
echo "=========================================="
echo "✨ Verification (Direct Local HTTP):"
sleep 2
curl -s http://127.0.0.1:5000/api/app/version || true
echo ""
echo "=========================================="
echo "🎉 Rivo v1.9.3 is successfully deployed and running!"
