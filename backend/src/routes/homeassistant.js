const express = require('express');
const axios = require('axios');
const router = express.Router();

// Home Assistant API base configuration
const haConfig = {
  baseURL: process.env.HA_URL,
  timeout: parseInt(process.env.HA_TIMEOUT) || 10000,
  headers: {
    'Authorization': `Bearer ${process.env.HA_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

// Get all entities
router.get('/entities', async (req, res) => {
  try {
    const response = await axios.get('/api/states', haConfig);
    res.json({
      success: true,
      entities: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific entity state
router.get('/entity/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const response = await axios.get(`/api/states/${entityId}`, haConfig);
    res.json({
      success: true,
      entity: response.data
    });
  } catch (error) {
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Entity not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Call service
router.post('/service/:domain/:service', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const serviceData = req.body;

    const response = await axios.post(
      `/api/services/${domain}/${service}`,
      serviceData,
      haConfig
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle entity (lights, switches, etc.)
router.post('/toggle/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const domain = entityId.split('.')[0];
    
    const response = await axios.post(
      `/api/services/${domain}/toggle`,
      { entity_id: entityId },
      haConfig
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Turn on entity (for frontend API compatibility)
router.post('/turn-on', async (req, res) => {
  try {
    const { entityId } = req.body;
    const domain = entityId.split('.')[0];
    
    const response = await axios.post(
      `/api/services/${domain}/turn_on`,
      { entity_id: entityId },
      haConfig
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Turn off entity (for frontend API compatibility)
router.post('/turn-off', async (req, res) => {
  try {
    const { entityId } = req.body;
    const domain = entityId.split('.')[0];
    
    const response = await axios.post(
      `/api/services/${domain}/turn_off`,
      { entity_id: entityId },
      haConfig
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get history for entity
router.get('/history/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const { start_time, end_time } = req.query;
    
    let url = `/api/history/period/${start_time || ''}`;
    if (end_time) url += `/${end_time}`;
    
    const response = await axios.get(url, {
      ...haConfig,
      params: { filter_entity_id: entityId }
    });

    res.json({
      success: true,
      history: response.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;