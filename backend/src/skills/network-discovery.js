const dgram = require('dgram');
const { exec } = require('child_process');
const util = require('util');
const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

const execAsync = util.promisify(exec);
const dnsResolve = util.promisify(dns.resolve4);

class NetworkDiscoverySkill {
  constructor(config, logger) {
    this.config = config || {};
    this.logger = logger;
    this.discoveredDevices = new Map();
    this.scanInProgress = false;
    this.lastScanTime = null;
    this.scanIntervalId = null;
    
    // Common device signatures for classification
    this.deviceSignatures = {
      'Home Assistant': { ports: [8123], paths: ['/api/'], userAgent: /homeassistant/i },
      'Plex Media Server': { ports: [32400], paths: ['/web/index.html'], userAgent: /plex/i },
      'Router': { ports: [80, 443], paths: ['/cgi-bin/', '/admin'], mac: /^(00:1f:3f|b8:27:eb|dc:a6:32)/i },
      'Raspberry Pi': { mac: /^(b8:27:eb|dc:a6:32|e4:5f:01)/i },
      'Philips Hue': { ports: [80], paths: ['/api', '/description.xml'], mac: /^(00:17:88|ec:b5:fa)/i },
      'Ring Doorbell': { mac: /^(74:c2:46|b0:7d:64)/i },
      'Nest Device': { mac: /^(18:b4:30|64:16:66)/i },
      'Chromecast': { ports: [8008, 8009], userAgent: /googlecast/i },
      'Amazon Echo': { mac: /^(44:65:0d|f0:d2:f1|50:f5:da)/i },
      'Smart TV': { ports: [1900, 8080], userAgent: /smarttv|webos|tizen/i },
      'IP Camera': { ports: [554, 80, 443], paths: ['/onvif/', '/cgi-bin/'], userAgent: /axis|hikvision|dahua/i },
      'NAS/Storage': { ports: [22, 445, 548, 5000, 5001], userAgent: /synology|qnap|freenas/i },
      'Printer': { ports: [631, 9100], userAgent: /hp|canon|epson|brother/i }
    };
    
    this.initialize();
  }

  async initialize() {
    try {
      this.logger.info('🌐 Network Discovery skill initialized');
      
      // Start continuous discovery if enabled
      if (this.config.autoScan !== false) {
        this.startContinuousDiscovery();
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Network Discovery skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'scan_network':
          return await this.scanNetwork(args.subnet, args.timeout);
        case 'get_devices':
          return await this.getDiscoveredDevices(args.filter);
        case 'identify_device':
          return await this.identifyDevice(args.ip, args.mac);
        case 'scan_ports':
          return await this.scanPorts(args.ip, args.ports);
        case 'get_device_info':
          return await this.getDeviceInfo(args.ip);
        case 'mdns_scan':
          return await this.mdnsDiscovery();
        case 'upnp_scan':
          return await this.upnpDiscovery();
        case 'start_monitoring':
          return await this.startContinuousDiscovery(args.interval);
        case 'stop_monitoring':
          return this.stopContinuousDiscovery();
        case 'classify_devices':
          return await this.classifyAllDevices();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Network discovery action ${action} failed:`, error.message);
      throw error;
    }
  }

  async scanNetwork(subnet = null, timeout = 5000) {
    if (this.scanInProgress) {
      return { success: false, message: 'Scan already in progress' };
    }

    this.scanInProgress = true;
    this.logger.info('🔍 Starting network scan...');

    try {
      // Auto-detect subnet if not provided
      if (!subnet) {
        subnet = await this.detectSubnet();
      }

      const devices = new Set();
      
      // Parallel scanning methods
      const scanPromises = [
        this.arpScan(subnet),
        this.pingSweep(subnet, timeout),
        this.mdnsDiscovery(),
        this.upnpDiscovery()
      ];

      const results = await Promise.allSettled(scanPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.devices) {
          result.value.devices.forEach(device => {
            devices.add(JSON.stringify(device));
          });
        } else if (result.status === 'rejected') {
          this.logger.warn(`Scan method ${index} failed:`, result.reason);
        }
      });

      // Convert back to objects and deduplicate
      const uniqueDevices = Array.from(devices).map(d => JSON.parse(d));
      
      // Enhanced device identification
      for (const device of uniqueDevices) {
        await this.enhanceDeviceInfo(device);
        this.discoveredDevices.set(device.ip, device);
      }

      this.lastScanTime = new Date().toISOString();
      this.scanInProgress = false;

      this.logger.info(`🎯 Network scan completed. Found ${uniqueDevices.length} devices`);

      return {
        success: true,
        devices: uniqueDevices,
        scanTime: this.lastScanTime,
        subnet: subnet,
        deviceCount: uniqueDevices.length
      };

    } catch (error) {
      this.scanInProgress = false;
      throw new Error(`Network scan failed: ${error.message}`);
    }
  }

  async detectSubnet() {
    try {
      const { stdout } = await execAsync("ip route | grep 'scope link' | head -1 | awk '{print $1}'");
      const subnet = stdout.trim();
      if (subnet && subnet.includes('/')) {
        return subnet;
      }
      
      // Fallback to common subnets
      return '192.168.1.0/24';
    } catch (error) {
      this.logger.warn('Could not auto-detect subnet, using default');
      return '192.168.1.0/24';
    }
  }

  async arpScan(subnet) {
    try {
      const { stdout } = await execAsync(`nmap -sn ${subnet} 2>/dev/null | grep -E "Nmap scan report|MAC Address"`);
      const lines = stdout.split('\n');
      const devices = [];
      
      for (let i = 0; i < lines.length; i += 2) {
        const ipMatch = lines[i]?.match(/Nmap scan report for (.+)/);
        const macMatch = lines[i + 1]?.match(/MAC Address: ([A-F0-9:]{17}) \((.+?)\)/);
        
        if (ipMatch) {
          const ip = ipMatch[1].replace(/[()]/g, '');
          const device = {
            ip: ip,
            mac: macMatch?.[1] || null,
            vendor: macMatch?.[2] || null,
            discoveryMethod: 'arp',
            timestamp: new Date().toISOString()
          };
          devices.push(device);
        }
      }
      
      return { success: true, devices };
    } catch (error) {
      this.logger.warn('ARP scan failed:', error.message);
      return { success: false, devices: [] };
    }
  }

  async pingSweep(subnet, timeout) {
    try {
      const baseIP = subnet.split('/')[0].split('.').slice(0, 3).join('.');
      const promises = [];
      
      // Ping common IP ranges
      for (let i = 1; i <= 254; i++) {
        const ip = `${baseIP}.${i}`;
        promises.push(this.pingHost(ip, timeout));
      }
      
      const results = await Promise.allSettled(promises);
      const devices = results
        .filter(result => result.status === 'fulfilled' && result.value.alive)
        .map(result => ({
          ip: result.value.ip,
          mac: null,
          vendor: null,
          responseTime: result.value.time,
          discoveryMethod: 'ping',
          timestamp: new Date().toISOString()
        }));
      
      return { success: true, devices };
    } catch (error) {
      this.logger.warn('Ping sweep failed:', error.message);
      return { success: false, devices: [] };
    }
  }

  async pingHost(ip, timeout) {
    try {
      const { stdout } = await execAsync(`ping -c 1 -W ${timeout / 1000} ${ip}`, { timeout });
      const timeMatch = stdout.match(/time=([0-9.]+)/);
      return {
        alive: true,
        ip: ip,
        time: timeMatch ? parseFloat(timeMatch[1]) : null
      };
    } catch (error) {
      return { alive: false, ip: ip };
    }
  }

  async mdnsDiscovery() {
    return new Promise((resolve) => {
      const devices = [];
      const socket = dgram.createSocket('udp4');
      
      const query = Buffer.from([
        0x00, 0x00, // Transaction ID
        0x01, 0x00, // Flags: Standard query
        0x00, 0x01, // Questions: 1
        0x00, 0x00, // Answer RRs: 0
        0x00, 0x00, // Authority RRs: 0
        0x00, 0x00, // Additional RRs: 0
        // Query: _services._dns-sd._udp.local
        0x09, 0x5f, 0x73, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x73,
        0x07, 0x5f, 0x64, 0x6e, 0x73, 0x2d, 0x73, 0x64,
        0x04, 0x5f, 0x75, 0x64, 0x70,
        0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c,
        0x00,
        0x00, 0x0c, // Type: PTR
        0x00, 0x01  // Class: IN
      ]);

      socket.on('message', (msg, rinfo) => {
        if (rinfo.address !== '224.0.0.251') return;
        
        devices.push({
          ip: rinfo.address,
          mac: null,
          vendor: null,
          services: ['mdns'],
          discoveryMethod: 'mdns',
          timestamp: new Date().toISOString()
        });
      });

      socket.bind(5353, () => {
        socket.addMembership('224.0.0.251');
        socket.send(query, 5353, '224.0.0.251');
        
        setTimeout(() => {
          socket.close();
          resolve({ success: true, devices });
        }, 3000);
      });
    });
  }

  async upnpDiscovery() {
    return new Promise((resolve) => {
      const devices = [];
      const socket = dgram.createSocket('udp4');
      
      const ssdpMsg = [
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1900',
        'MAN: "ssdp:discover"',
        'ST: upnp:rootdevice',
        'MX: 3',
        '',
        ''
      ].join('\r\n');

      socket.on('message', (msg, rinfo) => {
        const response = msg.toString();
        let deviceType = 'Unknown UPnP Device';
        
        const serverMatch = response.match(/SERVER: (.+)/i);
        const locationMatch = response.match(/LOCATION: (.+)/i);
        
        if (serverMatch) {
          deviceType = serverMatch[1].trim();
        }
        
        devices.push({
          ip: rinfo.address,
          mac: null,
          vendor: null,
          deviceType: deviceType,
          location: locationMatch?.[1]?.trim(),
          services: ['upnp'],
          discoveryMethod: 'upnp',
          timestamp: new Date().toISOString()
        });
      });

      socket.bind(() => {
        const message = Buffer.from(ssdpMsg);
        socket.send(message, 1900, '239.255.255.250');
        
        setTimeout(() => {
          socket.close();
          resolve({ success: true, devices });
        }, 4000);
      });
    });
  }

  async enhanceDeviceInfo(device) {
    try {
      // Get hostname
      try {
        const hostnames = await dnsResolve(device.ip);
        if (hostnames && hostnames.length > 0) {
          device.hostname = hostnames[0];
        }
      } catch (e) {
        // Hostname resolution failed, that's okay
      }

      // Classify device based on signatures
      device.classification = await this.classifyDevice(device);
      
      // Port scan for common services
      device.openPorts = await this.quickPortScan(device.ip);
      
      // HTTP service detection
      device.webServices = await this.detectWebServices(device.ip);
      
    } catch (error) {
      this.logger.warn(`Failed to enhance device info for ${device.ip}:`, error.message);
    }
  }

  async classifyDevice(device) {
    let bestMatch = { type: 'Unknown', confidence: 0, reasons: [] };
    
    for (const [deviceType, signature] of Object.entries(this.deviceSignatures)) {
      let confidence = 0;
      const reasons = [];
      
      // Check MAC address patterns
      if (signature.mac && device.mac && signature.mac.test(device.mac)) {
        confidence += 40;
        reasons.push(`MAC matches ${deviceType} pattern`);
      }
      
      // Check open ports
      if (signature.ports && device.openPorts) {
        const matchingPorts = signature.ports.filter(port => device.openPorts.includes(port));
        if (matchingPorts.length > 0) {
          confidence += matchingPorts.length * 15;
          reasons.push(`Open ports: ${matchingPorts.join(', ')}`);
        }
      }
      
      // Check web service paths
      if (signature.paths && device.webServices) {
        const matchingPaths = signature.paths.filter(path => 
          device.webServices.some(service => service.path && service.path.includes(path))
        );
        if (matchingPaths.length > 0) {
          confidence += matchingPaths.length * 20;
          reasons.push(`Web paths: ${matchingPaths.join(', ')}`);
        }
      }
      
      // Check vendor information
      if (device.vendor && deviceType.toLowerCase().includes(device.vendor.toLowerCase())) {
        confidence += 25;
        reasons.push(`Vendor matches ${deviceType}`);
      }
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          type: deviceType,
          confidence: confidence,
          reasons: reasons
        };
      }
    }
    
    return bestMatch;
  }

  async quickPortScan(ip) {
    const commonPorts = [22, 23, 53, 80, 110, 443, 554, 631, 993, 995, 1900, 5000, 8008, 8080, 8123, 9100, 32400];
    const openPorts = [];
    
    const scanPromises = commonPorts.map(port => this.checkPort(ip, port));
    const results = await Promise.allSettled(scanPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        openPorts.push(commonPorts[index]);
      }
    });
    
    return openPorts;
  }

  async checkPort(ip, port, timeout = 1000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);
      
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
      
      socket.connect(port, ip);
    });
  }

  async detectWebServices(ip) {
    const services = [];
    const ports = [80, 443, 8080, 8123, 5000];
    
    for (const port of ports) {
      try {
        const isHttps = port === 443 || port === 5001;
        const protocol = isHttps ? 'https:' : 'http:';
        const url = `${protocol}//${ip}:${port}/`;
        
        const service = await this.probeWebService(url);
        if (service) {
          services.push({ port, ...service });
        }
      } catch (error) {
        // Service not available on this port
      }
    }
    
    return services;
  }

  async probeWebService(url) {
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http;
      
      const req = client.get(url, { timeout: 2000 }, (res) => {
        const server = res.headers.server || '';
        const contentType = res.headers['content-type'] || '';
        
        resolve({
          status: res.statusCode,
          server: server,
          contentType: contentType,
          path: '/'
        });
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  startContinuousDiscovery(interval = 300000) { // 5 minutes default
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
    }
    
    this.scanIntervalId = setInterval(async () => {
      try {
        await this.scanNetwork();
        this.logger.info('🔄 Continuous network discovery scan completed');
      } catch (error) {
        this.logger.error('Continuous discovery scan failed:', error.message);
      }
    }, interval);
    
    this.logger.info(`🔄 Started continuous network discovery (interval: ${interval}ms)`);
    return { success: true, interval: interval };
  }

  stopContinuousDiscovery() {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
      this.logger.info('⏹️ Stopped continuous network discovery');
      return { success: true, message: 'Continuous discovery stopped' };
    }
    return { success: false, message: 'No continuous discovery running' };
  }

  async getDiscoveredDevices(filter = null) {
    const devices = Array.from(this.discoveredDevices.values());
    
    let filteredDevices = devices;
    if (filter) {
      filteredDevices = devices.filter(device => {
        if (filter.type && device.classification?.type !== filter.type) return false;
        if (filter.ip && !device.ip.includes(filter.ip)) return false;
        if (filter.vendor && !device.vendor?.toLowerCase().includes(filter.vendor.toLowerCase())) return false;
        return true;
      });
    }
    
    return {
      success: true,
      devices: filteredDevices,
      totalCount: devices.length,
      filteredCount: filteredDevices.length,
      lastScan: this.lastScanTime
    };
  }

  async shutdown() {
    this.stopContinuousDiscovery();
    this.logger.info('Network Discovery skill shutdown completed');
  }
}

module.exports = NetworkDiscoverySkill;