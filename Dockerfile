# Stage 1: Build Frontend
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Production Server
FROM node:22-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy build artifacts and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/.env.example ./.env

# Install tsx to run server.ts directly in production (Node 22 supports TS, but tsx is safer for imports)
RUN npm install -g tsx

EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

CMD ["tsx", "server.ts"]
