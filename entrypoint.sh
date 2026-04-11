#!/bin/sh

echo "==> Running Prisma DB push..."
# Uruchamiamy z /tmp, żeby Prisma nie próbowała ładować /app/prisma.config.ts.
# Globalny Prisma CLI czyta DATABASE_URL ze środowiska i schema bezpośrednio.
cd /tmp
prisma db push --schema=/app/prisma/schema.prisma --skip-generate \
  && echo "==> DB sync successful." \
  || echo "==> Warning: prisma db push failed - check DATABASE_URL env var."

echo "==> Starting Next.js server..."
cd /app
exec node server.js
