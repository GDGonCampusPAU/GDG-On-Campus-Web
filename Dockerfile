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
