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
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html/panel
COPY --from=frontend-builder /app/frontend/hackaton/dist /usr/share/nginx/html/hackaton
EXPOSE 80 8080
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

# Copy built frontend dist assets (available for static serving or shared volumes)
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=frontend-builder /app/frontend/hackaton/dist /app/frontend/hackaton/dist

# Expose backend API port
EXPOSE 5000

# Healthcheck configuration
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start production server
CMD ["node", "src/server.js"]
