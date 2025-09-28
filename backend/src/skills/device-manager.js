const fs = require('fs').promises;
const path = require('path');

class DeviceManagerSkill {
  constructor(config, logger) {
    this.config = config || {};
    this.logger = logger;
    this.devices = new Map();
    this.deviceProfiles = new Map();
    this.automationRules = [];
    this.deviceStates = new Map();
    
    // Device capability definitions
    this.capabilities = {
      'switch': ['on', 'off', 'toggle'],
      'dimmer': ['on', 'off', 'dim', 'brighten', 'set_level'],
      'thermostat': ['heat', 'cool', 'set_temperature', 'get_temperature'],
      'media_player': ['play', 'pause', 'stop', 'volume_up', 'volume_down', 'mute'],
      'camera': ['stream', 'snapshot', 'record', 'pan', 'tilt', 'zoom'],
      'sensor': ['read', 'calibrate'],
      'lock': ['lock', 'unlock', 'status'],
      'garage': ['open', 'close', 'status'],
      'speaker': ['play', 'pause', 'volume', 'next', 'previous'],
      'display': ['on', 'off', 'brightness', 'input'],
      'hvac': ['set_mode', 'set_temperature', 'set_fan']
    };
    
    this.initialize();
  }

  async initialize() {
    try {
      await this.loadDeviceProfiles();
      await this.loadAutomationRules();
      this.logger.info('🎛️ Device Manager skill initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Device Manager skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'register_device':
          return await this.registerDevice(args.device);
        case 'get_devices':
          return await this.getDevices(args.filter);
        case 'control_device':
          return await this.controlDevice(args.deviceId, args.command, args.params);
        case 'get_device_state':
          return await this.getDeviceState(args.deviceId);
        case 'create_automation':
          return await this.createAutomation(args.rule);
        case 'get_automations':
          return await this.getAutomations();
        case 'discover_capabilities':
          return await this.discoverDeviceCapabilities(args.deviceId);
        case 'bulk_control':
          return await this.bulkControl(args.devices, args.command);
        case 'get_device_history':
          return await this.getDeviceHistory(args.deviceId, args.hours);
        case 'create_scene':
          return await this.createScene(args.scene);
        case 'activate_scene':
          return await this.activateScene(args.sceneId);
        case 'sync_devices':
          return await this.syncWithDiscovery();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Device manager action ${action} failed:`, error.message);
      throw error;
    }
  }

  async registerDevice(deviceData) {
    try {
      const device = {
        id: deviceData.id || this.generateDeviceId(deviceData.ip, deviceData.type),
        ...deviceData,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        status: 'online',
        capabilities: this.inferCapabilities(deviceData),
        metadata: {
          ...deviceData.metadata,
          autoDiscovered: deviceData.autoDiscovered || false
        }
      };

      this.devices.set(device.id, device);
      
      // Initialize device state tracking
      this.deviceStates.set(device.id, {
        lastCommand: null,
        lastResponse: null,
        commandHistory: [],
        stateChanges: [],
        lastUpdate: new Date().toISOString()
      });

      await this.saveDeviceProfile(device);
      
      this.logger.info(`📱 Registered device: ${device.name || device.type} (${device.id})`);
      
      return {
        success: true,
        device: device,
        message: `Device ${device.name || device.id} registered successfully`
      };
    } catch (error) {
      throw new Error(`Device registration failed: ${error.message}`);
    }
  }

  inferCapabilities(deviceData) {
    const capabilities = new Set();
    
    // Infer from device type/classification
    const deviceType = deviceData.classification?.type?.toLowerCase() || deviceData.type?.toLowerCase();
    
    if (deviceType?.includes('light') || deviceType?.includes('bulb')) {
      capabilities.add('switch');
      if (deviceData.features?.dimmable) capabilities.add('dimmer');
    }
    
    if (deviceType?.includes('thermostat') || deviceType?.includes('hvac')) {
      capabilities.add('thermostat');
      capabilities.add('hvac');
    }
    
    if (deviceType?.includes('media') || deviceType?.includes('plex') || deviceType?.includes('chromecast')) {
      capabilities.add('media_player');
    }
    
    if (deviceType?.includes('camera') || deviceType?.includes('webcam')) {
      capabilities.add('camera');
    }
    
    if (deviceType?.includes('sensor')) {
      capabilities.add('sensor');
    }
    
    if (deviceType?.includes('lock')) {
      capabilities.add('lock');
    }
    
    if (deviceType?.includes('garage')) {
      capabilities.add('garage');
    }
    
    if (deviceType?.includes('speaker') || deviceType?.includes('echo') || deviceType?.includes('sonos')) {
      capabilities.add('speaker');
    }
    
    if (deviceType?.includes('tv') || deviceType?.includes('display') || deviceType?.includes('monitor')) {
      capabilities.add('display');
    }
    
    // Infer from open ports
    if (deviceData.openPorts) {
      if (deviceData.openPorts.includes(8008)) capabilities.add('media_player'); // Chromecast
      if (deviceData.openPorts.includes(554)) capabilities.add('camera'); // RTSP
      if (deviceData.openPorts.includes(1900)) capabilities.add('media_player'); // UPnP
    }
    
    return Array.from(capabilities);
  }

  async controlDevice(deviceId, command, params = {}) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Check if device supports the command
      const hasCapability = device.capabilities.some(cap => 
        this.capabilities[cap]?.includes(command)
      );

      if (!hasCapability) {
        throw new Error(`Device ${deviceId} does not support command: ${command}`);
      }

      // Execute command based on device type and protocol
      const result = await this.executeDeviceCommand(device, command, params);
      
      // Update device state
      this.updateDeviceState(deviceId, command, params, result);
      
      this.logger.info(`🎮 Controlled device ${device.name || deviceId}: ${command}`);
      
      return {
        success: true,
        deviceId: deviceId,
        command: command,
        params: params,
        result: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Device control failed: ${error.message}`);
    }
  }

  async executeDeviceCommand(device, command, params) {
    // Route to appropriate protocol handler
    switch (device.protocol) {
      case 'homeassistant':
        return await this.executeHomeAssistantCommand(device, command, params);
      case 'upnp':
        return await this.executeUpnpCommand(device, command, params);
      case 'http':
        return await this.executeHttpCommand(device, command, params);
      case 'mqtt':
        return await this.executeMqttCommand(device, command, params);
      default:
        // Try to infer protocol from device data
        if (device.webServices?.length > 0) {
          return await this.executeHttpCommand(device, command, params);
        }
        throw new Error(`Unsupported device protocol: ${device.protocol || 'unknown'}`);
    }
  }

  async executeHomeAssistantCommand(device, command, params) {
    // Integration with Home Assistant API
    const haUrl = process.env.HA_URL || 'http://homeassistant:8123';
    const haToken = process.env.HA_TOKEN;
    
    if (!haToken) {
      throw new Error('Home Assistant token not configured');
    }

    // Map commands to HA service calls
    const serviceMap = {
      'on': { domain: 'homeassistant', service: 'turn_on' },
      'off': { domain: 'homeassistant', service: 'turn_off' },
      'toggle': { domain: 'homeassistant', service: 'toggle' }
    };

    const serviceCall = serviceMap[command];
    if (!serviceCall) {
      throw new Error(`Command ${command} not mapped for Home Assistant`);
    }

    // Make API call to Home Assistant
    // This would be implemented with actual HTTP calls
    return {
      status: 'success',
      service: serviceCall,
      entity_id: device.entityId
    };
  }

  async executeHttpCommand(device, command, params) {
    // Generic HTTP device control
    const webService = device.webServices?.[0];
    if (!webService) {
      throw new Error('No web service available for HTTP command');
    }

    // This is a simplified example - real implementation would depend on device API
    const url = `http://${device.ip}:${webService.port}/api/${command}`;
    
    return {
      status: 'sent',
      url: url,
      method: 'POST',
      params: params
    };
  }

  async executeUpnpCommand(device, command, params) {
    // UPnP device control implementation
    return {
      status: 'upnp_command_sent',
      command: command,
      params: params
    };
  }

  async executeMqttCommand(device, command, params) {
    // MQTT device control implementation
    return {
      status: 'mqtt_published',
      topic: `devices/${device.id}/${command}`,
      payload: params
    };
  }

  updateDeviceState(deviceId, command, params, result) {
    const state = this.deviceStates.get(deviceId) || {};
    
    state.lastCommand = {
      command: command,
      params: params,
      result: result,
      timestamp: new Date().toISOString()
    };
    
    state.commandHistory = state.commandHistory || [];
    state.commandHistory.push(state.lastCommand);
    
    // Keep only last 100 commands
    if (state.commandHistory.length > 100) {
      state.commandHistory = state.commandHistory.slice(-100);
    }
    
    state.lastUpdate = new Date().toISOString();
    
    this.deviceStates.set(deviceId, state);
  }

  async bulkControl(deviceIds, command, params = {}) {
    try {
      const results = [];
      const promises = deviceIds.map(async (deviceId) => {
        try {
          const result = await this.controlDevice(deviceId, command, params);
          return { deviceId, success: true, result };
        } catch (error) {
          return { deviceId, success: false, error: error.message };
        }
      });

      const settled = await Promise.allSettled(promises);
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ 
            deviceId: deviceIds[index], 
            success: false, 
            error: result.reason.message 
          });
        }
      });

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        command: command,
        totalDevices: deviceIds.length,
        successCount: successCount,
        failureCount: deviceIds.length - successCount,
        results: results
      };
    } catch (error) {
      throw new Error(`Bulk control failed: ${error.message}`);
    }
  }

  async createAutomation(rule) {
    try {
      const automation = {
        id: this.generateAutomationId(),
        name: rule.name,
        trigger: rule.trigger,
        conditions: rule.conditions || [],
        actions: rule.actions,
        enabled: rule.enabled !== false,
        createdAt: new Date().toISOString(),
        lastTriggered: null
      };

      this.automationRules.push(automation);
      await this.saveAutomationRules();

      this.logger.info(`🤖 Created automation: ${automation.name}`);

      return {
        success: true,
        automation: automation
      };
    } catch (error) {
      throw new Error(`Automation creation failed: ${error.message}`);
    }
  }

  async createScene(sceneData) {
    try {
      const scene = {
        id: this.generateSceneId(),
        name: sceneData.name,
        description: sceneData.description || '',
        deviceStates: sceneData.deviceStates,
        createdAt: new Date().toISOString()
      };

      // Validate that all devices exist and support required commands
      for (const [deviceId, state] of Object.entries(scene.deviceStates)) {
        const device = this.devices.get(deviceId);
        if (!device) {
          throw new Error(`Device ${deviceId} not found`);
        }
      }

      // Save scene (in real implementation, this would be persisted)
      this.scenes = this.scenes || new Map();
      this.scenes.set(scene.id, scene);

      return {
        success: true,
        scene: scene
      };
    } catch (error) {
      throw new Error(`Scene creation failed: ${error.message}`);
    }
  }

  async activateScene(sceneId) {
    try {
      const scene = this.scenes?.get(sceneId);
      if (!scene) {
        throw new Error(`Scene ${sceneId} not found`);
      }

      const results = [];
      for (const [deviceId, deviceState] of Object.entries(scene.deviceStates)) {
        try {
          const result = await this.controlDevice(deviceId, deviceState.command, deviceState.params);
          results.push({ deviceId, success: true, result });
        } catch (error) {
          results.push({ deviceId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: true,
        sceneId: sceneId,
        sceneName: scene.name,
        totalDevices: Object.keys(scene.deviceStates).length,
        successCount: successCount,
        results: results
      };
    } catch (error) {
      throw new Error(`Scene activation failed: ${error.message}`);
    }
  }

  async syncWithDiscovery() {
    // This would integrate with the NetworkDiscoverySkill to auto-register discovered devices
    try {
      // Get discovered devices from network discovery
      // Auto-register devices that aren't already known
      // Update existing device information
      
      return {
        success: true,
        message: 'Device sync completed',
        newDevices: 0,
        updatedDevices: 0
      };
    } catch (error) {
      throw new Error(`Device sync failed: ${error.message}`);
    }
  }

  async getDevices(filter = {}) {
    const devices = Array.from(this.devices.values());
    
    let filteredDevices = devices;
    if (filter.type) {
      filteredDevices = filteredDevices.filter(d => d.type === filter.type);
    }
    if (filter.capability) {
      filteredDevices = filteredDevices.filter(d => d.capabilities.includes(filter.capability));
    }
    if (filter.status) {
      filteredDevices = filteredDevices.filter(d => d.status === filter.status);
    }

    return {
      success: true,
      devices: filteredDevices,
      totalCount: devices.length,
      filteredCount: filteredDevices.length
    };
  }

  generateDeviceId(ip, type) {
    return `${type}_${ip.replace(/\./g, '_')}_${Date.now()}`;
  }

  generateAutomationId() {
    return `automation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSceneId() {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async loadDeviceProfiles() {
    // Load saved device profiles from storage
    // Implementation would read from file system or database
  }

  async saveDeviceProfile(device) {
    // Save device profile to persistent storage
    // Implementation would write to file system or database
  }

  async loadAutomationRules() {
    // Load automation rules from storage
  }

  async saveAutomationRules() {
    // Save automation rules to persistent storage
  }

  async shutdown() {
    this.logger.info('Device Manager skill shutdown completed');
  }
}

module.exports = DeviceManagerSkill;
