# Jarvis Backend - AI Assistant Server

Production-ready Node.js backend for the Jarvis HUD system with voice processing, IoT integration, and real-time communication.

## 🚀 Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

## 🏗 Architecture

```
Frontend (React HUD) ←→ WebSocket/REST ←→ Backend Services ←→ IoT Devices
```

### Core Components

- **Orchestrator** - Central intelligence coordinator
- **WebSocket Manager** - Real-time HUD communication  
- **Skills System** - Modular IoT integrations
- **Voice Engine** - ASR/TTS processing
- **Security Layer** - Authorization and audit logging

## 📁 Project Structure

```
backend/
├── src/
│   ├── server.js              # Main Express server
│   ├── services/
│   │   ├── orchestrator.js    # Central coordinator
│   │   └── voice-processor.js # Voice handling
│   ├── skills/                # IoT integration modules
│   │   ├── homeassistant.js   # Smart home control
│   │   ├── docker.js          # Container management
│   │   ├── security.js        # Security operations
│   │   ├── media.js           # Plex integration
│   │   └── system.js          # System monitoring
│   ├── websocket/
│   │   └── manager.js         # WebSocket handling
│   ├── routes/                # REST API endpoints
│   ├── middleware/            # Auth & validation
│   └── utils/                 # Helper functions
├── docs/                      # Detailed documentation
├── config/                    # Configuration files
├── data/                      # Database and storage
├── logs/                      # Application logs
├── models/                    # Voice models
├── docker-compose.yml         # Container orchestration
└── Dockerfile                 # Production image
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:8080

# Home Assistant
HA_URL=http://homeassistant.local:8123
HA_TOKEN=your-long-lived-access-token

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# Security
JWT_SECRET=your-jwt-secret
PIN_SALT=your-pin-salt
```

### Skill Configuration

Edit `config/skills.yaml` to configure integrations:

```yaml
homeassistant:
  base_url: ${HA_URL}
  token: ${HA_TOKEN}
  timeout: 10000

docker:
  socket: ${DOCKER_SOCKET}
  
security:
  telegram_bot: ${TELEGRAM_BOT_TOKEN}
  discord_webhook: ${DISCORD_WEBHOOK}
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production (Docker)
```bash
docker-compose up -d
```

### Manual Production
```bash
npm install --production
npm start
```

## 📡 API Endpoints

### WebSocket
- `ws://localhost:3001/ws` - Real-time communication

### REST API
- `GET /api/system/metrics` - System performance
- `POST /api/voice/process` - Voice command processing
- `GET /api/home-assistant/devices` - Device list
- `POST /api/home-assistant/control` - Device control
- `GET /api/docker/containers` - Container status
- `POST /api/security/ban-ip` - IP blocking

## 🔒 Security Features

- **Voice Authentication** - PIN/TOTP verification
- **Role-Based Access** - User permission system
- **Audit Logging** - Complete action history
- **Rate Limiting** - DoS protection
- **Input Validation** - XSS/injection prevention

## 🧩 Skills System

Each skill is a modular service handling specific integrations:

### Home Assistant
- Device control (lights, locks, climate)
- Scene activation (Night Mode, Movie Night)
- Sensor monitoring
- Alarm system integration

### Docker Management
- Container health monitoring
- Graceful restarts (gated)
- Resource usage tracking
- Service dependency management

### Security Operations
- IP threat intelligence
- Automated blocking (router, fail2ban)
- Real-time threat monitoring
- Notification integration

### Media Control
- Plex search and playback
- Multi-room audio control
- Scene integration
- Remote control

### System Monitoring
- CPU, memory, disk usage
- Temperature monitoring
- Network statistics
- Process management

## 🎤 Voice Processing

### Speech Recognition (ASR)
- Local: faster-whisper (GPU accelerated)
- Cloud fallback: OpenAI Whisper API
- Real-time streaming with VAD

### Text-to-Speech (TTS)
- Local: Coqui XTTS v2 (British voice)
- Fallback: Piper TTS
- Interrupt capability (barge-in)

### Intent Recognition
- Local LLM: Ollama (Llama/Mixtral)
- Cloud fallback: OpenAI/Claude
- Structured tool calling

## 🔄 WebSocket Protocol

### Client → Server
```json
{
  "type": "voice_input",
  "transcript": "Turn on living room lights",
  "isPartial": false,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Server → Client
```json
{
  "type": "tool_result",
  "data": {
    "tool": "homeassistant",
    "action": "turn_on",
    "result": { "ok": true, "message": "Lights activated" }
  }
}
```

## 📊 Monitoring

### Health Checks
- `/health` - Service status
- Container health monitoring
- Automatic restart on failure

### Logging
- Structured JSON logging
- Audit trail for all actions
- Error tracking and alerts

### Metrics
- Real-time system metrics
- Performance monitoring
- Resource usage tracking

## 🛠 Development

### Adding New Skills

1. Create skill file in `src/skills/`
2. Implement the base skill interface
3. Add configuration to `config/skills.yaml`
4. Register in orchestrator
5. Add tests

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
```

### Linting
```bash
npm run lint          # Check code style
npm run lint:fix      # Auto-fix issues
```

## 📚 Documentation

- `docs/API.md` - Complete API documentation
- `docs/SKILLS.md` - Skills development guide
- `docs/DEPLOYMENT.md` - Production deployment
- `docs/VOICE.md` - Voice processing setup
- `docs/SECURITY.md` - Security implementation

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Check CORS configuration
- Verify frontend URL in environment
- Check firewall/proxy settings

**Voice Processing Errors**
- Ensure GPU drivers installed
- Check model file paths
- Verify microphone permissions

**Skill Integration Failures**
- Validate API tokens
- Check network connectivity
- Review service logs

### Debug Mode
```bash
NODE_ENV=development DEBUG=jarvis:* npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Follow coding standards
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for the future of AI assistance** 🤖