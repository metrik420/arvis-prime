const express = require('express');
const router = express.Router();

module.exports = (logger) => {
  // Import the network skill
  const NetworkSkill = require('../skills/network');
  const networkSkill = new NetworkSkill({}, logger);
  
  // Initialize the skill
  networkSkill.initialize();

  // Scan network for devices
  router.post('/scan', async (req, res) => {
    try {
      const { subnet, timeout } = req.body;
      
      const result = await networkSkill.execute('scan_network', {
        subnet: subnet,
        timeout: timeout || 5000
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Network scan failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get discovered devices
  router.get('/devices', async (req, res) => {
    try {
      const { type, vendor, ip } = req.query;
      const filter = {};
      
      if (type) filter.type = type;
      if (vendor) filter.vendor = vendor;
      if (ip) filter.ip = ip;
      
      const result = await networkSkill.execute('get_devices', { filter });
      
      res.json(result);
    } catch (error) {
      logger.error('Get devices failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get device details
  router.get('/devices/:ip', async (req, res) => {
    try {
      const { ip } = req.params;
      
      const result = await networkSkill.execute('get_device_info', { ip });
      
      res.json(result);
    } catch (error) {
      logger.error('Get device info failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Start continuous monitoring
  router.post('/monitoring/start', async (req, res) => {
    try {
      const { interval } = req.body;
      
      const result = await networkSkill.execute('start_monitoring', {
        interval: interval || 300000 // 5 minutes default
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Start monitoring failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Stop continuous monitoring
  router.post('/monitoring/stop', async (req, res) => {
    try {
      const result = await networkSkill.execute('stop_monitoring');
      
      res.json(result);
    } catch (error) {
      logger.error('Stop monitoring failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Classify all devices
  router.post('/classify', async (req, res) => {
    try {
      const result = await networkSkill.execute('classify_devices');
      
      res.json(result);
    } catch (error) {
      logger.error('Device classification failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // mDNS discovery
  router.post('/mdns', async (req, res) => {
    try {
      const result = await networkSkill.execute('mdns_scan');
      
      res.json(result);
    } catch (error) {
      logger.error('mDNS scan failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // UPnP discovery
  router.post('/upnp', async (req, res) => {
    try {
      const result = await networkSkill.execute('upnp_scan');
      
      res.json(result);
    } catch (error) {
      logger.error('UPnP scan failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  return router;
};