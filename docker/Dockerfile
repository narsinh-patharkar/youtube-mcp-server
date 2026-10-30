# =============================================================================
# Production Dockerfile - Multi-stage build
# =============================================================================

# ---- Base Stage ----
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    tini \
    python3 \
    py3-pip \
    ffmpeg \
    && pip install --no-cache-dir yt-dlp \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

# ---- Builder Stage ----
FROM base AS builder

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig*.json ./

# Install all dependencies (including dev)
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Copy source code
COPY src ./src

# Build
RUN pnpm run build

# ---- Runner Stage ----
FROM base AS runner

ENV NODE_ENV=production

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port (for HTTP/SSE transport)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./dist/main.js').healthCheck?.()" || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]

# Default command (stdio transport)
CMD ["node", "dist/main.js"]