# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f server/Dockerfile -t tta-api .

# ---- 1. frontend build ----
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- 2. API + static ----
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    SERVE_STATIC=true \
    STATIC_DIR=/app/dist \
    DB_PATH=data/portal.db \
    UPLOAD_DIR=data/uploads \
    BACKUP_DIR=backups
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./
# Shared rules imported as ../../src/... from server/src
COPY src/data /app/src/data
COPY src/utils /app/src/utils
COPY --from=web /app/dist /app/dist
RUN mkdir -p data/uploads backups && chown -R node:node /app/server/data /app/server/backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "src/index.js"]
