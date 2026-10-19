#!/bin/bash
echo "=========================================="
echo "🚀 RIVO 1.9.3 DEPLOY & DIAGNOSTIC"
echo "=========================================="

TARGET_DIR="/home/ubuntu/rivo"
cd "$TARGET_DIR"

echo "=== 1. Check what process is on port 5000 ==="
sudo fuser 5000/tcp || true
pm2 list || true

echo "=== 2. Check current server/index.js on disk ==="
sed -n '90,110p' "$TARGET_DIR/server/index.js" || true

echo "=== 3. Stop PM2 and kill port 5000 ==="
pm2 delete all 2>/dev/null || true
sudo fuser -k 5000/tcp 2>/dev/null || true
pkill -9 -f "server/index.js" 2>/dev/null || true
sleep 1

echo "=== 4. Force pull main from GitHub ==="
git remote set-url origin https://github.com/WhooAre-you/Rivo.git 2>/dev/null || true
git fetch origin main --force
git checkout -B main origin/main
git reset --hard origin/main

echo "=== 5. Download pristine server/index.js bypassing cache ==="
curl -sL "https://raw.githubusercontent.com/WhooAre-you/Rivo/main/server/index.js?ts=$(date +%s)" -o "$TARGET_DIR/server/index.js"

echo "=== 6. Verify server/index.js on disk after download ==="
sed -n '90,110p' "$TARGET_DIR/server/index.js"

echo "=== 7. Start PM2 ==="
pm2 start server/index.js --name rivo
pm2 save

echo "=== 8. Verification (port 5000) ==="
sleep 2
curl -s http://127.0.0.1:5000/api/app/version
echo ""
echo "=========================================="
