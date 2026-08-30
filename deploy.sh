#!/usr/bin/env bash
set -e

# ==============================================================================
# Deployment / Update Script for Raspberry Pi & Linux Server
# ==============================================================================

echo "========================================================"
echo "🚀 Deploying / Updating NAS & Server Control Panel"
echo "========================================================"

# Ensure script runs from project root
cd "$(dirname "$0")"

# 1. Verify .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "👉 Please copy .env.example to .env and configure your NAS credentials:"
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

# 2. Pull latest changes from Git
echo "📥 Pulling latest git updates..."
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    git pull --rebase || {
        echo "⚠️ Git pull failed or has local conflicts. Continuing with local files..."
    }
else
    echo "ℹ️ Not a git repository or git not found. Skipping git pull."
fi

# 3. Build and launch Docker container
echo "🔨 Building and starting Docker container..."
docker compose down || true
docker compose up -d --build

# 4. Clean up unused build cache / dangling images
echo "🧹 Cleaning up dangling Docker images..."
docker image prune -f

# 5. Wait and verify health
echo "⏳ Waiting for service to start..."
sleep 4

APP_PORT=$(grep -E '^PORT=' .env | cut -d '=' -f2 | tr -d ' ' || echo "3000")
APP_PORT=${APP_PORT:-3000}

echo "🩺 Verifying health at http://localhost:${APP_PORT}/api/health..."
if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/api/health" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Deployment successful! Service is healthy and active."
        echo "🌐 Dashboard accessible at http://<RASPBERRY_PI_IP>:${APP_PORT}"
    else
        echo "⚠️ Warning: Health check returned HTTP ${HTTP_CODE}. Check container logs with:"
        echo "   docker compose logs -f"
    fi
else
    echo "✅ Containers launched. Verify logs with: docker compose logs -f"
fi
echo "========================================================"

