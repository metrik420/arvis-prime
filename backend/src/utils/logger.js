const winston = require('winston');
const path = require('path');

const setupLogging = () => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'jarvis-backend' },
    transports: [
      // Write all logs to console in development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
      // Write all logs to file
      new winston.transports.File({ 
        filename: process.env.LOG_FILE || './logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: process.env.LOG_FILE || './logs/combined.log' 
      })
    ],
  });

  // Handle uncaught exceptions
  logger.exceptions.handle(
    new winston.transports.File({ filename: './logs/exceptions.log' })
  );

  return logger;
};

module.exports = { setupLogging };