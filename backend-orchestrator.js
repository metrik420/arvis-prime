const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const winston = require('winston');

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
    this.policies = this.loadPolicies();
    
    this.initializeSkills();
    this.setupEventHandlers();
    
    this.logger.info('Orchestrator initialized');
  }

  initializeSkills() {
    this.skills = {
      homeassistant: new HomeAssistantSkill(),
      docker: new DockerSkill(),
      security: new SecuritySkill(),
      voice: new VoiceSkill(),
      media: new MediaSkill(),
      system: new SystemSkill()
    };
    
    this.logger.info('Skills initialized:', Object.keys(this.skills));
  }

  setupEventHandlers() {
    this.wsManager.on('voice_input', this.handleVoiceInput.bind(this));
    this.wsManager.on('tool_request', this.handleToolRequest.bind(this));
  }

  loadPolicies() {
    return {
      riskyActions: [
        'security.*',
        'docker.restart',
        'homeassistant.arm_*',
        'homeassistant.unlock_*',
        'wireguard.*'
      ],
      safeActions: [
        'system.status',
        'homeassistant.get_*',
        'media.*',
        'voice.*'
      ],
      requirePin: [
        'security.*',
        'docker.restart',
        'homeassistant.arm_*'
      ],
      requireTotp: [
        'security.ban_ip',
        'wireguard.*'
      ]
    };
  }

  async handleVoiceInput(data) {
    const { clientId, transcript, isPartial, timestamp } = data;
    
    // Broadcast transcript to HUD
    this.wsManager.sendToClient(clientId, {
      type: 'transcript',
      data: { transcript, isPartial, timestamp }
    });

    // Process complete utterances only
    if (!isPartial && transcript.trim()) {
      await this.processIntent(clientId, transcript);
    }
  }

  async processIntent(clientId, transcript) {
    try {
      this.logger.info(`Processing intent for client ${clientId}: "${transcript}"`);
      
      // Simple intent extraction (in production, use NLP)
      const intent = this.extractIntent(transcript);
      
      this.wsManager.sendToClient(clientId, {
        type: 'intent',
        data: intent
      });

      // Execute the intent
      if (intent.tool && intent.action) {
        await this.executeIntent(clientId, intent);
      } else {
        this.wsManager.sendToClient(clientId, {
          type: 'error',
          message: 'Could not understand the command',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Intent processing error:', error);
      this.wsManager.sendToClient(clientId, {
        type: 'error',
        message: 'Failed to process command',
        timestamp: new Date().toISOString()
      });
    }
  }

  extractIntent(transcript) {
    const text = transcript.toLowerCase();
    
    // Home Assistant intents
    if (text.includes('light') || text.includes('lamp')) {
      if (text.includes('turn on') || text.includes('on')) {
        return { tool: 'homeassistant', action: 'turn_on', entity: 'light' };
      }
      if (text.includes('turn off') || text.includes('off')) {
        return { tool: 'homeassistant', action: 'turn_off', entity: 'light' };
      }
    }
    
    // System monitoring
    if (text.includes('status') || text.includes('health')) {
      if (text.includes('container') || text.includes('docker')) {
        return { tool: 'docker', action: 'status' };
      }
      return { tool: 'system', action: 'status' };
    }
    
    // Security commands
    if (text.includes('ban') && text.includes('ip')) {
      const ipMatch = text.match(/(\d+\.\d+\.\d+\.\d+)/);
      return { 
        tool: 'security', 
        action: 'ban_ip', 
        args: { ip: ipMatch ? ipMatch[1] : null }
      };
    }
    
    // Scene commands
    if (text.includes('night mode')) {
      return { tool: 'homeassistant', action: 'activate_scene', args: { scene: 'night_mode' } };
    }
    
    if (text.includes('movie night')) {
      return { tool: 'homeassistant', action: 'activate_scene', args: { scene: 'movie_night' } };
    }
    
    // Docker commands
    if (text.includes('restart') && text.includes('container')) {
      return { tool: 'docker', action: 'restart', args: { container: 'auto-detect' } };
    }
    
    return { tool: null, action: null, confidence: 0 };
  }

  async executeIntent(clientId, intent) {
    const { tool, action, args = {} } = intent;
    
    // Check if action requires authorization
    const requiresAuth = this.requiresAuthorization(tool, action);
    
    if (requiresAuth) {
      const authResult = await this.handleAuthorization(clientId, intent);
      if (!authResult.authorized) {
        return;
      }
    }
    
    // Execute the skill
    try {
      const skill = this.skills[tool];
      if (!skill) {
        throw new Error(`Unknown skill: ${tool}`);
      }
      
      this.wsManager.sendToClient(clientId, {
        type: 'tool_executing',
        data: { tool, action, args }
      });
      
      const result = await skill.execute(action, args);
      
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
      
    } catch (error) {
      this.logger.error(`Skill execution error:`, error);
      
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
    
    return this.policies.riskyActions.some(pattern => {
      if (pattern.endsWith('*')) {
        return actionPath.startsWith(pattern.slice(0, -1));
      }
      return actionPath === pattern;
    });
  }

  async handleAuthorization(clientId, intent) {
    const { tool, action } = intent;
    const actionPath = `${tool}.${action}`;
    
    const requiresPin = this.policies.requirePin.some(pattern => 
      pattern.endsWith('*') ? actionPath.startsWith(pattern.slice(0, -1)) : actionPath === pattern
    );
    
    const requiresTotp = this.policies.requireTotp.some(pattern => 
      pattern.endsWith('*') ? actionPath.startsWith(pattern.slice(0, -1)) : actionPath === pattern
    );
    
    // Request authorization from client
    this.wsManager.sendToClient(clientId, {
      type: 'authorization_required',
      data: {
        tool,
        action,
        requiresPin,
        requiresTotp,
        message: `This action requires authorization: ${tool}.${action}`
      }
    });
    
    // In a real implementation, wait for PIN/TOTP response
    // For now, assume authorized after showing the dialog
    return { authorized: true };
  }

  async handleToolRequest(data) {
    const { clientId, tool, args, requestId } = data;
    
    try {
      const result = await this.executeToolRequest(tool, args);
      
      this.wsManager.sendToClient(clientId, {
        type: 'tool_response',
        data: { requestId, result },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.wsManager.sendToClient(clientId, {
        type: 'tool_error',
        data: { requestId, error: error.message },
        timestamp: new Date().toISOString()
      });
    }
  }

  async executeToolRequest(toolPath, args) {
    const [skillName, action] = toolPath.split('.');
    const skill = this.skills[skillName];
    
    if (!skill) {
      throw new Error(`Unknown skill: ${skillName}`);
    }
    
    return await skill.execute(action, args);
  }

  logAuditEntry(clientId, tool, action, args, result) {
    const entry = {
      timestamp: new Date().toISOString(),
      clientId,
      tool,
      action,
      args,
      success: result.ok !== false,
      result: result.ok !== false ? 'success' : result.message
    };
    
    this.logger.info('Audit entry:', entry);
    
    // Broadcast to subscribed clients
    this.wsManager.sendToSubscribed('audit', {
      type: 'audit_entry',
      data: entry
    });
  }

  startSystemMonitoring() {
    // Start periodic system monitoring
    setInterval(() => {
      this.broadcastSystemMetrics();
    }, 5000); // Every 5 seconds
    
    this.logger.info('System monitoring started');
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
}

module.exports = Orchestrator;