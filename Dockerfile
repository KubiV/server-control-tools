# ==============================================================================
# Multi-stage Dockerfile for NAS & Server Control Panel
# Compatible with Raspberry Pi 5 (ARM64) and Apple Silicon / Linux (AMD64/ARM64)
# ==============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build SvelteKit application for production (node adapter)
ENV NODE_ENV=production
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime utilities (curl for healthcheck, perl for wakeonlan CLI utility)
RUN apk add --no-cache curl perl

# Copy wakeonlan CLI utility to system PATH
COPY scripts/wakeonlan /usr/local/bin/wakeonlan
RUN chmod +x /usr/local/bin/wakeonlan

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled SvelteKit server build from builder stage
COPY --from=builder /app/build ./build

# Expose web server port
EXPOSE 3000

# Run Node.js production server
CMD ["node", "build/index.js"]


