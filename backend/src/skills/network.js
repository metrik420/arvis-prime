const { exec } = require('child_process');
const util = require('util');
const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');
const dgram = require('dgram');

const execAsync = util.promisify(exec);
const dnsResolve = util.promisify(dns.resolve4);

class NetworkSkill {
  constructor(config, logger) {
    this.config = config || {};
    this.logger = logger;
    this.discoveredDevices = new Map();
    this.scanInProgress = false;
    this.lastScanTime = null;
    this.monitoringInterval = null;
    
    // Device classification signatures
    this.deviceSignatures = {
      'Home Assistant': { ports: [8123], paths: ['/api/', '/lovelace'], userAgent: /homeassistant/i, mac: null },
      'Plex Media Server': { ports: [32400], paths: ['/web/index.html'], userAgent: /plex/i, mac: null },
      'Router/Gateway': { ports: [80, 443, 8080], paths: ['/cgi-bin/', '/admin', '/setup.cgi'], mac: /^(00:1f:3f|b8:27:eb|dc:a6:32|00:50:56)/i },
      'Raspberry Pi': { ports: [22, 80], mac: /^(b8:27:eb|dc:a6:32|e4:5f:01)/i, paths: null },
      'Philips Hue Bridge': { ports: [80, 443], paths: ['/api', '/description.xml'], mac: /^(00:17:88|ec:b5:fa)/i },
      'Amazon Echo/Alexa': { ports: [4070], mac: /^(44:65:0d|f0:d2:f1|50:f5:da|74:c2:46)/i, userAgent: /alexa/i },
      'Google Chromecast': { ports: [8008, 8009], userAgent: /googlecast/i, mac: /^(da:a1:19|54:60:09)/i },
      'Smart TV': { ports: [1900, 8080, 8001], userAgent: /smarttv|webos|tizen|roku/i, mac: null },
      'IP Camera': { ports: [554, 80, 443, 8080], paths: ['/onvif/', '/cgi-bin/'], userAgent: /axis|hikvision|dahua|foscam/i },
      'NAS/Storage': { ports: [22, 445, 548, 5000, 5001, 8080], userAgent: /synology|qnap|freenas|drobo/i, mac: null },
      'Printer': { ports: [631, 9100, 515, 721], userAgent: /hp|canon|epson|brother|lexmark/i, mac: null },
      'Gaming Console': { ports: [1935, 9295, 9296], mac: /^(7c:ed:8d|a4:c3:61|00:0f:ea)/i, userAgent: /playstation|xbox|nintendo/i },
      'Smart Speaker': { ports: [4070, 8009], mac: /^(44:65:0d|18:b4:30|f4:f5:d8)/i, userAgent: /alexa|google|sonos/i }
    };
  }

  async initialize() {
    this.logger.info('🌐 Network skill initialized');
    return true;
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'scan_network':
          return await this.scanNetwork(args.subnet, args.timeout);
        case 'get_devices':
          return await this.getDevices(args.filter);
        case 'get_device_info':
          return await this.getDeviceInfo(args.ip);
        case 'start_monitoring':
          return await this.startMonitoring(args.interval);
        case 'stop_monitoring':
          return this.stopMonitoring();
        case 'classify_devices':
          return await this.classifyAllDevices();
        case 'mdns_scan':
          return await this.mdnsDiscovery();
        case 'upnp_scan':
          return await this.upnpDiscovery();
        default:
          throw new Error(`Unknown network action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Network action ${action} failed:`, error.message);
      throw error;
    }
  }

  async scanNetwork(subnet = null, timeout = 5000) {
    if (this.scanInProgress) {
      return { success: false, message: 'Scan already in progress', devices: [] };
    }

    this.scanInProgress = true;
    this.logger.info('🔍 Starting comprehensive network scan...');

    try {
      if (!subnet) {
        subnet = await this.detectSubnet();
      }

      // Run multiple discovery methods in parallel
      const [arpResults, pingResults, mdnsResults, upnpResults] = await Promise.allSettled([
        this.arpScan(subnet),
        this.pingSweep(subnet, timeout),
        this.mdnsDiscovery(),
        this.upnpDiscovery()
      ]);

      // Merge and deduplicate results
      const allDevices = new Map();
      
      [arpResults, pingResults, mdnsResults, upnpResults].forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.devices) {
          result.value.devices.forEach(device => {
            const key = device.ip;
            if (allDevices.has(key)) {
              // Merge device info
              const existing = allDevices.get(key);
              allDevices.set(key, {
                ...existing,
                ...device,
                discoveryMethods: [...(existing.discoveryMethods || []), device.discoveryMethod],
                mac: device.mac || existing.mac,
                vendor: device.vendor || existing.vendor,
                services: [...(existing.services || []), ...(device.services || [])],
              });
            } else {
              allDevices.set(key, {
                ...device,
                discoveryMethods: [device.discoveryMethod]
              });
            }
          });
        }
      });

      // Enhanced device analysis
      const devices = Array.from(allDevices.values());
      for (const device of devices) {
        await this.enhanceDeviceInfo(device);
        this.discoveredDevices.set(device.ip, device);
      }

      this.lastScanTime = new Date().toISOString();
      this.scanInProgress = false;

      this.logger.info(`✅ Network scan completed. Found ${devices.length} devices`);

      return {
        success: true,
        devices: devices,
        scanTime: this.lastScanTime,
        subnet: subnet,
        deviceCount: devices.length,
        stats: {
          arp: arpResults.status === 'fulfilled' ? arpResults.value.devices.length : 0,
          ping: pingResults.status === 'fulfilled' ? pingResults.value.devices.length : 0,
          mdns: mdnsResults.status === 'fulfilled' ? mdnsResults.value.devices.length : 0,
          upnp: upnpResults.status === 'fulfilled' ? upnpResults.value.devices.length : 0
        }
      };

    } catch (error) {
      this.scanInProgress = false;
      this.logger.error('Network scan failed:', error.message);
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
      
      // Try alternative method
      const { stdout: routeOutput } = await execAsync("ip route | grep default | awk '{print $3}'");
      const gateway = routeOutput.trim();
      if (gateway) {
        const parts = gateway.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
      }
      
      return '192.168.1.0/24';
    } catch (error) {
      this.logger.warn('Could not auto-detect subnet, using default');
      return '192.168.1.0/24';
    }
  }

  async arpScan(subnet) {
    try {
      this.logger.info(`Running ARP scan on ${subnet}`);
      const { stdout } = await execAsync(`nmap -sn ${subnet} 2>/dev/null | grep -E "Nmap scan report|MAC Address"`, { timeout: 30000 });
      const lines = stdout.split('\n').filter(line => line.trim());
      const devices = [];
      
      for (let i = 0; i < lines.length; i++) {
        const ipMatch = lines[i]?.match(/Nmap scan report for (.+)/);
        if (ipMatch) {
          const ip = ipMatch[1].replace(/[()]/g, '').trim();
          const macMatch = lines[i + 1]?.match(/MAC Address: ([A-F0-9:]{17}) \((.+?)\)/);
          
          const device = {
            ip: ip,
            mac: macMatch?.[1] || null,
            vendor: macMatch?.[2] || null,
            discoveryMethod: 'arp',
            timestamp: new Date().toISOString(),
            alive: true
          };
          devices.push(device);
        }
      }
      
      this.logger.info(`ARP scan found ${devices.length} devices`);
      return { success: true, devices };
    } catch (error) {
      this.logger.warn('ARP scan failed:', error.message);
      return { success: false, devices: [] };
    }
  }

  async pingSweep(subnet, timeout) {
    try {
      this.logger.info(`Running ping sweep on ${subnet}`);
      const baseIP = subnet.split('/')[0].split('.').slice(0, 3).join('.');
      const promises = [];
      
      // Ping common IP ranges (first 50 IPs for speed)
      for (let i = 1; i <= 50; i++) {
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
          timestamp: new Date().toISOString(),
          alive: true
        }));
      
      this.logger.info(`Ping sweep found ${devices.length} active devices`);
      return { success: true, devices };
    } catch (error) {
      this.logger.warn('Ping sweep failed:', error.message);
      return { success: false, devices: [] };
    }
  }

  async pingHost(ip, timeout) {
    try {
      const { stdout } = await execAsync(`ping -c 1 -W ${Math.ceil(timeout / 1000)} ${ip}`, { timeout: timeout + 1000 });
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
    this.logger.info('Starting mDNS discovery...');
    return new Promise((resolve) => {
      const devices = [];
      const socket = dgram.createSocket('udp4');
      let responseCount = 0;
      
      const query = Buffer.from([
        0x00, 0x00, // Transaction ID
        0x01, 0x00, // Flags: Standard query
        0x00, 0x01, // Questions: 1
        0x00, 0x00, // Answer RRs: 0
        0x00, 0x00, // Authority RRs: 0
        0x00, 0x00, // Additional RRs: 0
        0x05, 0x5f, 0x68, 0x74, 0x74, 0x70, // _http
        0x04, 0x5f, 0x74, 0x63, 0x70, // _tcp
        0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c, // local
        0x00,
        0x00, 0x0c, // Type: PTR
        0x00, 0x01  // Class: IN
      ]);

      socket.on('message', (msg, rinfo) => {
        responseCount++;
        const device = {
          ip: rinfo.address,
          mac: null,
          vendor: null,
          services: ['mdns', 'http'],
          discoveryMethod: 'mdns',
          timestamp: new Date().toISOString(),
          port: rinfo.port
        };
        
        // Avoid duplicates
        if (!devices.find(d => d.ip === device.ip)) {
          devices.push(device);
        }
      });

      socket.on('error', (err) => {
        this.logger.warn('mDNS socket error:', err.message);
      });

      try {
        socket.bind(0, () => {
          socket.addMembership('224.0.0.251');
          socket.send(query, 5353, '224.0.0.251', (err) => {
            if (err) {
              this.logger.warn('mDNS send error:', err.message);
            }
          });
          
          setTimeout(() => {
            socket.close();
            this.logger.info(`mDNS discovery found ${devices.length} devices (${responseCount} responses)`);
            resolve({ success: true, devices });
          }, 3000);
        });
      } catch (error) {
        this.logger.warn('mDNS discovery failed:', error.message);
        resolve({ success: false, devices: [] });
      }
    });
  }

  async upnpDiscovery() {
    this.logger.info('Starting UPnP discovery...');
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
        let deviceType = 'UPnP Device';
        
        const serverMatch = response.match(/SERVER: (.+)/i);
        const locationMatch = response.match(/LOCATION: (.+)/i);
        const stMatch = response.match(/ST: (.+)/i);
        
        if (serverMatch) {
          deviceType = serverMatch[1].trim();
        }
        
        const device = {
          ip: rinfo.address,
          mac: null,
          vendor: null,
          deviceType: deviceType,
          location: locationMatch?.[1]?.trim(),
          serviceType: stMatch?.[1]?.trim(),
          services: ['upnp'],
          discoveryMethod: 'upnp',
          timestamp: new Date().toISOString()
        };
        
        // Avoid duplicates
        if (!devices.find(d => d.ip === device.ip)) {
          devices.push(device);
        }
      });

      socket.on('error', (err) => {
        this.logger.warn('UPnP socket error:', err.message);
      });

      try {
        socket.bind(() => {
          const message = Buffer.from(ssdpMsg);
          socket.send(message, 1900, '239.255.255.250', (err) => {
            if (err) {
              this.logger.warn('UPnP send error:', err.message);
            }
          });
          
          setTimeout(() => {
            socket.close();
            this.logger.info(`UPnP discovery found ${devices.length} devices`);
            resolve({ success: true, devices });
          }, 4000);
        });
      } catch (error) {
        this.logger.warn('UPnP discovery failed:', error.message);
        resolve({ success: false, devices: [] });
      }
    });
  }

  async enhanceDeviceInfo(device) {
    try {
      // Get hostname via reverse DNS
      try {
        const hostnames = await dnsResolve(device.ip);
        if (hostnames && hostnames.length > 0) {
          device.hostname = hostnames[0];
        }
      } catch (e) {
        // Try alternative hostname resolution
        try {
          const { stdout } = await execAsync(`nslookup ${device.ip}`, { timeout: 2000 });
          const hostMatch = stdout.match(/name = (.+)\./);
          if (hostMatch) {
            device.hostname = hostMatch[1];
          }
        } catch (e2) {
          // No hostname available
        }
      }

      // Classify device
      device.classification = await this.classifyDevice(device);
      
      // Port scan for services
      device.openPorts = await this.quickPortScan(device.ip);
      
      // HTTP/HTTPS service detection
      device.webServices = await this.detectWebServices(device.ip);
      
      // OS fingerprinting
      device.os = await this.detectOS(device.ip);
      
    } catch (error) {
      this.logger.warn(`Failed to enhance device info for ${device.ip}:`, error.message);
    }
  }

  async classifyDevice(device) {
    let bestMatch = { type: 'Unknown Device', confidence: 0, reasons: [] };
    
    for (const [deviceType, signature] of Object.entries(this.deviceSignatures)) {
      let confidence = 0;
      const reasons = [];
      
      // MAC address matching (highest confidence)
      if (signature.mac && device.mac && signature.mac.test(device.mac)) {
        confidence += 50;
        reasons.push(`MAC pattern matches ${deviceType}`);
      }
      
      // Open ports matching
      if (signature.ports && device.openPorts) {
        const matchingPorts = signature.ports.filter(port => device.openPorts.includes(port));
        if (matchingPorts.length > 0) {
          confidence += matchingPorts.length * 20;
          reasons.push(`Open ports: ${matchingPorts.join(', ')}`);
        }
      }
      
      // Web service paths
      if (signature.paths && device.webServices) {
        const matchingPaths = signature.paths.filter(path => 
          device.webServices.some(service => service.path && service.path.includes(path))
        );
        if (matchingPaths.length > 0) {
          confidence += matchingPaths.length * 25;
          reasons.push(`Web paths found: ${matchingPaths.join(', ')}`);
        }
      }
      
      // User agent matching
      if (signature.userAgent && device.webServices) {
        const matchingUA = device.webServices.find(service => 
          service.server && signature.userAgent.test(service.server)
        );
        if (matchingUA) {
          confidence += 30;
          reasons.push(`User agent matches ${deviceType}`);
        }
      }
      
      // Vendor name matching
      if (device.vendor && deviceType.toLowerCase().includes(device.vendor.toLowerCase().split(' ')[0])) {
        confidence += 15;
        reasons.push(`Vendor name similarity`);
      }
      
      // Hostname matching
      if (device.hostname && deviceType.toLowerCase().includes(device.hostname.toLowerCase().split('.')[0])) {
        confidence += 20;
        reasons.push(`Hostname similarity`);
      }
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          type: deviceType,
          confidence: Math.min(confidence, 100),
          reasons: reasons
        };
      }
    }
    
    return bestMatch;
  }

  async quickPortScan(ip) {
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 554, 631, 993, 995, 1080, 1900, 3389, 5000, 5001, 8008, 8080, 8123, 8443, 9100, 32400];
    const openPorts = [];
    
    const scanPromises = commonPorts.map(port => this.checkPort(ip, port, 1000));
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
    const ports = [80, 443, 8080, 8123, 8443, 5000, 5001, 32400];
    
    for (const port of ports) {
      try {
        const isHttps = port === 443 || port === 8443 || port === 5001;
        const protocol = isHttps ? 'https:' : 'http:';
        const url = `${protocol}//${ip}:${port}/`;
        
        const service = await this.probeWebService(url);
        if (service) {
          services.push({ port, url, ...service });
        }
      } catch (error) {
        // Service not available
      }
    }
    
    return services;
  }

  async probeWebService(url) {
    return new Promise((resolve) => {
      const client = url.startsWith('https:') ? https : http;
      
      const req = client.get(url, { 
        timeout: 3000,
        headers: { 'User-Agent': 'Jarvis-Network-Scanner/1.0' }
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 1024) { // Limit data read
            res.destroy();
          }
        });
        
        res.on('end', () => {
          const server = res.headers.server || '';
          const contentType = res.headers['content-type'] || '';
          const title = data.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
          
          resolve({
            status: res.statusCode,
            server: server,
            contentType: contentType,
            title: title.trim(),
            path: '/',
            headers: res.headers
          });
        });
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  async detectOS(ip) {
    try {
      const { stdout } = await execAsync(`nmap -O --osscan-guess ${ip} 2>/dev/null | grep "Running:"`, { timeout: 10000 });
      const osMatch = stdout.match(/Running: (.+)/);
      return osMatch ? osMatch[1].trim() : 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  async getDevices(filter = {}) {
    let devices = Array.from(this.discoveredDevices.values());
    
    if (filter.type) {
      devices = devices.filter(d => d.classification?.type?.toLowerCase().includes(filter.type.toLowerCase()));
    }
    
    if (filter.vendor) {
      devices = devices.filter(d => d.vendor?.toLowerCase().includes(filter.vendor.toLowerCase()));
    }
    
    if (filter.ip) {
      devices = devices.filter(d => d.ip.includes(filter.ip));
    }
    
    return {
      success: true,
      devices: devices,
      count: devices.length,
      lastScan: this.lastScanTime
    };
  }

  async getDeviceInfo(ip) {
    const device = this.discoveredDevices.get(ip);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }
    
    // Get additional real-time info
    const detailedInfo = {
      ...device,
      lastSeen: new Date().toISOString(),
      isOnline: await this.pingHost(ip, 2000).then(r => r.alive)
    };
    
    return {
      success: true,
      device: detailedInfo
    };
  }

  async startMonitoring(interval = 300000) { // 5 minutes
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.scanNetwork();
        this.logger.info('🔄 Scheduled network scan completed');
      } catch (error) {
        this.logger.error('Scheduled network scan failed:', error.message);
      }
    }, interval);
    
    this.logger.info(`📡 Network monitoring started (interval: ${interval}ms)`);
    return { success: true, interval: interval };
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('📡 Network monitoring stopped');
    }
    return { success: true };
  }

  async classifyAllDevices() {
    const devices = Array.from(this.discoveredDevices.values());
    let classified = 0;
    
    for (const device of devices) {
      const oldClassification = device.classification?.type || 'Unknown';
      device.classification = await this.classifyDevice(device);
      
      if (device.classification.type !== 'Unknown Device' && oldClassification !== device.classification.type) {
        classified++;
        this.logger.info(`🏷️  Classified ${device.ip} as ${device.classification.type} (${device.classification.confidence}% confidence)`);
      }
      
      this.discoveredDevices.set(device.ip, device);
    }
    
    return {
      success: true,
      devicesClassified: classified,
      totalDevices: devices.length
    };
  }

  shutdown() {
    this.stopMonitoring();
    this.logger.info('🌐 Network skill shutdown complete');
  }
}

module.exports = NetworkSkill;