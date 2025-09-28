# Raspberry Pi 4 - ARM64 optimized build for backend
FROM arm64v8/node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install Pi-specific build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    git

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies with Pi optimizations
RUN npm ci --silent

# Copy backend source code
COPY backend/ .

# Create necessary directories
RUN mkdir -p data logs models config

# Production stage optimized for Pi
FROM arm64v8/node:18-alpine AS production

# Install Pi runtime dependencies
RUN apk add --no-cache \
    curl \
    sqlite \
    dumb-init \
    htop \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S jarvis -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=jarvis:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=jarvis:nodejs /app/src ./src
COPY --from=builder --chown=jarvis:nodejs /app/package.json ./
COPY --from=builder --chown=jarvis:nodejs /app/data ./data
COPY --from=builder --chown=jarvis:nodejs /app/logs ./logs
COPY --from=builder --chown=jarvis:nodejs /app/models ./models
COPY --from=builder --chown=jarvis:nodejs /app/config ./config

# Create volume mount points
VOLUME ["/app/data", "/app/logs", "/app/models"]

# Switch to non-root user
USER jarvis

# Expose port
EXPOSE 3001

# Pi-optimized health check
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling on Pi
ENTRYPOINT ["dumb-init", "--"]

# Start with Pi-optimized settings
CMD ["node", "--max-old-space-size=512", "src/server.js"]