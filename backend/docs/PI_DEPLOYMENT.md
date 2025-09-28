# Jarvis HUD - Raspberry Pi 4 Deployment Guide

Complete guide for deploying Jarvis HUD on Raspberry Pi 4 with optimal performance and IoT integration.

## 🍓 Why Raspberry Pi 4?

The Pi 4 is perfect for Jarvis HUD as an IoT hub:
- **ARM64 architecture** - Fully supported
- **4GB+ RAM** - Sufficient for Docker containers  
- **GPIO pins** - Direct hardware control
- **Always-on** - Perfect for voice assistant
- **Low power** - Energy efficient
- **Network connected** - Central hub location

## 📋 Prerequisites

### Hardware Requirements
- **Raspberry Pi 4** (4GB+ RAM recommended)
- **MicroSD card** (32GB+ Class 10)
- **USB microphone** (for voice input)
- **HDMI display** (for HUD interface)
- **Ethernet/WiFi** connection
- **Power supply** (official Pi 4 power supply)

### Optional Hardware
- **USB speaker** (for TTS output)
- **Case with fan** (for cooling)
- **GPIO sensors** (temperature, motion, etc.)

## 🚀 Quick Setup

### 1. Flash Raspberry Pi OS
```bash
# Use Raspberry Pi Imager
# Select: Raspberry Pi OS (64-bit)
# Enable SSH in advanced options
```

### 2. Run Auto-Setup Script
```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/yourusername/jarvis-hud/main/backend/scripts/setup-pi.sh | bash

# Or manually:
wget https://raw.githubusercontent.com/yourusername/jarvis-hud/main/backend/scripts/setup-pi.sh
chmod +x setup-pi.sh
./setup-pi.sh
```

### 3. Deploy Jarvis
```bash
# Clone your repository
cd /opt/jarvis
git clone https://github.com/yourusername/jarvis-hud.git .

# Copy Pi configurations
cp backend/config/.env.pi backend/.env
cp backend/config/skills-pi.yaml backend/config/skills.yaml

# Build frontend
cd frontend  # or root directory if combined
npm install
npm run build

# Start services
cd /opt/jarvis/backend
sudo systemctl start jarvis
```

## 📁 Pi Directory Structure

```
/opt/jarvis/
├── frontend/              # React HUD (built to /dist)
├── backend/               # Node.js backend
│   ├── docker-compose.pi.yml
│   ├── Dockerfile.pi
│   └── config/
│       ├── .env.pi
│       ├── skills-pi.yaml
│       ├── nginx-pi.conf
│       └── redis-pi.conf
├── data/                  # Persistent data
├── logs/                  # Application logs
├── models/                # Voice models
├── config/                # Runtime config
├── ssl/                   # SSL certificates
└── backup/                # Backups
```

## 🔧 Pi-Specific Optimizations

### Memory Management
- **Node.js heap size**: Limited to 512MB
- **Redis memory**: Capped at 128MB
- **Container limits**: Enforced via Docker
- **Swap**: Increased to 1GB for stability

### Performance Tuning
- **Metrics interval**: Increased to 10 seconds
- **GPU monitoring**: Disabled (not needed)
- **Logging**: Reduced verbosity
- **Connection pooling**: Optimized for Pi

### Hardware Integration
- **GPIO access**: Available via `/dev/gpiomem`
- **Audio devices**: Mapped to containers
- **I2C/SPI**: Enabled for sensors
- **Temperature monitoring**: Built-in Pi sensors

## 🌐 Network Configuration

### Access Methods
- **Local**: `http://raspberrypi.local`
- **IP address**: `http://192.168.1.XXX`
- **mDNS**: `http://jarvis-pi.local`

### Firewall Setup
```bash
# Automatic via setup script
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw allow from 192.168.0.0/16
```

## 🎤 Voice Setup

### USB Microphone
```bash
# List audio devices
arecord -l

# Test microphone
arecord -D plughw:1,0 -d 5 test.wav

# Configure ALSA
sudo nano /etc/asound.conf
```

### TTS Configuration
- **Engine**: Piper TTS (lightweight)
- **Voice**: British English (jenny_dioco)
- **Quality**: Medium (balance of quality/performance)
- **Fallback**: Cloud TTS for complex phrases

## 🔒 Security Features

### Built-in Security
- **UFW firewall**: Configured automatically
- **Fail2Ban**: Installed for SSH protection  
- **User permissions**: Non-root Docker execution
- **SSL ready**: Certificate mounting supported

### Voice Authentication
- **PIN verification**: Hashed and salted
- **TOTP support**: For sensitive operations
- **Session management**: Automatic timeout
- **Audit logging**: All actions logged

## 📊 Monitoring

### System Metrics
- **CPU usage** and temperature
- **Memory** and swap utilization  
- **Disk space** and I/O
- **Network** traffic
- **Container** health

### Health Checks
- **Automatic**: Every 60 seconds
- **Service restart**: On failure
- **Alerts**: Via Telegram/Discord
- **Web dashboard**: Real-time status

## 🔄 Maintenance

### Automated Backups
```bash
# Daily backup at 3 AM
# Configuration in docker-compose.pi.yml
# Retention: 7 days on Pi (storage limited)
```

### Log Rotation
```bash
# Automatic log rotation
# Max 5MB per file
# Keep 3 files
# Prevents disk fill-up
```

### Updates
```bash
# Update system
sudo apt update && sudo apt upgrade

# Update containers
cd /opt/jarvis/backend
docker-compose -f docker-compose.pi.yml pull
docker-compose -f docker-compose.pi.yml up -d

# Update frontend
cd /opt/jarvis
git pull
npm run build
```

## 🛠 Troubleshooting

### Common Issues

**"Out of memory" errors**
```bash
# Check memory usage
free -h
docker stats

# Solution: Restart containers
sudo systemctl restart jarvis
```

**Audio not working**
```bash
# Check devices
lsusb
arecord -l

# Fix permissions
sudo usermod -a -G audio $USER
```

**Container won't start**
```bash
# Check logs
docker-compose -f docker-compose.pi.yml logs

# Check resources
df -h
docker system prune
```

**High CPU temperature**
```bash
# Check temperature
vcgencmd measure_temp

# Solutions:
# - Add heatsink/fan
# - Reduce container limits
# - Improve ventilation
```

### Performance Tips

1. **Use fast microSD**: Class 10 or better
2. **Enable overclock**: If cooling adequate  
3. **USB 3.0**: For external storage
4. **Wired network**: More reliable than WiFi
5. **Regular cleanup**: Remove unused Docker images

## 🔌 GPIO Integration

### Example GPIO Skills
```javascript
// Control LED via GPIO
jarvis.skills.gpio.setPin(18, 'high');

// Read button state  
const buttonState = jarvis.skills.gpio.readPin(24);

// I2C sensor reading
const temperature = jarvis.skills.i2c.readSensor('BME280');
```

### Supported Protocols
- **GPIO**: Digital I/O, PWM
- **I2C**: Sensors, displays
- **SPI**: High-speed devices
- **UART**: Serial communication

## 📱 Mobile Access

The Jarvis HUD is fully responsive and works great on mobile:
- **PWA support**: Install as app
- **Touch interface**: Optimized controls
- **Push-to-talk**: Mobile voice input
- **Real-time sync**: With Pi backend

## 🎯 IoT Integration Examples

### Smart Home Control
```bash
# Voice commands supported:
"Turn on living room lights"
"Set house to night mode" 
"Arm the security system"
"What's the temperature inside?"
```

### Server Management
```bash
"Restart the Plex container"
"Check Docker container status"
"Show system metrics"
"Backup the database"
```

### Security Operations
```bash
"Ban IP address 192.168.1.100"
"Show security threats"
"Enable away mode"
"Send alert to Telegram"
```

## 🚀 Advanced Features

### Custom Skills
Add your own skills to `/opt/jarvis/backend/src/skills/`:
```javascript
// Example: Pool controller skill
class PoolSkill extends BaseSkill {
  async execute(action, args) {
    switch(action) {
      case 'check_temperature':
        return await this.readPoolTemp();
      case 'turn_on_pump':
        return await this.controlPump(true);
    }
  }
}
```

### Home Assistant Integration
Perfect companion to Home Assistant:
- **Voice control**: All HA entities
- **Scene activation**: Complex automations
- **Sensor monitoring**: Real-time data
- **Event handling**: Automation triggers

### Docker Management
Full container orchestration:
- **Health monitoring**: All containers
- **Log aggregation**: Centralized logging  
- **Resource limits**: Prevent Pi overload
- **Auto-restart**: On failure

## 📈 Scaling Up

### Multi-Pi Setup
- **Main hub**: Jarvis HUD + backend
- **Satellite Pis**: Voice nodes only
- **Load balancing**: Distribute processing
- **Failover**: High availability

### Performance Monitoring
- **Grafana**: Metrics visualization
- **Prometheus**: Data collection
- **Alerting**: Proactive monitoring
- **Optimization**: Continuous improvement

---

**Your Raspberry Pi 4 is now a powerful Jarvis AI hub! 🍓🤖**

For support and updates, check the main repository documentation.