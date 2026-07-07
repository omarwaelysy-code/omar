# Stage 1: Build Frontend
FROM node:22-slim AS builder

WORKDIR /app

# Skip puppeteer's bundled chromium download in build stage (not needed for vite build)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend (lint + vite build, no yarn dependency)
RUN npm run lint && npx vite build

# Stage 2: Production Server
FROM node:22-slim

# Install system dependencies, curl, and Chromium for Puppeteer
RUN apt-get update && apt-get install -y \
    curl \
    chromium \
    fonts-liberation \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libgles2 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Tell puppeteer to skip downloading its own Chromium (we use system Chromium from apt)
# and point it to the system chromium binary.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install production dependencies only (puppeteer won't try to download Chrome)
COPY package*.json ./
RUN npm install --omit=dev

# Copy build artifacts, public assets, and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/.env.example ./.env

# Install tsx to run server.ts directly in production (Node 22 supports TS, but tsx is safer for imports)
RUN npm install -g tsx

EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

CMD ["tsx", "server.ts"]
