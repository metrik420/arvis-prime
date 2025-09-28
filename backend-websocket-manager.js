const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const winston = require('winston');

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.clients = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.logger.info('WebSocket server initialized');
  }

  verifyClient(info) {
    // Add authentication logic here if needed
    return true;
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      isAlive: true
    };

    this.clients.set(clientId, clientInfo);
    this.logger.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      message: 'Connected to Jarvis Backend',
      timestamp: new Date().toISOString(),
      clientId: clientId
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(clientId, message);
      } catch (error) {
        this.logger.error(`Invalid JSON from client ${clientId}:`, error);
        this.sendError(clientId, 'Invalid JSON format');
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.logger.error(`WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
    });

    // Heartbeat
    ws.on('pong', () => {
      clientInfo.isAlive = true;
    });
  }

  handleMessage(clientId, message) {
    this.logger.info(`Message from ${clientId}:`, message);

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      
      case 'voice_input':
        this.handleVoiceInput(clientId, message);
        break;
      
      case 'tool_request':
        this.handleToolRequest(clientId, message);
        break;
      
      case 'subscribe':
        this.handleSubscription(clientId, message);
        break;
      
      default:
        this.sendError(clientId, `Unknown message type: ${message.type}`);
    }
  }

  handleVoiceInput(clientId, message) {
    // Forward to orchestrator for processing
    this.emit('voice_input', {
      clientId,
      transcript: message.transcript,
      isPartial: message.isPartial,
      timestamp: message.timestamp
    });
  }

  handleToolRequest(clientId, message) {
    // Forward to orchestrator
    this.emit('tool_request', {
      clientId,
      tool: message.tool,
      args: message.args,
      requestId: message.requestId
    });
  }

  handleSubscription(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions = message.topics || [];
      this.logger.info(`Client ${clientId} subscribed to:`, client.subscriptions);
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error(`Failed to send message to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  sendToAll(message) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  sendToSubscribed(topic, message) {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions && client.subscriptions.includes(topic)) {
        this.sendToClient(clientId, message);
      }
    });
  }

  sendError(clientId, errorMessage) {
    this.sendToClient(clientId, {
      type: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  // Event emitter functionality
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // Heartbeat to detect dead connections
  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }
        
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000); // 30 seconds
  }

  getConnectedClients() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      ip: client.ip,
      connectedAt: client.connectedAt,
      subscriptions: client.subscriptions || []
    }));
  }
}

module.exports = WebSocketManager;