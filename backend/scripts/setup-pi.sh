#!/bin/bash

# Jarvis HUD - Raspberry Pi 4 Setup Script
# Optimized for ARM64 architecture

set -e

echo "🍓 Jarvis HUD - Raspberry Pi 4 Setup"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Raspberry Pi
check_pi() {
    print_status "Checking if running on Raspberry Pi..."
    
    if [ ! -f /proc/device-tree/model ]; then
        print_error "This doesn't appear to be a Raspberry Pi"
        exit 1
    fi
    
    PI_MODEL=$(cat /proc/device-tree/model)
    print_success "Detected: $PI_MODEL"
    
    # Check for Pi 4 specifically
    if [[ $PI_MODEL == *"Raspberry Pi 4"* ]]; then
        print_success "Raspberry Pi 4 detected - optimal for Jarvis HUD"
    else
        print_warning "This script is optimized for Pi 4, but will continue..."
    fi
}

# Check system resources
check_resources() {
    print_status "Checking system resources..."
    
    # Check RAM
    TOTAL_RAM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [ $TOTAL_RAM -lt 2048 ]; then
        print_warning "Less than 2GB RAM detected. Consider upgrading for better performance."
    else
        print_success "RAM: ${TOTAL_RAM}MB - Good for Jarvis HUD"
    fi
    
    # Check storage
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ $AVAILABLE_SPACE -lt 8 ]; then
        print_warning "Less than 8GB free space. Consider cleaning up disk space."
    else
        print_success "Storage: ${AVAILABLE_SPACE}GB available"
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
        print_success "Architecture: ARM64 - Perfect for our Docker images"
    else
        print_warning "Architecture: $ARCH - May need different Docker images"
    fi
}

# Update system
update_system() {
    print_status "Updating Raspberry Pi OS..."
    
    sudo apt update
    sudo apt upgrade -y
    
    print_success "System updated"
}

# Install Docker
install_docker() {
    print_status "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        print_success "Docker already installed"
        docker --version
    else
        # Install Docker using convenience script
        curl -fsSL https://get.docker.com | sh
        
        # Add current user to docker group
        sudo usermod -aG docker $USER
        
        # Start and enable Docker
        sudo systemctl start docker
        sudo systemctl enable docker
        
        print_success "Docker installed successfully"
        print_warning "You may need to logout and login again for Docker permissions"
    fi
}

# Install Docker Compose
install_docker_compose() {
    print_status "Installing Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose already installed"
        docker-compose --version
    else
        # Install Docker Compose for ARM64
        sudo apt install -y docker-compose
        
        print_success "Docker Compose installed"
    fi
}

# Install Node.js (for development)
install_nodejs() {
    print_status "Installing Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js already installed: $NODE_VERSION"
    else
        # Install Node.js via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
        
        print_success "Node.js installed: $(node --version)"
    fi
}

# Install additional Pi tools
install_pi_tools() {
    print_status "Installing Raspberry Pi specific tools..."
    
    sudo apt install -y \
        htop \
        iotop \
        git \
        curl \
        wget \
        unzip \
        vim \
        tmux \
        fail2ban \
        ufw
    
    print_success "Pi tools installed"
}

# Configure firewall
setup_firewall() {
    print_status "Configuring UFW firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow Jarvis ports
    sudo ufw allow 80/tcp comment 'Nginx HTTP'
    sudo ufw allow 443/tcp comment 'Nginx HTTPS'
    sudo ufw allow 3001/tcp comment 'Jarvis Backend'
    
    # Allow local network access
    sudo ufw allow from 192.168.0.0/16
    sudo ufw allow from 10.0.0.0/8
    
    print_success "Firewall configured"
}

# Optimize Pi for Docker
optimize_pi() {
    print_status "Applying Pi optimizations..."
    
    # Increase swap if needed
    if [ $(swapon --show=SIZE --noheadings --bytes | head -1) -lt 1073741824 ]; then
        print_status "Increasing swap size..."
        sudo dphys-swapfile swapoff
        sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
        sudo dphys-swapfile setup
        sudo dphys-swapfile swapon
    fi
    
    # Enable GPIO for hardware access
    if ! grep -q "dtparam=spi=on" /boot/config.txt; then
        echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
    fi
    if ! grep -q "dtparam=i2c_arm=on" /boot/config.txt; then
        echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt
    fi
    
    # GPU memory split for better performance
    if ! grep -q "gpu_mem=64" /boot/config.txt; then
        echo "gpu_mem=64" | sudo tee -a /boot/config.txt
    fi
    
    print_success "Pi optimizations applied"
}

# Setup Jarvis directories
setup_directories() {
    print_status "Setting up Jarvis directories..."
    
    # Create main directory
    sudo mkdir -p /opt/jarvis
    sudo chown $USER:$USER /opt/jarvis
    
    # Create subdirectories
    mkdir -p /opt/jarvis/{data,logs,models,config,ssl,backup}
    
    # Set permissions
    chmod 755 /opt/jarvis
    chmod 755 /opt/jarvis/data
    chmod 755 /opt/jarvis/logs
    chmod 755 /opt/jarvis/models
    chmod 755 /opt/jarvis/config
    chmod 755 /opt/jarvis/ssl
    chmod 755 /opt/jarvis/backup
    
    print_success "Jarvis directories created in /opt/jarvis"
}

# Create systemd service
create_service() {
    print_status "Creating Jarvis systemd service..."
    
    sudo tee /etc/systemd/system/jarvis.service > /dev/null <<EOF
[Unit]
Description=Jarvis HUD AI Assistant
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/opt/jarvis
ExecStart=/usr/bin/docker-compose -f docker-compose.pi.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.pi.yml down
TimeoutStartSec=0
User=$USER

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable jarvis.service
    
    print_success "Jarvis service created and enabled"
}

# Main installation
main() {
    echo ""
    print_status "Starting Jarvis HUD installation on Raspberry Pi 4..."
    echo ""
    
    check_pi
    check_resources
    update_system
    install_docker
    install_docker_compose
    install_nodejs
    install_pi_tools
    setup_firewall
    optimize_pi
    setup_directories
    create_service
    
    echo ""
    print_success "🎉 Jarvis HUD setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Clone your Jarvis repository to /opt/jarvis/"
    echo "2. Copy Pi-specific configs to /opt/jarvis/config/"
    echo "3. Configure environment variables in /opt/jarvis/.env"
    echo "4. Run: sudo systemctl start jarvis"
    echo "5. Access via: http://$(hostname -I | cut -d' ' -f1)"
    echo ""
    print_warning "A reboot is recommended to apply all optimizations"
    echo "Run: sudo reboot"
}

# Run main function
main "$@"