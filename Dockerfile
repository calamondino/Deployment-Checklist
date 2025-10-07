# ---------- Base ----------
FROM node:22-alpine AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Dependencies (prod) ----------
FROM base AS deps
# copy only files needed to install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---------- Builder ----------
FROM base AS builder
# we trenger devDeps for Next build + prisma generate
COPY package.json package-lock.json* ./
RUN npm ci

# copy resten for build
COPY . .

# Slå av Next telemetri i build
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma: bare generer klient (migrasjoner kjøres i runtime)
RUN npx prisma generate

# Build Next.js (standalone)
RUN npm run build

# ---------- Runtime ----------
FROM base AS runner
WORKDIR /app

# Ikke kjør som root i runtime
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001
USER nextjs

# Kopier prod-deps
COPY --from=deps /app/node_modules ./node_modules

# Kopier Next standalone + public + prisma
COPY --from=builder /app/.next/standalone ./ 
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Katalog for SQLite som volum
VOLUME ["/data"]

# Miljø — VELG én av disse (override i docker run / compose)
# SQLite-fil i /data (anbefalt i container)
ENV DATABASE_URL="file:/data/db.sqlite"
# Port Next bruker i standalone server.js
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Enkel entrypoint som sikrer schema -> db, deretter start
COPY <<'SH' /app/entrypoint.sh
#!/bin/sh
set -e

# Forsøk migrasjoner; om ingen migrasjoner, push schema (idempotent)
if npx prisma migrate deploy 2>/dev/null; then
  echo "✅ Prisma migrate deploy ok"
else
  echo "ℹ️  migrate deploy feilet eller ingen migrasjoner, prøver db push"
  npx prisma db push || true
fi

# Start Next standalone
exec node server.js
SH
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
