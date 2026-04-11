#!/bin/sh

echo "==> Running Prisma DB push..."
cd /tmp
prisma db push --schema=/app/prisma/schema.prisma --url="$DATABASE_URL" \
  && echo "==> DB sync successful." \
  || echo "==> Warning: prisma db push failed - check DATABASE_URL env var."

echo "==> Starting Next.js server..."
cd /app
exec node server.js
