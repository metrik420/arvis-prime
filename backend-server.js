const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

// Import routes
const voiceRoutes = require('./routes/voice');
const homeAssistantRoutes = require('./routes/homeassistant');
const dockerRoutes = require('./routes/docker');
const securityRoutes = require('./routes/security');
const systemRoutes = require('./routes/system');

// Import services
const Orchestrator = require('./services/orchestrator');
const WebSocketManager = require('./websocket/manager');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Initialize WebSocket
const wsManager = new WebSocketManager(server);

// Initialize Orchestrator
const orchestrator = new Orchestrator(wsManager, logger);

// Routes
app.use('/api/voice', voiceRoutes(orchestrator));
app.use('/api/home-assistant', homeAssistantRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Jarvis Backend Server running on port ${PORT}`);
  logger.info(`WebSocket server ready for connections`);
  
  // Initialize system monitoring
  orchestrator.startSystemMonitoring();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, server, wsManager, orchestrator };