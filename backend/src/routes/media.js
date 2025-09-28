const express = require('express');
const axios = require('axios');
const router = express.Router();

// Plex API configuration
const plexConfig = {
  baseURL: process.env.PLEX_URL,
  timeout: 10000,
  headers: {
    'X-Plex-Token': process.env.PLEX_TOKEN,
    'X-Plex-Client-Identifier': process.env.PLEX_CLIENT_IDENTIFIER || 'jarvis-backend',
    'Accept': 'application/json'
  }
};

// Get Plex server status
router.get('/plex/status', async (req, res) => {
  try {
    const response = await axios.get('/', plexConfig);
    res.json({
      success: true,
      server: {
        friendlyName: response.data.MediaContainer.friendlyName,
        version: response.data.MediaContainer.version,
        machineIdentifier: response.data.MediaContainer.machineIdentifier,
        platform: response.data.MediaContainer.platform
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to connect to Plex server' });
  }
});

// Get all libraries
router.get('/plex/libraries', async (req, res) => {
  try {
    const response = await axios.get('/library/sections', plexConfig);
    const libraries = response.data.MediaContainer.Directory.map(lib => ({
      key: lib.key,
      title: lib.title,
      type: lib.type,
      agent: lib.agent,
      scanner: lib.scanner,
      language: lib.language,
      refreshing: lib.refreshing,
      updatedAt: lib.updatedAt
    }));

    res.json({
      success: true,
      libraries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recently added items
router.get('/plex/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const response = await axios.get(`/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}`, plexConfig);
    
    const items = response.data.MediaContainer.Metadata?.map(item => ({
      key: item.key,
      title: item.title,
      type: item.type,
      year: item.year,
      summary: item.summary,
      rating: item.rating,
      duration: item.duration,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
      thumb: item.thumb,
      art: item.art
    })) || [];

    res.json({
      success: true,
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search media
router.get('/plex/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const response = await axios.get(`/search?query=${encodeURIComponent(query)}`, plexConfig);
    
    const results = response.data.MediaContainer.Metadata?.map(item => ({
      key: item.key,
      title: item.title,
      type: item.type,
      year: item.year,
      summary: item.summary,
      rating: item.rating,
      thumb: item.thumb,
      librarySectionTitle: item.librarySectionTitle
    })) || [];

    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active sessions
router.get('/plex/sessions', async (req, res) => {
  try {
    const response = await axios.get('/status/sessions', plexConfig);
    
    const sessions = response.data.MediaContainer.Metadata?.map(session => ({
      sessionKey: session.sessionKey,
      user: {
        title: session.User?.title,
        thumb: session.User?.thumb
      },
      player: {
        title: session.Player?.title,
        product: session.Player?.product,
        platform: session.Player?.platform,
        state: session.Player?.state
      },
      media: {
        title: session.title,
        type: session.type,
        year: session.year,
        thumb: session.thumb,
        viewOffset: session.viewOffset,
        duration: session.duration
      }
    })) || [];

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Control playback
router.post('/plex/control/:sessionKey/:command', async (req, res) => {
  try {
    const { sessionKey, command } = req.params;
    
    // Validate command
    const validCommands = ['play', 'pause', 'stop', 'stepForward', 'stepBack', 'skipNext', 'skipPrevious'];
    if (!validCommands.includes(command)) {
      return res.status(400).json({ error: 'Invalid command' });
    }

    await axios.get(`/player/playback/${command}?commandID=1`, {
      ...plexConfig,
      headers: {
        ...plexConfig.headers,
        'X-Plex-Target-Client-Identifier': sessionKey
      }
    });

    res.json({
      success: true,
      message: `Command ${command} sent successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get library statistics
router.get('/plex/stats', async (req, res) => {
  try {
    const librariesResponse = await axios.get('/library/sections', plexConfig);
    const libraries = librariesResponse.data.MediaContainer.Directory;
    
    const stats = await Promise.all(
      libraries.map(async (lib) => {
        try {
          const libResponse = await axios.get(`/library/sections/${lib.key}/all`, plexConfig);
          return {
            title: lib.title,
            type: lib.type,
            count: libResponse.data.MediaContainer.totalSize || 0
          };
        } catch (e) {
          return {
            title: lib.title,
            type: lib.type,
            count: 0
          };
        }
      })
    );

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;