#!/usr/bin/env bash
# Setup script for new developers
set -euo pipefail

echo "🔧 Setting up E-CLAT development environment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy env files if missing
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "📝 Created apps/api/.env from .env.example — edit with your local config"
fi

echo ""
echo "✅ Setup complete! Next steps:"
echo "  1. Edit apps/api/.env with your database credentials"
echo "  2. Run: npm run db:migrate:dev -w @e-clat/data"
echo "  3. Run: npm run dev -w @e-clat/api"
