#!/bin/sh

echo "==> Running Prisma DB push..."
cd /app

# Uruchom db push - kontynuuj nawet jeśli błąd (np. już zsynchronizowane)
prisma db push --skip-generate && echo "==> DB sync successful." || echo "==> Warning: prisma db push failed (may already be in sync)."

echo "==> Starting Next.js server..."
exec node server.js
