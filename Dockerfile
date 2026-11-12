# ==============================================================================
# Multi-Stage Dockerfile for GDG On Campus Pamukkale Web Platform
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Base Development Runtime (used by compose.yaml for local development)
# ------------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS backend
COPY backend/package.json backend/package-lock.json ./backend/
RUN MONGOMS_DISABLE_POSTINSTALL=1 npm ci --prefix backend --no-audit --no-fund
COPY backend/src ./backend/src
COPY shared ./shared
WORKDIR /app/backend
EXPOSE 5000
CMD ["node_modules/.bin/nodemon", "--watch", "src", "--watch", "/app/shared", "--ext", "js,mjs,json", "src/server.js"]

FROM base AS panel
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public
EXPOSE 5174
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS hackaton
WORKDIR /app/frontend/hackaton
COPY frontend/hackaton/package.json frontend/hackaton/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/hackaton/index.html frontend/hackaton/vite.config.js ./
COPY frontend/hackaton/src ./src
COPY frontend/hackaton/public ./public
COPY shared /app/shared
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ------------------------------------------------------------------------------
# 2. Stage 1: Production Frontend Builder (Builds panel and hackaton)
# ------------------------------------------------------------------------------
FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /app

# Vite embeds VITE_* values at build time; runtime env cannot change them.
# Empty VITE_API_URL = same-origin /api/v1 through Nginx.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# Shared content models required during build
COPY shared ./shared

# Build Admin Panel
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend --no-audit --no-fund
COPY frontend ./frontend
RUN npm run build --prefix frontend

# Build Hackathon Showcase Site
COPY frontend/hackaton/package.json frontend/hackaton/package-lock.json ./frontend/hackaton/
RUN npm ci --prefix frontend/hackaton --no-audit --no-fund
COPY frontend/hackaton ./frontend/hackaton
RUN npm run build --prefix frontend/hackaton

# ------------------------------------------------------------------------------
# 3. Production Reverse Proxy & Static Web Serving (Nginx)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS reverse-proxy
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
# HTTPS virtual hosts: enabled at start-up only if /etc/nginx/certs has origin.pem/.key
COPY nginx/https.conf nginx/https-common.conf nginx/https-headers.conf /etc/nginx/
COPY --chmod=755 nginx/enable-https.sh /docker-entrypoint.d/40-enable-https.sh
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html/panel
COPY --from=frontend-builder /app/frontend/hackaton/dist /usr/share/nginx/html/hackaton
EXPOSE 80 443 8080
CMD ["nginx", "-g", "daemon off;"]

# ------------------------------------------------------------------------------
# 4. Stage 2: Production Node.js Runtime for Backend API
# ------------------------------------------------------------------------------
FROM node:24-bookworm-slim AS production
WORKDIR /app/backend
ENV NODE_ENV=production

# Install only production dependencies
COPY backend/package.json backend/package-lock.json ./
RUN MONGOMS_DISABLE_POSTINSTALL=1 npm ci --omit=dev --no-audit --no-fund

# Copy backend source code and shared models
COPY backend/src ./src
COPY shared /app/shared

# Static frontends are served by the reverse-proxy image only; the API image
# does not depend on frontend-builder (and its build args).

# Expose backend API port
EXPOSE 5000

# Healthcheck configuration
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start production server
CMD ["node", "src/server.js"]
