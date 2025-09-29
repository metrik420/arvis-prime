const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Configuration file path
const CONFIG_FILE = path.join(__dirname, '../../data/jarvis-config.json');
const ENV_TEMPLATE_FILE = path.join(__dirname, '../../.env.example');

// Default configuration structure
const DEFAULT_CONFIG = {
  server: {
    NODE_ENV: 'development',
    PORT: '3001',
    HOST: '0.0.0.0',
    FRONTEND_URL: 'http://localhost:8080',
    JWT_SECRET: '',
    PIN_SALT: ''
  },
  homeassistant: {
    HA_URL: 'http://homeassistant.local:8123',
    HA_TOKEN: '',
    HA_TIMEOUT: '10000',
    ENABLE_WEBSOCKET: false
  },
  docker: {
    DOCKER_SOCKET: '/var/run/docker.sock',
    DOCKER_API_VERSION: '1.41',
    DOCKER_TIMEOUT: '10000',
    STATS_INTERVAL: '15000'
  },
  security: {
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    DISCORD_WEBHOOK: '',
    ENABLE_IP_MONITORING: true,
    SCAN_INTERVAL: '30000'
  },
  voice: {
    VOICE_MODEL_PATH: './models',
    VOICE_ENGINE: 'piper',
    VOICE_ID: 'en_GB-jenny_dioco-medium',
    SAMPLE_RATE: '22050',
    CHUNK_SIZE: '1024',
    ENABLE_NOISE_REDUCTION: false,
    OPENAI_API_KEY: ''
  },
  media: {
    PLEX_URL: 'http://plex.local:32400',
    PLEX_TOKEN: '',
    ENABLE_TRANSCODING: false,
    DEFAULT_QUALITY: '720p'
  },
  system: {
    METRICS_INTERVAL: '10000',
    ENABLE_GPU_MONITORING: false,
    ENABLE_TEMPERATURE_MONITORING: true,
    CPU_TEMP_THRESHOLD: '70',
    CPU_THRESHOLD: '85',
    MEMORY_THRESHOLD: '90',
    DISK_THRESHOLD: '95',
    LOG_LEVEL: 'info',
    LOG_FILE: './logs/jarvis.log'
  }
};

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load configuration file
async function loadConfig() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default config
    return DEFAULT_CONFIG;
  }
}

// Save configuration file
async function saveConfig(config) {
  await ensureDataDirectory();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Generate .env file from configuration
async function generateEnvFile(config) {
  const envLines = [];
  envLines.push('# Jarvis Backend Environment Configuration');
  envLines.push('# Generated automatically from configuration panel');
  envLines.push('');

  for (const [section, settings] of Object.entries(config)) {
    envLines.push(`# ${section.charAt(0).toUpperCase() + section.slice(1)} Configuration`);
    for (const [key, value] of Object.entries(settings)) {
      envLines.push(`${key}=${value}`);
    }
    envLines.push('');
  }

  const envFile = path.join(__dirname, '../../.env');
  await fs.writeFile(envFile, envLines.join('\n'));
}

// GET /api/config - Get current configuration
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      ok: true,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading configuration:', error);
    res.status(500).json({
      ok: false,
      message: 'Failed to load configuration',
      error: error.message
    });
  }
});

// POST /api/config - Save configuration
router.post('/', async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        ok: false,
        message: 'Configuration data is required'
      });
    }

    // Merge with default config to ensure all fields are present
    const mergedConfig = { ...DEFAULT_CONFIG };
    for (const [section, settings] of Object.entries(config)) {
      if (mergedConfig[section]) {
        mergedConfig[section] = { ...mergedConfig[section], ...settings };
      }
    }

    // Save configuration
    await saveConfig(mergedConfig);
    
    // Generate .env file
    await generateEnvFile(mergedConfig);

    res.json({
      ok: true,
      message: 'Configuration saved successfully',
      timestamp: new Date().toISOString(),
      config: mergedConfig
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({
      ok: false,
      message: 'Failed to save configuration',
      error: error.message
    });
  }
});

// GET /api/config/env - Get current environment variables (for debugging)
router.get('/env', (req, res) => {
  try {
    const envVars = {};
    
    // Only return non-sensitive environment variables
    const safeKeys = [
      'NODE_ENV', 'PORT', 'HOST', 'FRONTEND_URL',
      'HA_URL', 'DOCKER_SOCKET', 'PLEX_URL',
      'METRICS_INTERVAL', 'LOG_LEVEL', 'LOG_FILE'
    ];

    safeKeys.forEach(key => {
      if (process.env[key]) {
        envVars[key] = process.env[key];
      }
    });

    res.json({
      ok: true,
      env: envVars,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting environment:', error);
    res.status(500).json({
      ok: false,
      message: 'Failed to get environment variables',
      error: error.message
    });
  }
});

// POST /api/config/reset - Reset to default configuration
router.post('/reset', async (req, res) => {
  try {
    await saveConfig(DEFAULT_CONFIG);
    await generateEnvFile(DEFAULT_CONFIG);

    res.json({
      ok: true,
      message: 'Configuration reset to defaults',
      config: DEFAULT_CONFIG,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting configuration:', error);
    res.status(500).json({
      ok: false,
      message: 'Failed to reset configuration',
      error: error.message
    });
  }
});

module.exports = router;