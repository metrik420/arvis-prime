# Multi-stage build for production-optimized Jarvis Backend
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p data logs models config

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    sqlite \
    dumb-init \
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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]