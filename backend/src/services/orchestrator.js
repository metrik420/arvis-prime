const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const winston = require('winston');
const cron = require('node-cron');
const YAML = require('yaml');
const fs = require('fs').promises;
const path = require('path');

// Import skills
const HomeAssistantSkill = require('../skills/homeassistant');
const DockerSkill = require('../skills/docker');
const SecuritySkill = require('../skills/security');
const VoiceSkill = require('../skills/voice');
const MediaSkill = require('../skills/media');
const SystemSkill = require('../skills/system');

class Orchestrator {
  constructor(wsManager, logger) {
    this.wsManager = wsManager;
    this.logger = logger;
    this.skills = {};
    this.sessions = new Map();
    this.policies = null;
    this.config = null;
    this.isShuttingDown = false;
    
    this.initializeOrchestrator();
  }

  async initializeOrchestrator() {
    try {
      await this.loadConfiguration();
      this.initializeSkills();
      this.setupEventHandlers();
      this.scheduleTasks();
      
      this.logger.info('🧠 Orchestrator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  async loadConfiguration() {
    try {
      // Load policies configuration
      const policiesPath = path.join(__dirname, '../../config/policies.yaml');
      const policiesContent = await fs.readFile(policiesPath, 'utf8');
      this.policies = YAML.parse(policiesContent);
      
      // Load skills configuration
      const skillsPath = path.join(__dirname, '../../config/skills.yaml');
      const skillsContent = await fs.readFile(skillsPath, 'utf8');
      this.config = YAML.parse(skillsContent);
      
      this.logger.info('Configuration loaded successfully');
    } catch (error) {
      this.logger.warn('Using default configuration:', error.message);
      this.policies = this.getDefaultPolicies();
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultPolicies() {
    return {
      risk_rules: [
        { match: 'security.*', require: ['pin', 'totp'] },
        { match: 'docker.restart', require: ['pin'] },
        { match: 'homeassistant.arm_*', require: ['pin'] },
        { match: 'homeassistant.unlock_*', require: ['pin', 'totp'] },
        { match: 'wireguard.*', require: ['pin', 'totp'] },
        { match: 'system.shutdown', require: ['pin', 'totp'] }
      ],
      safe_rules: [
        { match: 'search_rag.*' },
        { match: 'personal_os.*' },
        { match: 'docker.status' },
        { match: 'homeassistant.get_*' },
        { match: 'system.metrics' },
        { match: 'media.*' }
      ],
      confirm_style: 'ask_risky_only',
      max_retry_attempts: 3,
      session_timeout: 1800000 // 30 minutes
    };
  }

  getDefaultConfig() {
    return {
      homeassistant: {
        base_url: process.env.HA_URL || 'http://homeassistant:8123',
        token: process.env.HA_TOKEN,
        timeout: 10000
      },
      docker: {
        socket: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
      },
      security: {
        telegram_bot: process.env.TELEGRAM_BOT_TOKEN,
        discord_webhook: process.env.DISCORD_WEBHOOK
      },
      voice: {
        model_path: process.env.VOICE_MODEL_PATH || './models',
        openai_key: process.env.OPENAI_API_KEY
      },
      system: {
        metrics_interval: parseInt(process.env.SYSTEM_METRICS_INTERVAL) || 5000
      }
    };
  }

  initializeSkills() {
    try {
      this.skills = {
        homeassistant: new HomeAssistantSkill(this.config.homeassistant, this.logger),
        docker: new DockerSkill(this.config.docker, this.logger),
        security: new SecuritySkill(this.config.security, this.logger),
        voice: new VoiceSkill(this.config.voice, this.logger),
        media: new MediaSkill(this.config.media, this.logger),
        system: new SystemSkill(this.config.system, this.logger)
      };
      
      this.logger.info('Skills initialized:', Object.keys(this.skills));
    } catch (error) {
      this.logger.error('Failed to initialize skills:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.wsManager.on('voice_input', this.handleVoiceInput.bind(this));
    this.wsManager.on('tool_request', this.handleToolRequest.bind(this));
    this.wsManager.on('authorization_response', this.handleAuthorizationResponse.bind(this));
    this.wsManager.on('client_disconnect', this.handleClientDisconnect.bind(this));
  }

  scheduleTasks() {
    // Daily system health check
    cron.schedule('0 8 * * *', () => {
      this.performDailyHealthCheck();
    });
    
    // Hourly cleanup of expired sessions
    cron.schedule('0 * * * *', () => {
      this.cleanupExpiredSessions();
    });
    
    // Weekly security audit
    cron.schedule('0 2 * * 0', () => {
      this.performSecurityAudit();
    });
  }

  async handleVoiceInput(data) {
    const { clientId, transcript, isPartial, timestamp } = data;
    
    try {
      // Broadcast transcript to HUD for real-time display
      this.wsManager.sendToClient(clientId, {
        type: 'transcript',
        data: { transcript, isPartial, timestamp }
      });

      // Process complete utterances only
      if (!isPartial && transcript.trim()) {
        await this.processIntent(clientId, transcript);
      }
    } catch (error) {
      this.logger.error('Voice input handling error:', error);
      this.sendError(clientId, 'Failed to process voice input');
    }
  }

  async processIntent(clientId, transcript) {
    try {
      this.logger.info(`🎯 Processing intent for client ${clientId}: "${transcript}"`);
      
      // Extract intent using NLP (simplified for demo)
      const intent = await this.extractIntent(transcript);
      
      // Broadcast intent recognition
      this.wsManager.sendToClient(clientId, {
        type: 'intent',
        data: {
          ...intent,
          originalText: transcript,
          confidence: intent.confidence || 0.8
        }
      });

      // Execute the intent if valid
      if (intent.tool && intent.action) {
        await this.executeIntent(clientId, intent);
      } else {
        this.sendError(clientId, 'Could not understand the command. Please try rephrasing.');
      }
    } catch (error) {
      this.logger.error('Intent processing error:', error);
      this.sendError(clientId, 'Failed to process command');
    }
  }

  async extractIntent(transcript) {
    const text = transcript.toLowerCase().trim();
    
    // Enhanced intent recognition with better pattern matching
    const intentPatterns = {
      // Home Assistant patterns
      lights: {
        patterns: [/turn (on|off) (?:the )?(.+?) light/i, /(light|lights) (on|off)/i],
        handler: (matches) => ({
          tool: 'homeassistant',
          action: matches[1] === 'on' ? 'turn_on' : 'turn_off',
          args: { entity_type: 'light', entity: matches[2] || 'all' },
          confidence: 0.9
        })
      },
      
      // System monitoring
      status: {
        patterns: [/(status|health) (?:of )?(.+)/i, /how (?:is|are) (.+)/i],
        handler: (matches) => {
          if (matches[2]?.includes('container') || matches[2]?.includes('docker')) {
            return { tool: 'docker', action: 'status', confidence: 0.85 };
          }
          return { tool: 'system', action: 'status', confidence: 0.8 };
        }
      },
      
      // Security operations
      security: {
        patterns: [/ban (?:ip )?(\d+\.\d+\.\d+\.\d+)/i, /block (.+)/i],
        handler: (matches) => ({
          tool: 'security',
          action: 'ban_ip',
          args: { ip: matches[1] },
          confidence: 0.95
        })
      },
      
      // Scene activation
      scenes: {
        patterns: [/(night mode|movie night|work focus|away mode)/i],
        handler: (matches) => ({
          tool: 'homeassistant',
          action: 'activate_scene',
          args: { scene: matches[1].toLowerCase().replace(' ', '_') },
          confidence: 0.9
        })
      },
      
      // Docker management
      docker: {
        patterns: [/restart (.+?) container/i, /(stop|start) (.+)/i],
        handler: (matches) => ({
          tool: 'docker',
          action: matches[1] || 'restart',
          args: { container: matches[2] || matches[1] },
          confidence: 0.85
        })
      },
      
      // Media control
      media: {
        patterns: [/(play|pause|stop) (.+)/i, /search (?:for )?(.+) (?:on|in) plex/i],
        handler: (matches) => ({
          tool: 'media',
          action: matches[1] || 'search',
          args: { query: matches[2] },
          confidence: 0.8
        })
      }
    };
    
    // Try to match patterns
    for (const [category, config] of Object.entries(intentPatterns)) {
      for (const pattern of config.patterns) {
        const match = text.match(pattern);
        if (match) {
          return config.handler(match);
        }
      }
    }
    
    // Fallback: return low-confidence generic intent
    return {
      tool: null,
      action: null,
      confidence: 0,
      error: 'No matching intent pattern found'
    };
  }

  async executeIntent(clientId, intent) {
    const { tool, action, args = {} } = intent;
    
    try {
      // Check if action requires authorization
      const authRequired = this.requiresAuthorization(tool, action);
      
      if (authRequired.required) {
        const authResult = await this.handleAuthorization(clientId, intent, authRequired);
        if (!authResult.authorized) {
          return; // Authorization failed or pending
        }
      }
      
      // Execute the skill
      await this.executeSkill(clientId, tool, action, args);
      
    } catch (error) {
      this.logger.error(`Intent execution error:`, error);
      this.sendError(clientId, `Failed to execute ${tool}.${action}: ${error.message}`);
    }
  }

  async executeSkill(clientId, tool, action, args) {
    const skill = this.skills[tool];
    if (!skill) {
      throw new Error(`Unknown skill: ${tool}`);
    }
    
    // Notify HUD that tool is executing
    this.wsManager.sendToClient(clientId, {
      type: 'tool_executing',
      data: { tool, action, args }
    });
    
    try {
      const result = await skill.execute(action, args);
      
      // Send successful result to HUD
      this.wsManager.sendToClient(clientId, {
        type: 'tool_result',
        data: {
          tool,
          action,
          result,
          timestamp: new Date().toISOString()
        }
      });
      
      // Log audit entry
      this.logAuditEntry(clientId, tool, action, args, result);
      
      // Broadcast system updates if relevant
      if (tool === 'system' || tool === 'docker') {
        this.broadcastSystemMetrics();
      }
      
    } catch (error) {
      this.logger.error(`Skill execution error for ${tool}.${action}:`, error);
      
      this.wsManager.sendToClient(clientId, {
        type: 'tool_error',
        data: {
          tool,
          action,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  requiresAuthorization(tool, action) {
    const actionPath = `${tool}.${action}`;
    
    for (const rule of this.policies.risk_rules) {
      const pattern = rule.match;
      const isMatch = pattern.endsWith('*') 
        ? actionPath.startsWith(pattern.slice(0, -1))
        : actionPath === pattern;
        
      if (isMatch) {
        return {
          required: true,
          requiresPin: rule.require.includes('pin'),
          requiresTotp: rule.require.includes('totp')
        };
      }
    }
    
    return { required: false };
  }

  async handleAuthorization(clientId, intent, authRequired) {
    const { tool, action } = intent;
    const sessionId = this.generateSessionId();
    
    // Store pending authorization
    this.sessions.set(sessionId, {
      clientId,
      intent,
      authRequired,
      timestamp: Date.now(),
      attempts: 0
    });
    
    // Request authorization from client
    this.wsManager.sendToClient(clientId, {
      type: 'authorization_required',
      data: {
        sessionId,
        tool,
        action,
        requiresPin: authRequired.requiresPin,
        requiresTotp: authRequired.requiresTotp,
        message: `Authorization required for: ${tool}.${action}`,
        timeout: 60000 // 1 minute timeout
      }
    });
    
    return { authorized: false, pending: true };
  }

  async handleAuthorizationResponse(data) {
    const { clientId, sessionId, pin, totp } = data;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.clientId !== clientId) {
      this.sendError(clientId, 'Invalid authorization session');
      return;
    }
    
    try {
      let authorized = true;
      
      // Verify PIN if required
      if (session.authRequired.requiresPin) {
        const validPin = await this.verifyPin(pin);
        if (!validPin) {
          authorized = false;
        }
      }
      
      // Verify TOTP if required
      if (session.authRequired.requiresTotp) {
        const validTotp = await this.verifyTotp(totp);
        if (!validTotp) {
          authorized = false;
        }
      }
      
      if (authorized) {
        // Remove session and execute intent
        this.sessions.delete(sessionId);
        
        this.wsManager.sendToClient(clientId, {
          type: 'authorization_success',
          data: { sessionId }
        });
        
        await this.executeSkill(
          clientId,
          session.intent.tool,
          session.intent.action,
          session.intent.args
        );
      } else {
        session.attempts++;
        
        if (session.attempts >= this.policies.max_retry_attempts) {
          this.sessions.delete(sessionId);
          this.sendError(clientId, 'Maximum authorization attempts exceeded');
        } else {
          this.sendError(clientId, `Authorization failed. ${this.policies.max_retry_attempts - session.attempts} attempts remaining.`);
        }
      }
    } catch (error) {
      this.logger.error('Authorization error:', error);
      this.sessions.delete(sessionId);
      this.sendError(clientId, 'Authorization failed due to system error');
    }
  }

  async verifyPin(pin) {
    // In production, compare against stored hash
    const storedHash = process.env.USER_PIN_HASH || '$2a$10$example.hash';
    return bcrypt.compare(pin, storedHash);
  }

  async verifyTotp(token) {
    // In production, use stored secret
    const secret = process.env.USER_TOTP_SECRET || 'EXAMPLE_SECRET_KEY';
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2
    });
  }

  async handleToolRequest(data) {
    const { clientId, tool, args, requestId } = data;
    
    try {
      const [skillName, action] = tool.split('.');
      const result = await this.executeToolRequest(skillName, action, args);
      
      this.wsManager.sendToClient(clientId, {
        type: 'tool_response',
        data: { requestId, result },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Tool request error:', error);
      this.wsManager.sendToClient(clientId, {
        type: 'tool_error',
        data: { requestId, error: error.message },
        timestamp: new Date().toISOString()
      });
    }
  }

  async executeToolRequest(skillName, action, args) {
    const skill = this.skills[skillName];
    
    if (!skill) {
      throw new Error(`Unknown skill: ${skillName}`);
    }
    
    return await skill.execute(action, args);
  }

  handleClientDisconnect(data) {
    const { clientId } = data;
    
    // Clean up any pending sessions for this client
    for (const [sessionId, session] of this.sessions) {
      if (session.clientId === clientId) {
        this.sessions.delete(sessionId);
        this.logger.info(`Cleaned up session ${sessionId} for disconnected client ${clientId}`);
      }
    }
  }

  logAuditEntry(clientId, tool, action, args, result) {
    const entry = {
      timestamp: new Date().toISOString(),
      clientId,
      tool,
      action,
      args: JSON.stringify(args),
      success: result.ok !== false,
      result: result.ok !== false ? 'success' : result.message,
      duration: result.duration || null
    };
    
    this.logger.info('📋 Audit entry:', entry);
    
    // Broadcast to subscribed clients
    this.wsManager.sendToSubscribed('audit', {
      type: 'audit_entry',
      data: entry
    });
  }

  startSystemMonitoring() {
    if (this.systemMonitoringInterval) {
      return; // Already started
    }
    
    const interval = this.config.system?.metrics_interval || 5000;
    
    this.systemMonitoringInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.broadcastSystemMetrics();
      }
    }, interval);
    
    this.logger.info(`📊 System monitoring started (${interval}ms interval)`);
  }

  async broadcastSystemMetrics() {
    try {
      const metrics = await this.skills.system.execute('get_metrics');
      
      this.wsManager.sendToSubscribed('system_metrics', {
        type: 'system_metrics',
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to broadcast system metrics:', error);
    }
  }

  async performDailyHealthCheck() {
    this.logger.info('🏥 Performing daily health check');
    
    try {
      // Check all skills health
      const healthResults = {};
      
      for (const [skillName, skill] of Object.entries(this.skills)) {
        try {
          if (skill.healthCheck) {
            healthResults[skillName] = await skill.healthCheck();
          } else {
            healthResults[skillName] = { status: 'unknown', message: 'No health check available' };
          }
        } catch (error) {
          healthResults[skillName] = { status: 'error', message: error.message };
        }
      }
      
      // Broadcast health status
      this.wsManager.sendToAll({
        type: 'daily_health_check',
        data: {
          timestamp: new Date().toISOString(),
          results: healthResults
        }
      });
      
    } catch (error) {
      this.logger.error('Daily health check failed:', error);
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const timeout = this.policies.session_timeout;
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.timestamp > timeout) {
        this.sessions.delete(sessionId);
        this.logger.info(`Cleaned up expired session: ${sessionId}`);
      }
    }
  }

  async performSecurityAudit() {
    this.logger.info('🔒 Performing weekly security audit');
    
    try {
      if (this.skills.security && this.skills.security.performAudit) {
        const auditResults = await this.skills.security.performAudit();
        
        this.wsManager.sendToSubscribed('security', {
          type: 'security_audit',
          data: auditResults,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Security audit failed:', error);
    }
  }

  sendError(clientId, message) {
    this.wsManager.sendToClient(clientId, {
      type: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  }

  generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  shutdown() {
    this.logger.info('🔄 Shutting down orchestrator');
    
    this.isShuttingDown = true;
    
    // Clear intervals
    if (this.systemMonitoringInterval) {
      clearInterval(this.systemMonitoringInterval);
    }
    
    // Clear all sessions
    this.sessions.clear();
    
    // Shutdown skills
    for (const skill of Object.values(this.skills)) {
      if (skill.shutdown) {
        skill.shutdown();
      }
    }
    
    this.logger.info('Orchestrator shutdown complete');
  }
}

module.exports = Orchestrator;