# Jarvis Backend Setup Guide

This guide will help you set up the Node.js backend for your Jarvis HUD system.

## Architecture Overview

```
Frontend (Lovable/GitHub) ↔ WebSocket/REST API ↔ Backend Services ↔ IoT Devices
```

## Quick Start

1. Clone this backend structure to a new directory:
```bash
mkdir jarvis-backend
cd jarvis-backend
```

2. Copy the files from this setup into your backend directory

3. Install dependencies:
```bash
npm install
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your specific settings
```

5. Start development:
```bash
npm run dev
```

6. Production deployment:
```bash
docker-compose up -d
```

## Environment Configuration

Required environment variables:
- `HA_TOKEN` - Home Assistant Long-Lived Access Token
- `HA_URL` - Home Assistant URL (http://homeassistant:8123)
- `DOCKER_SOCKET` - Docker socket path (/var/run/docker.sock)
- `NPM_TOKEN` - Nginx Proxy Manager API token
- `PLEX_TOKEN` - Plex authentication token
- `VOICE_MODEL_PATH` - Path to voice models
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `PIN_SALT` - Salt for PIN hashing

## API Endpoints

### WebSocket
- `ws://localhost:3001/ws` - Real-time communication with HUD

### REST API
- `GET /api/system/metrics` - System performance data
- `POST /api/voice/process` - Voice command processing
- `GET /api/home-assistant/devices` - HA device list
- `POST /api/home-assistant/control` - Device control
- `GET /api/docker/containers` - Container status
- `POST /api/docker/restart/:id` - Restart container
- `POST /api/security/ban-ip` - Ban IP address
- `GET /api/security/threats` - Threat status

## Skills System

Each skill is a modular service:
- `skills/homeassistant.js` - Smart home control
- `skills/docker.js` - Container management  
- `skills/security.js` - Security operations
- `skills/voice.js` - Voice processing
- `skills/media.js` - Plex control
- `skills/system.js` - System monitoring

## Security Features

- Voice authentication with PIN/TOTP
- Request rate limiting
- Input validation and sanitization
- Audit logging for all actions
- Role-based access control

## Docker Deployment

The included docker-compose.yml provides:
- Node.js backend service
- Redis for caching/sessions
- Nginx reverse proxy
- Volume mounts for Docker socket
- Health checks and auto-restart

## Integration with Frontend

Your Lovable frontend will connect to:
- WebSocket: `ws://your-server:3001/ws`
- API Base: `http://your-server:3001/api`

Update the frontend WebSocket connection in the JarvisHUD component to point to your server.