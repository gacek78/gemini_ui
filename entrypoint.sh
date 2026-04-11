#!/bin/sh
set -e

echo "==> Running Prisma DB push..."
cd /app
node_modules/.bin/prisma db push --skip-generate

echo "==> Starting Next.js server..."
exec node server.js
