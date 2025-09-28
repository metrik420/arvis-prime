# Jarvis HUD Deployment Guide

This guide covers deploying the Jarvis HUD interface in various environments.

## 🐳 Docker Deployment (Recommended)

### Quick Start
```bash
# Clone the repository
git clone <your-repo-url>
cd jarvis-hud

# Build and run with Docker Compose
docker-compose up -d

# Access the interface at http://localhost:8080
```

### Production Deployment
```bash
# Build production image
docker build -t jarvis-hud:latest .

# Run with production settings
docker run -d \
  --name jarvis-hud \
  -p 8080:8080 \
  --restart unless-stopped \
  --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  jarvis-hud:latest
```

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# Frontend configuration
NODE_ENV=production

# API endpoints (when backend is ready)
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://ws.yourdomain.com

# Optional: Analytics and monitoring
REACT_APP_ANALYTICS_ID=your-analytics-id
```

### Docker Environment File
Create `.env.production`:
```bash
# Docker Compose environment
POSTGRES_PASSWORD=your-secure-password
COMPOSE_PROJECT_NAME=jarvis

# Domain configuration
JARVIS_DOMAIN=jarvis.yourdomain.com
```

## 🌐 Reverse Proxy Configuration

### Nginx (Manual Setup)
```nginx
server {
    listen 80;
    server_name jarvis.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jarvis.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Traefik (Automated)
The docker-compose.yml includes Traefik labels for automatic HTTPS:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.jarvis-hud.rule=Host(`jarvis.yourdomain.com`)"
  - "traefik.http.routers.jarvis-hud.tls=true"
  - "traefik.http.routers.jarvis-hud.tls.certresolver=letsencrypt"
```

## 🔒 Security Hardening

### 1. SSL/TLS Configuration
```bash
# Generate SSL certificates with Let's Encrypt
certbot certonly --webroot -w /var/www/html -d jarvis.yourdomain.com
```

### 2. Firewall Rules
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 3. Container Security
```bash
# Run container with limited privileges
docker run -d \
  --name jarvis-hud \
  --user 1001:1001 \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /var/run \
  --no-new-privileges \
  jarvis-hud:latest
```

## 📊 Monitoring and Logging

### Docker Logs
```bash
# View container logs
docker logs jarvis-hud -f

# Export logs to file
docker logs jarvis-hud > jarvis-hud.log 2>&1
```

### Health Monitoring
```bash
# Check container health
docker inspect jarvis-hud | grep -A 5 "Health"

# Health check endpoint
curl http://localhost:8080/health
```

### Performance Monitoring
```bash
# Container resource usage
docker stats jarvis-hud

# System resource monitoring
htop
iostat 1
```

## 🚀 Scaling and Load Balancing

### Horizontal Scaling
```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  jarvis-hud:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

### Load Balancer Configuration
```nginx
upstream jarvis_backend {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
}

server {
    location / {
        proxy_pass http://jarvis_backend;
    }
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy Jarvis HUD

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker image
        run: docker build -t jarvis-hud:${{ github.sha }} .
      
      - name: Deploy to production
        run: |
          docker stop jarvis-hud || true
          docker rm jarvis-hud || true
          docker run -d --name jarvis-hud -p 8080:8080 jarvis-hud:${{ github.sha }}
```

## 🛠 Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker logs jarvis-hud
   
   # Verify port availability
   netstat -tlnp | grep 8080
   ```

2. **Health check failing**
   ```bash
   # Test health endpoint manually
   curl -f http://localhost:8080/health
   
   # Check nginx configuration
   nginx -t
   ```

3. **Performance issues**
   ```bash
   # Monitor resource usage
   docker stats
   
   # Check system load
   uptime
   ```

### Debug Commands
```bash
# Interactive container access
docker exec -it jarvis-hud sh

# View container configuration
docker inspect jarvis-hud

# Network connectivity test
docker exec jarvis-hud wget -qO- http://localhost:8080/health
```

## 📋 Maintenance

### Regular Tasks
```bash
# Update container image
docker pull jarvis-hud:latest
docker-compose up -d

# Clean up old images
docker image prune -f

# Backup configuration
tar -czf jarvis-backup-$(date +%Y%m%d).tar.gz docker-compose.yml .env nginx.conf
```

### Security Updates
```bash
# Update base image
docker build --no-cache -t jarvis-hud:latest .

# Scan for vulnerabilities
docker scan jarvis-hud:latest
```

## 🌍 Multi-Environment Setup

### Development
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Staging
```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up
```

### Production
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📞 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review Docker and nginx logs
3. Verify network connectivity and firewall rules
4. Ensure all required ports are available

---

**Ready for production deployment! 🚀**