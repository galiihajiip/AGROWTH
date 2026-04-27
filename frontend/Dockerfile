# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Tooling kecil yang sering dibutuhkan saat npm install di alpine.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund


# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Re-use node_modules dari stage deps.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* HARUS tersedia saat build supaya nilainya ter-bake ke
# bundle client. Kalau token kosong, MapView dynamic-import dengan
# ssr:false tetap bisa build (token dicek di runtime, bukan build-time).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# next.config.mjs `output: "standalone"` menghasilkan
# .next/standalone/ + .next/static/ + public/ — semuanya yang
# dibutuhkan untuk run via `node server.js`.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `public/` tidak ada di repo ini (no static assets ekstra), jadi
# COPY-nya opsional (di-skip biar Dockerfile lebih sederhana).

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O - http://localhost:3000/ > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
