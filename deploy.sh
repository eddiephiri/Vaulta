#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Run this on the VPS after cloning the repo.
# Usage:  bash deploy.sh
# =============================================================================
set -euo pipefail

echo "── FleetFlow deploy ──────────────────────────────────────────────────────"

# 1. Pull latest code
echo "[1/3] Pulling latest code..."
git pull

# 2. Rebuild image with no cache (picks up all new env vars and code changes)
echo "[2/3] Building Docker image..."
docker compose build --no-cache

# 3. Restart container in detached mode
echo "[3/3] Starting container..."
docker compose up -d

echo ""
echo "✔  FleetFlow is running on http://$(hostname -I | awk '{print $1}')"
echo "    To view logs:  docker compose logs -f"
echo "    To stop:       docker compose down"
