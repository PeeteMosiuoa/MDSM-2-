#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MDSM — Production deploy script
# Run on your server:  bash deploy.sh
#
# First-time setup:    bash deploy.sh --setup
# ─────────────────────────────────────────────────────────────────────────────
set -e

DEPLOY_DIR="/var/www/mdsm"
LOG_DIR="/var/log/mdsm"
REPO_URL="https://github.com/YOUR_ORG/YOUR_REPO.git"   # ← update this
BRANCH="main"

# ── Helper ────────────────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
die()   { echo -e "\033[1;31m[FAIL]\033[0m  $*"; exit 1; }

# ── First-time server setup ───────────────────────────────────────────────────
if [[ "$1" == "--setup" ]]; then
  info "Installing system dependencies..."
  apt-get update -qq
  apt-get install -y curl git nginx

  # Node.js 22 via NodeSource
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs

  # pnpm
  npm install -g pnpm pm2

  # PM2 log rotation
  pm2 install pm2-logrotate

  # Create dirs
  mkdir -p "$DEPLOY_DIR" "$LOG_DIR"

  info "Cloning repo..."
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"

  info "Setup complete. Now:"
  echo "  1. Copy .env.production.example → $DEPLOY_DIR/.env.production and fill in secrets"
  echo "  2. Run:  bash deploy.sh"
  exit 0
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
[[ -d "$DEPLOY_DIR" ]] || die "Deploy dir not found. Run: bash deploy.sh --setup"

info "Pulling latest code ($BRANCH)..."
cd "$DEPLOY_DIR"
git fetch origin
git reset --hard "origin/$BRANCH"

[[ -f "$DEPLOY_DIR/.env.production" ]] || die ".env.production not found in $DEPLOY_DIR"

info "Installing dependencies..."
pnpm install --frozen-lockfile --prod=false

info "Building Next.js..."
NODE_ENV=production pnpm build

info "Creating log dir..."
mkdir -p "$LOG_DIR"

info "Starting / reloading PM2..."
if pm2 describe mdsm > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
  pm2 save
fi

ok "Deploy complete!"
pm2 status mdsm
