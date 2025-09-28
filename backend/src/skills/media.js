const axios = require('axios');

class MediaSkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.plexUrl = process.env.PLEX_URL;
    this.plexToken = process.env.PLEX_TOKEN;
    this.clientIdentifier = process.env.PLEX_CLIENT_IDENTIFIER || 'jarvis-backend';
    
    this.plexClient = axios.create({
      baseURL: this.plexUrl,
      timeout: 10000,
      headers: {
        'X-Plex-Token': this.plexToken,
        'X-Plex-Client-Identifier': this.clientIdentifier,
        'Accept': 'application/json'
      }
    });
  }

  async initialize() {
    try {
      if (!this.plexUrl || !this.plexToken) {
        throw new Error('Plex URL and token are required');
      }
      
      // Test Plex connection
      await this.plexClient.get('/');
      this.logger.info('Media skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Media skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'play':
          return await this.playMedia(args.title, args.type);
        case 'pause':
          return await this.pausePlayback(args.sessionKey);
        case 'resume':
          return await this.resumePlayback(args.sessionKey);
        case 'stop':
          return await this.stopPlayback(args.sessionKey);
        case 'search':
          return await this.searchMedia(args.query, args.type);
        case 'get_sessions':
          return await this.getActiveSessions();
        case 'get_recent':
          return await this.getRecentlyAdded(args.limit);
        case 'get_libraries':
          return await this.getLibraries();
        case 'control_playback':
          return await this.controlPlayback(args.sessionKey, args.command);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Media action ${action} failed:`, error.message);
      throw error;
    }
  }

  async playMedia(title, type = null) {
    try {
      // Search for media
      const searchResults = await this.searchMedia(title, type);
      
      if (!searchResults.results || searchResults.results.length === 0) {
        return {
          success: false,
          message: `No media found for "${title}"`
        };
      }

      const media = searchResults.results[0];
      
      // For now, return the media info - actual playback would require
      // knowing which client to target
      return {
        success: true,
        message: `Found "${media.title}" (${media.year})`,
        media: {
          title: media.title,
          key: media.key,
          type: media.type,
          year: media.year,
          rating: media.rating,
          summary: media.summary
        }
      };
    } catch (error) {
      throw new Error(`Play media failed: ${error.message}`);
    }
  }

  async pausePlayback(sessionKey) {
    if (!sessionKey) {
      // Get active sessions and pause the first one
      const sessions = await this.getActiveSessions();
      if (sessions.sessions.length === 0) {
        return { success: false, message: 'No active playback sessions' };
      }
      sessionKey = sessions.sessions[0].sessionKey;
    }

    return await this.controlPlayback(sessionKey, 'pause');
  }

  async resumePlayback(sessionKey) {
    if (!sessionKey) {
      const sessions = await this.getActiveSessions();
      if (sessions.sessions.length === 0) {
        return { success: false, message: 'No active playback sessions' };
      }
      sessionKey = sessions.sessions[0].sessionKey;
    }

    return await this.controlPlayback(sessionKey, 'play');
  }

  async stopPlayback(sessionKey) {
    if (!sessionKey) {
      const sessions = await this.getActiveSessions();
      if (sessions.sessions.length === 0) {
        return { success: false, message: 'No active playback sessions' };
      }
      sessionKey = sessions.sessions[0].sessionKey;
    }

    return await this.controlPlayback(sessionKey, 'stop');
  }

  async searchMedia(query, type = null) {
    try {
      const response = await this.plexClient.get(`/search?query=${encodeURIComponent(query)}`);
      
      let results = response.data.MediaContainer.Metadata || [];
      
      // Filter by type if specified
      if (type) {
        results = results.filter(item => item.type === type);
      }

      return {
        success: true,
        query,
        results: results.map(item => ({
          key: item.key,
          title: item.title,
          type: item.type,
          year: item.year,
          rating: item.rating,
          summary: item.summary,
          thumb: item.thumb,
          librarySectionTitle: item.librarySectionTitle
        }))
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getActiveSessions() {
    try {
      const response = await this.plexClient.get('/status/sessions');
      
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
          state: session.Player?.state,
          address: session.Player?.address
        },
        media: {
          title: session.title,
          type: session.type,
          year: session.year,
          thumb: session.thumb,
          viewOffset: session.viewOffset,
          duration: session.duration,
          progress: session.viewOffset && session.duration ? 
            Math.round((session.viewOffset / session.duration) * 100) : 0
        }
      })) || [];

      return {
        success: true,
        sessions,
        count: sessions.length
      };
    } catch (error) {
      throw new Error(`Get sessions failed: ${error.message}`);
    }
  }

  async getRecentlyAdded(limit = 10) {
    try {
      const response = await this.plexClient.get(
        `/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}`
      );
      
      const items = response.data.MediaContainer.Metadata?.map(item => ({
        key: item.key,
        title: item.title,
        type: item.type,
        year: item.year,
        rating: item.rating,
        summary: item.summary,
        duration: item.duration,
        addedAt: item.addedAt,
        updatedAt: item.updatedAt,
        thumb: item.thumb,
        art: item.art
      })) || [];

      return {
        success: true,
        items,
        count: items.length
      };
    } catch (error) {
      throw new Error(`Get recently added failed: ${error.message}`);
    }
  }

  async getLibraries() {
    try {
      const response = await this.plexClient.get('/library/sections');
      
      const libraries = response.data.MediaContainer.Directory?.map(lib => ({
        key: lib.key,
        title: lib.title,
        type: lib.type,
        agent: lib.agent,
        scanner: lib.scanner,
        language: lib.language,
        refreshing: lib.refreshing,
        updatedAt: lib.updatedAt,
        createdAt: lib.createdAt
      })) || [];

      // Get item counts for each library
      const librariesWithCounts = await Promise.all(
        libraries.map(async (lib) => {
          try {
            const libResponse = await this.plexClient.get(`/library/sections/${lib.key}/all`);
            return {
              ...lib,
              count: libResponse.data.MediaContainer.totalSize || 0
            };
          } catch (error) {
            return { ...lib, count: 0 };
          }
        })
      );

      return {
        success: true,
        libraries: librariesWithCounts
      };
    } catch (error) {
      throw new Error(`Get libraries failed: ${error.message}`);
    }
  }

  async controlPlayback(sessionKey, command) {
    try {
      const validCommands = ['play', 'pause', 'stop', 'stepForward', 'stepBack', 'skipNext', 'skipPrevious'];
      
      if (!validCommands.includes(command)) {
        throw new Error(`Invalid playback command: ${command}`);
      }

      // Note: This simplified version doesn't handle client targeting properly
      // In a full implementation, you'd need to get the client identifier from the session
      await this.plexClient.get(`/player/playback/${command}?commandID=1`);

      return {
        success: true,
        message: `Playback command "${command}" sent successfully`,
        sessionKey,
        command
      };
    } catch (error) {
      throw new Error(`Control playback failed: ${error.message}`);
    }
  }

  async getMediaStats() {
    try {
      const libraries = await this.getLibraries();
      const sessions = await this.getActiveSessions();
      
      const stats = {
        totalLibraries: libraries.libraries.length,
        totalItems: libraries.libraries.reduce((sum, lib) => sum + lib.count, 0),
        activeSessions: sessions.count,
        libraryBreakdown: libraries.libraries.map(lib => ({
          name: lib.title,
          type: lib.type,
          count: lib.count
        }))
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      throw new Error(`Get media stats failed: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      const response = await this.plexClient.get('/');
      const serverInfo = response.data.MediaContainer;
      
      return {
        healthy: true,
        message: 'Plex Media Server connection OK',
        serverInfo: {
          friendlyName: serverInfo.friendlyName,
          version: serverInfo.version,
          platform: serverInfo.platform
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  async shutdown() {
    this.logger.info('Media skill shutting down');
  }
}

module.exports = MediaSkill;