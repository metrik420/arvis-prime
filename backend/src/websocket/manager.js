const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class WebSocketManager {
  constructor(server, logger) {
    this.server = server;
    this.logger = logger;
    this.wss = null;
    this.clients = new Map();
    this.listeners = {};
    this.heartbeatInterval = null;
    
    this.initializeWebSocketServer();
  }

  initializeWebSocketServer() {
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    this.logger.info('📡 WebSocket server initialized on /ws');
  }

  verifyClient(info) {
    try {
      // Extract token from query parameters or headers
      const token = new URL(info.req.url, 'http://localhost').searchParams.get('token') ||
                   info.req.headers.authorization?.replace('Bearer ', '');
      
      // For development, allow connections without token
      if (process.env.NODE_ENV === 'development' && !token) {
        return true;
      }
      
      // Verify JWT token if provided
      if (token && process.env.JWT_SECRET) {
        jwt.verify(token, process.env.JWT_SECRET);
      }
      
      return true;
    } catch (error) {
      this.logger.warn('WebSocket authentication failed:', error.message);
      return false;
    }
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      isAlive: true,
      subscriptions: [],
      metadata: {}
    };

    this.clients.set(clientId, clientInfo);
    this.logger.info(`📱 WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

    // Send welcome message with client info
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        message: 'Connected to Jarvis Backend',
        clientId: clientId,
        serverTime: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', (code, reason) => this.handleDisconnect(clientId, code, reason));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      this.logger.debug(`📨 Message from ${clientId}:`, message);

      // Validate message structure
      if (!message.type) {
        return this.sendError(clientId, 'Message must have a type field');
      }

      // Update client last activity
      const client = this.clients.get(clientId);
      if (client) {
        client.lastActivity = new Date();
      }

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.handlePing(clientId, message);
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
        
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message);
          break;
        
        case 'authorization_response':
          this.handleAuthorizationResponse(clientId, message);
          break;
        
        case 'client_info':
          this.handleClientInfo(clientId, message);
          break;
        
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Invalid JSON from client ${clientId}:`, error);
      this.sendError(clientId, 'Invalid JSON format');
    }
  }

  handlePing(clientId, message) {
    this.sendToClient(clientId, { 
      type: 'pong', 
      timestamp: new Date().toISOString(),
      requestId: message.requestId
    });
  }

  handleVoiceInput(clientId, message) {
    const { transcript, isPartial, timestamp } = message.data || message;
    
    if (!transcript) {
      return this.sendError(clientId, 'Voice input must include transcript');
    }

    this.emit('voice_input', {
      clientId,
      transcript,
      isPartial: isPartial || false,
      timestamp: timestamp || new Date().toISOString()
    });
  }

  handleToolRequest(clientId, message) {
    const { tool, args, requestId } = message.data || message;
    
    if (!tool) {
      return this.sendError(clientId, 'Tool request must specify tool');
    }

    this.emit('tool_request', {
      clientId,
      tool,
      args: args || {},
      requestId: requestId || uuidv4()
    });
  }

  handleSubscription(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = message.data || message;
    if (Array.isArray(topics)) {
      // Add new subscriptions
      topics.forEach(topic => {
        if (!client.subscriptions.includes(topic)) {
          client.subscriptions.push(topic);
        }
      });
    } else if (typeof topics === 'string') {
      if (!client.subscriptions.includes(topics)) {
        client.subscriptions.push(topics);
      }
    }

    this.logger.info(`Client ${clientId} subscribed to:`, client.subscriptions);
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { subscriptions: client.subscriptions }
    });
  }

  handleUnsubscription(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = message.data || message;
    if (Array.isArray(topics)) {
      topics.forEach(topic => {
        const index = client.subscriptions.indexOf(topic);
        if (index > -1) {
          client.subscriptions.splice(index, 1);
        }
      });
    } else if (typeof topics === 'string') {
      const index = client.subscriptions.indexOf(topics);
      if (index > -1) {
        client.subscriptions.splice(index, 1);
      }
    }

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: { subscriptions: client.subscriptions }
    });
  }

  handleAuthorizationResponse(clientId, message) {
    this.emit('authorization_response', {
      clientId,
      ...message.data
    });
  }

  handleClientInfo(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.metadata = { ...client.metadata, ...message.data };
      this.logger.info(`Updated client info for ${clientId}:`, client.metadata);
    }
  }

  handleDisconnect(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      const duration = Date.now() - client.connectedAt.getTime();
      this.logger.info(`📱 Client ${clientId} disconnected after ${Math.round(duration/1000)}s (code: ${code})`);
      
      // Emit disconnect event
      this.emit('client_disconnect', { clientId, code, reason });
      
      // Remove client
      this.clients.delete(clientId);
    }
  }

  handleClientError(clientId, error) {
    this.logger.error(`WebSocket error for client ${clientId}:`, error);
    
    // Remove problematic client
    this.clients.delete(clientId);
  }

  handleServerError(error) {
    this.logger.error('WebSocket server error:', error);
  }

  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastPong = new Date();
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot send to client ${clientId}: not connected`);
      return false;
    }

    try {
      const payload = JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      });
      
      client.ws.send(payload);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  sendToAll(message) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  sendToSubscribed(topic, message) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.includes(topic)) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    });
    return sentCount;
  }

  broadcast(message, excludeClientId = null) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    });
    return sentCount;
  }

  sendError(clientId, errorMessage, errorCode = 'GENERAL_ERROR') {
    return this.sendToClient(clientId, {
      type: 'error',
      data: {
        message: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Event emitter functionality
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  generateClientId() {
    return 'client_' + uuidv4().split('-')[0] + '_' + Date.now();
  }

  // Heartbeat to detect dead connections
  startHeartbeat() {
    if (this.heartbeatInterval) {
      return; // Already started
    }

    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          this.logger.info(`Terminating dead connection: ${clientId}`);
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

    this.logger.info('❤️ WebSocket heartbeat started (30s interval)');
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.logger.info('Heartbeat stopped');
    }
  }

  getConnectedClients() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      ip: client.ip,
      userAgent: client.userAgent,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      subscriptions: client.subscriptions,
      metadata: client.metadata
    }));
  }

  getClientCount() {
    return this.clients.size;
  }

  getClientById(clientId) {
    return this.clients.get(clientId);
  }

  closeAllConnections() {
    this.logger.info(`Closing ${this.clients.size} WebSocket connections`);
    
    this.clients.forEach((client, clientId) => {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        this.logger.error(`Error closing connection ${clientId}:`, error);
      }
    });
    
    this.clients.clear();
    this.stopHeartbeat();
    
    if (this.wss) {
      this.wss.close();
    }
  }

  getStats() {
    const now = Date.now();
    let totalConnections = 0;
    let activeConnections = 0;
    let subscriptionCounts = {};

    this.clients.forEach(client => {
      totalConnections++;
      
      if (client.lastActivity && (now - client.lastActivity.getTime()) < 300000) { // 5 minutes
        activeConnections++;
      }
      
      client.subscriptions.forEach(sub => {
        subscriptionCounts[sub] = (subscriptionCounts[sub] || 0) + 1;
      });
    });

    return {
      totalConnections,
      activeConnections,
      subscriptionCounts,
      uptime: this.wss ? Date.now() - this.wss.startTime : 0
    };
  }
}

module.exports = WebSocketManager;