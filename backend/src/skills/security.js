const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = util.promisify(exec);

class SecuritySkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.threatLog = [];
  }

  async initialize() {
    try {
      // Check if security tools are available
      await this.checkSecurityTools();
      this.logger.info('Security skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.warn('Security skill initialized with limited functionality:', error.message);
      return true; // Continue even if some tools are missing
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'scan_threats':
          return await this.scanThreats();
        case 'ban_ip':
          return await this.banIP(args.ip, args.jail);
        case 'unban_ip':
          return await this.unbanIP(args.ip, args.jail);
        case 'get_banned_ips':
          return await this.getBannedIPs();
        case 'get_auth_logs':
          return await this.getAuthLogs(args.lines);
        case 'get_network_connections':
          return await this.getNetworkConnections();
        case 'security_audit':
          return await this.securityAudit();
        case 'enable_firewall':
          return await this.enableFirewall();
        case 'disable_firewall':
          return await this.disableFirewall();
        case 'get_firewall_status':
          return await this.getFirewallStatus();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Security action ${action} failed:`, error.message);
      throw error;
    }
  }

  async scanThreats() {
    const threats = [];
    
    try {
      // Check for failed SSH attempts
      const authLogs = await this.getAuthLogs(1000);
      const failedAttempts = this.analyzeFailedLogins(authLogs.logs);
      threats.push(...failedAttempts);

      // Check for suspicious network connections
      const connections = await this.getNetworkConnections();
      const suspiciousConnections = this.analyzeSuspiciousConnections(connections.connections);
      threats.push(...suspiciousConnections);

      // Check system processes
      const processes = await this.checkSuspiciousProcesses();
      threats.push(...processes);

    } catch (error) {
      this.logger.warn('Threat scan incomplete:', error.message);
    }

    this.threatLog = threats;
    
    return {
      success: true,
      threats,
      summary: {
        total: threats.length,
        high: threats.filter(t => t.severity === 'high').length,
        medium: threats.filter(t => t.severity === 'medium').length,
        low: threats.filter(t => t.severity === 'low').length
      }
    };
  }

  async banIP(ip, jail = 'sshd') {
    try {
      await execAsync(`fail2ban-client set ${jail} banip ${ip}`);
      this.logger.info(`IP ${ip} banned in jail ${jail}`);
      
      return {
        success: true,
        message: `IP ${ip} has been banned`,
        ip,
        jail,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('Fail2ban is not installed or not accessible');
      }
      throw error;
    }
  }

  async unbanIP(ip, jail = 'sshd') {
    try {
      await execAsync(`fail2ban-client set ${jail} unbanip ${ip}`);
      this.logger.info(`IP ${ip} unbanned from jail ${jail}`);
      
      return {
        success: true,
        message: `IP ${ip} has been unbanned`,
        ip,
        jail,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('Fail2ban is not installed or not accessible');
      }
      throw error;
    }
  }

  async getBannedIPs() {
    try {
      const { stdout } = await execAsync('fail2ban-client status sshd');
      const bannedMatch = stdout.match(/Banned IP list:\s*(.+)/);
      const bannedIPs = bannedMatch ? 
        bannedMatch[1].split(' ').filter(ip => ip && ip.match(/\d+\.\d+\.\d+\.\d+/)) : 
        [];

      return {
        success: true,
        bannedIPs: bannedIPs.map(ip => ({
          ip,
          jail: 'sshd',
          bannedAt: new Date().toISOString() // Note: fail2ban doesn't provide exact ban time easily
        }))
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        return { success: true, bannedIPs: [], message: 'Fail2ban not available' };
      }
      throw error;
    }
  }

  async getAuthLogs(lines = 100) {
    try {
      const { stdout } = await execAsync(`tail -n ${lines} /var/log/auth.log 2>/dev/null || tail -n ${lines} /var/log/secure 2>/dev/null || echo "No auth logs available"`);
      
      return {
        success: true,
        logs: stdout.split('\n').filter(line => line.trim())
      };
    } catch (error) {
      return {
        success: true,
        logs: [],
        message: 'Unable to read authentication logs'
      };
    }
  }

  async getNetworkConnections() {
    try {
      const { stdout } = await execAsync('netstat -tuln 2>/dev/null || ss -tuln');
      const connections = stdout.split('\n')
        .filter(line => line.includes('LISTEN') || line.includes('ESTABLISHED'))
        .map(line => {
          const parts = line.split(/\s+/);
          return {
            protocol: parts[0],
            localAddress: parts[3] || parts[4],
            foreignAddress: parts[4] || parts[5],
            state: parts[5] || parts[1]
          };
        });

      return {
        success: true,
        connections
      };
    } catch (error) {
      return {
        success: true,
        connections: [],
        message: 'Unable to get network connections'
      };
    }
  }

  async securityAudit() {
    const audit = {
      timestamp: new Date().toISOString(),
      checks: [],
      score: 0,
      maxScore: 0
    };

    // SSH Configuration Check
    await this.checkSSHConfig(audit);
    
    // Firewall Check
    await this.checkFirewall(audit);
    
    // Password Policy Check
    await this.checkPasswordPolicy(audit);
    
    // File Permissions Check
    await this.checkCriticalFilePermissions(audit);
    
    // Service Check
    await this.checkRunningServices(audit);

    audit.score = Math.round((audit.score / audit.maxScore) * 100);
    
    return {
      success: true,
      audit
    };
  }

  async enableFirewall() {
    try {
      await execAsync('ufw --force enable');
      return {
        success: true,
        message: 'Firewall enabled successfully'
      };
    } catch (error) {
      if (error.message.includes('command not found')) {
        throw new Error('UFW firewall is not installed');
      }
      throw error;
    }
  }

  async disableFirewall() {
    try {
      await execAsync('ufw --force disable');
      return {
        success: true,
        message: 'Firewall disabled successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  async getFirewallStatus() {
    try {
      const { stdout } = await execAsync('ufw status verbose');
      return {
        success: true,
        status: stdout,
        active: stdout.includes('Status: active')
      };
    } catch (error) {
      return {
        success: true,
        status: 'UFW not available',
        active: false
      };
    }
  }

  // Helper methods
  analyzeFailedLogins(logs) {
    const threats = [];
    const ipCounts = {};
    
    logs.forEach(log => {
      if (log.includes('Failed password') || log.includes('authentication failure')) {
        const ipMatch = log.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          const ip = ipMatch[1];
          ipCounts[ip] = (ipCounts[ip] || 0) + 1;
        }
      }
    });

    Object.entries(ipCounts).forEach(([ip, count]) => {
      if (count > 5) {
        threats.push({
          type: 'brute_force_attempt',
          ip,
          attempts: count,
          severity: count > 20 ? 'high' : count > 10 ? 'medium' : 'low',
          timestamp: new Date().toISOString()
        });
      }
    });

    return threats;
  }

  analyzeSuspiciousConnections(connections) {
    const threats = [];
    const suspiciousPorts = [23, 135, 139, 445, 1433, 3389]; // Telnet, RPC, NetBIOS, SMB, SQL Server, RDP
    
    connections.forEach(conn => {
      if (conn.foreignAddress && conn.foreignAddress !== '0.0.0.0:*') {
        const portMatch = conn.localAddress.match(/:(\d+)$/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          if (suspiciousPorts.includes(port)) {
            threats.push({
              type: 'suspicious_connection',
              port,
              connection: conn,
              severity: 'medium',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    });

    return threats;
  }

  async checkSuspiciousProcesses() {
    const threats = [];
    const suspiciousProcesses = ['nc', 'ncat', 'socat', 'telnet'];
    
    try {
      const { stdout } = await execAsync('ps aux');
      const processes = stdout.split('\n');
      
      processes.forEach(process => {
        suspiciousProcesses.forEach(suspProc => {
          if (process.includes(suspProc) && !process.includes('grep')) {
            threats.push({
              type: 'suspicious_process',
              process: suspProc,
              details: process.trim(),
              severity: 'medium',
              timestamp: new Date().toISOString()
            });
          }
        });
      });
    } catch (error) {
      // Ignore errors in process checking
    }

    return threats;
  }

  async checkSSHConfig(audit) {
    audit.maxScore += 3;
    try {
      const sshConfig = await fs.readFile('/etc/ssh/sshd_config', 'utf8');
      
      // Check root login
      if (sshConfig.includes('PermitRootLogin no')) {
        audit.checks.push({ name: 'SSH Root Login Disabled', status: 'PASS', points: 1 });
        audit.score += 1;
      } else {
        audit.checks.push({ name: 'SSH Root Login Disabled', status: 'FAIL', points: 0 });
      }
      
      // Check password authentication
      if (sshConfig.includes('PasswordAuthentication no')) {
        audit.checks.push({ name: 'SSH Key-only Authentication', status: 'PASS', points: 1 });
        audit.score += 1;
      } else {
        audit.checks.push({ name: 'SSH Key-only Authentication', status: 'WARN', points: 0.5 });
        audit.score += 0.5;
      }
      
      // Check port configuration
      const portMatch = sshConfig.match(/Port (\d+)/);
      if (portMatch && portMatch[1] !== '22') {
        audit.checks.push({ name: 'SSH Non-standard Port', status: 'PASS', points: 1 });
        audit.score += 1;
      } else {
        audit.checks.push({ name: 'SSH Non-standard Port', status: 'WARN', points: 0 });
      }
      
    } catch (error) {
      audit.checks.push({ name: 'SSH Configuration Check', status: 'ERROR', points: 0 });
    }
  }

  async checkFirewall(audit) {
    audit.maxScore += 2;
    try {
      const { stdout } = await execAsync('ufw status');
      if (stdout.includes('Status: active')) {
        audit.checks.push({ name: 'Firewall Active', status: 'PASS', points: 2 });
        audit.score += 2;
      } else {
        audit.checks.push({ name: 'Firewall Active', status: 'FAIL', points: 0 });
      }
    } catch (error) {
      audit.checks.push({ name: 'Firewall Check', status: 'ERROR', points: 0 });
    }
  }

  async checkPasswordPolicy(audit) {
    audit.maxScore += 1;
    try {
      // This is a basic check - in reality you'd check /etc/pam.d/common-password
      audit.checks.push({ name: 'Password Policy', status: 'INFO', points: 0 });
    } catch (error) {
      audit.checks.push({ name: 'Password Policy Check', status: 'ERROR', points: 0 });
    }
  }

  async checkCriticalFilePermissions(audit) {
    audit.maxScore += 2;
    const criticalFiles = ['/etc/passwd', '/etc/shadow'];
    let passed = 0;
    
    for (const file of criticalFiles) {
      try {
        const stats = await fs.stat(file);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if ((file === '/etc/passwd' && mode === '644') || 
            (file === '/etc/shadow' && mode === '640')) {
          passed++;
        }
      } catch (error) {
        // File doesn't exist or can't read permissions
      }
    }
    
    audit.checks.push({ 
      name: 'Critical File Permissions', 
      status: passed === criticalFiles.length ? 'PASS' : 'WARN',
      points: passed 
    });
    audit.score += passed;
  }

  async checkRunningServices(audit) {
    audit.maxScore += 1;
    try {
      const { stdout } = await execAsync('systemctl list-units --type=service --state=running --no-pager --no-legend');
      const serviceCount = stdout.split('\n').filter(line => line.trim()).length;
      
      audit.checks.push({ 
        name: 'Running Services Count', 
        status: 'INFO', 
        points: 0,
        details: `${serviceCount} services running`
      });
    } catch (error) {
      audit.checks.push({ name: 'Service Check', status: 'ERROR', points: 0 });
    }
  }

  async checkSecurityTools() {
    const tools = ['fail2ban-client', 'ufw', 'netstat'];
    const available = [];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        available.push(tool);
      } catch (error) {
        this.logger.warn(`Security tool ${tool} not available`);
      }
    }
    
    if (available.length === 0) {
      throw new Error('No security tools available');
    }
    
    return available;
  }

  async healthCheck() {
    try {
      const tools = await this.checkSecurityTools();
      return { 
        healthy: true, 
        message: 'Security skill operational',
        availableTools: tools
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: error.message 
      };
    }
  }

  async shutdown() {
    this.logger.info('Security skill shutting down');
  }
}

module.exports = SecuritySkill;