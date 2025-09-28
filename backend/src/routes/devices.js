const express = require('express');
const router = express.Router();

module.exports = (orchestrator, logger) => {
  // Device management endpoints

  // Get all managed devices
  router.get('/', async (req, res) => {
    try {
      const { type, capability, status } = req.query;
      const filter = {};
      
      if (type) filter.type = type;
      if (capability) filter.capability = capability;
      if (status) filter.status = status;
      
      const result = await orchestrator.skills.devices.execute('get_devices', { filter });
      
      res.json(result);
    } catch (error) {
      logger.error('Get devices failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Register a new device
  router.post('/register', async (req, res) => {
    try {
      const result = await orchestrator.skills.devices.execute('register_device', {
        device: req.body
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Device registration failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Control a device
  router.post('/:deviceId/control', async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { command, params } = req.body;
      
      const result = await orchestrator.skills.devices.execute('control_device', {
        deviceId: deviceId,
        command: command,
        params: params || {}
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Device control failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get device state
  router.get('/:deviceId/state', async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      const result = await orchestrator.skills.devices.execute('get_device_state', {
        deviceId: deviceId
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Get device state failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Bulk control multiple devices
  router.post('/bulk-control', async (req, res) => {
    try {
      const { devices, command, params } = req.body;
      
      const result = await orchestrator.skills.devices.execute('bulk_control', {
        devices: devices,
        command: command,
        params: params || {}
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Bulk control failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Create automation rule
  router.post('/automations', async (req, res) => {
    try {
      const result = await orchestrator.skills.devices.execute('create_automation', {
        rule: req.body
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Automation creation failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get automations
  router.get('/automations', async (req, res) => {
    try {
      const result = await orchestrator.skills.devices.execute('get_automations');
      
      res.json(result);
    } catch (error) {
      logger.error('Get automations failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Create scene
  router.post('/scenes', async (req, res) => {
    try {
      const result = await orchestrator.skills.devices.execute('create_scene', {
        scene: req.body
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Scene creation failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Activate scene
  router.post('/scenes/:sceneId/activate', async (req, res) => {
    try {
      const { sceneId } = req.params;
      
      const result = await orchestrator.skills.devices.execute('activate_scene', {
        sceneId: sceneId
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Scene activation failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Sync devices with network discovery
  router.post('/sync', async (req, res) => {
    try {
      const result = await orchestrator.skills.devices.execute('sync_devices');
      
      res.json(result);
    } catch (error) {
      logger.error('Device sync failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  return router;
};