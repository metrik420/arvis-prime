const axios = require('axios');

class HomeAssistantSkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseURL = process.env.HA_URL;
    this.token = process.env.HA_TOKEN;
    this.timeout = parseInt(process.env.HA_TIMEOUT) || 10000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize() {
    try {
      if (!this.baseURL || !this.token) {
        throw new Error('Home Assistant URL and token are required');
      }
      
      // Test connection
      await this.client.get('/api/');
      this.logger.info('Home Assistant skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Home Assistant skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'turn_on':
          return await this.turnOn(args.entity_id);
        case 'turn_off':
          return await this.turnOff(args.entity_id);
        case 'toggle':
          return await this.toggle(args.entity_id);
        case 'set_brightness':
          return await this.setBrightness(args.entity_id, args.brightness);
        case 'set_temperature':
          return await this.setTemperature(args.entity_id, args.temperature);
        case 'get_state':
          return await this.getState(args.entity_id);
        case 'get_entities':
          return await this.getEntities(args.domain);
        case 'call_service':
          return await this.callService(args.domain, args.service, args.service_data);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Home Assistant action ${action} failed:`, error.message);
      throw error;
    }
  }

  async turnOn(entityId) {
    const domain = entityId.split('.')[0];
    const response = await this.client.post(`/api/services/${domain}/turn_on`, {
      entity_id: entityId
    });
    return { success: true, message: `${entityId} turned on` };
  }

  async turnOff(entityId) {
    const domain = entityId.split('.')[0];
    const response = await this.client.post(`/api/services/${domain}/turn_off`, {
      entity_id: entityId
    });
    return { success: true, message: `${entityId} turned off` };
  }

  async toggle(entityId) {
    const domain = entityId.split('.')[0];
    const response = await this.client.post(`/api/services/${domain}/toggle`, {
      entity_id: entityId
    });
    return { success: true, message: `${entityId} toggled` };
  }

  async setBrightness(entityId, brightness) {
    const response = await this.client.post('/api/services/light/turn_on', {
      entity_id: entityId,
      brightness: Math.max(0, Math.min(255, brightness))
    });
    return { success: true, message: `${entityId} brightness set to ${brightness}` };
  }

  async setTemperature(entityId, temperature) {
    const response = await this.client.post('/api/services/climate/set_temperature', {
      entity_id: entityId,
      temperature: temperature
    });
    return { success: true, message: `${entityId} temperature set to ${temperature}°` };
  }

  async getState(entityId) {
    const response = await this.client.get(`/api/states/${entityId}`);
    return {
      success: true,
      entity_id: entityId,
      state: response.data.state,
      attributes: response.data.attributes,
      last_changed: response.data.last_changed,
      last_updated: response.data.last_updated
    };
  }

  async getEntities(domain = null) {
    const response = await this.client.get('/api/states');
    let entities = response.data;
    
    if (domain) {
      entities = entities.filter(entity => entity.entity_id.startsWith(`${domain}.`));
    }
    
    return {
      success: true,
      entities: entities.map(entity => ({
        entity_id: entity.entity_id,
        state: entity.state,
        friendly_name: entity.attributes.friendly_name,
        device_class: entity.attributes.device_class,
        last_changed: entity.last_changed
      }))
    };
  }

  async callService(domain, service, serviceData = {}) {
    const response = await this.client.post(`/api/services/${domain}/${service}`, serviceData);
    return {
      success: true,
      message: `Service ${domain}.${service} called successfully`,
      data: response.data
    };
  }

  async healthCheck() {
    try {
      await this.client.get('/api/');
      return { healthy: true, message: 'Home Assistant connection OK' };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }

  async shutdown() {
    this.logger.info('Home Assistant skill shutting down');
  }
}

module.exports = HomeAssistantSkill;