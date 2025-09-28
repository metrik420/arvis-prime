const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Import routes
const voiceRoutes = require('./routes/voice');
const homeAssistantRoutes = require('./routes/homeassistant');
const dockerRoutes = require('./routes/docker');
const securityRoutes = require('./routes/security');
const systemRoutes = require('./routes/system');
const mediaRoutes = require('./routes/media');

// Import services
const Orchestrator = require('./services/orchestrator');
const WebSocketManager = require('./websocket/manager');
const { setupLogging } = require('./utils/logger');

// Configure logger
const logger = setupLogging();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    ok: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(server, logger);

// Initialize Orchestrator
const orchestrator = new Orchestrator(wsManager, logger);

// API Routes
app.use('/api/voice', voiceRoutes(orchestrator, logger));
app.use('/api/home-assistant', homeAssistantRoutes(logger));
app.use('/api/docker', dockerRoutes(logger));
app.use('/api/security', securityRoutes(logger));
app.use('/api/system', systemRoutes(logger));
app.use('/api/media', mediaRoutes(logger));

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      websocket: wsManager.getConnectedClients().length > 0 ? 'connected' : 'waiting',
      orchestrator: 'running',
      redis: 'checking', // Will be updated by health checks
      database: 'checking'
    }
  };
  
  res.json(healthData);
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Jarvis Backend API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI Assistant Backend with IoT Integration',
    endpoints: {
      websocket: 'ws://localhost:3001/ws',
      health: '/health',
      voice: '/api/voice/*',
      homeAssistant: '/api/home-assistant/*',
      docker: '/api/docker/*',
      security: '/api/security/*',
      system: '/api/system/*',
      media: '/api/media/*'
    },
    documentation: 'https://github.com/yourusername/jarvis-hud/blob/main/backend/docs/API.md'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(err.status || 500).json({
    ok: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'GET /api',
      'WebSocket /ws'
    ]
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Jarvis Backend Server running on ${HOST}:${PORT}`);
  logger.info(`📡 WebSocket server ready for connections`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize system monitoring
  orchestrator.startSystemMonitoring();
  
  // Start WebSocket heartbeat
  wsManager.startHeartbeat();
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    
    // Close WebSocket connections
    wsManager.closeAllConnections();
    
    // Stop orchestrator
    orchestrator.shutdown();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason
  });
  process.exit(1);
});

module.exports = { app, server, wsManager, orchestrator };