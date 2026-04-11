#!/bin/sh
set -e

echo "==> Running Prisma DB push..."
cd /app
prisma db push --skip-generate

echo "==> Starting Next.js server..."
exec node server.js
