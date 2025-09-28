const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = util.promisify(exec);

class SystemSkill {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.metricsHistory = [];
    this.maxHistoryLength = 1000;
    this.alertThresholds = {
      cpu: parseFloat(process.env.CPU_ALERT_THRESHOLD) || 80,
      memory: parseFloat(process.env.MEMORY_ALERT_THRESHOLD) || 85,
      disk: parseFloat(process.env.DISK_ALERT_THRESHOLD) || 90,
      temperature: parseFloat(process.env.TEMP_ALERT_THRESHOLD) || 70
    };
  }

  async initialize() {
    try {
      // Test system information access
      await si.cpu();
      this.logger.info('System skill initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize System skill:', error.message);
      return false;
    }
  }

  async execute(action, args = {}) {
    try {
      switch (action) {
        case 'get_metrics':
          return await this.getSystemMetrics();
        case 'get_info':
          return await this.getSystemInfo();
        case 'get_processes':
          return await this.getProcesses(args.limit, args.sortBy);
        case 'get_services':
          return await this.getServices();
        case 'get_uptime':
          return await this.getUptime();
        case 'get_disk_usage':
          return await this.getDiskUsage();
        case 'get_network_stats':
          return await this.getNetworkStats();
        case 'get_temperature':
          return await this.getTemperature();
        case 'run_command':
          return await this.runCommand(args.command);
        case 'check_alerts':
          return await this.checkAlerts();
        case 'get_history':
          return await this.getMetricsHistory(args.hours);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`System action ${action} failed:`, error.message);
      throw error;
    }
  }

  async getSystemMetrics() {
    try {
      const [currentLoad, mem, disks, networkStats, temp] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.cpuTemperature()
      ]);

      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: Math.round(currentLoad.currentload * 100) / 100,
          loadAvg: currentLoad.avgload,
          cores: currentLoad.cpus.map(core => ({
            usage: Math.round(core.load * 100) / 100,
            loadUser: Math.round(core.loaduser * 100) / 100,
            loadSystem: Math.round(core.loadsystem * 100) / 100
          }))
        },
        memory: {
          total: mem.total,
          free: mem.free,
          used: mem.used,
          usedPercent: Math.round((mem.used / mem.total) * 100 * 100) / 100,
          cached: mem.cached,
          buffers: mem.buffers,
          available: mem.available
        },
        disk: disks.map(disk => ({
          fs: disk.fs,
          type: disk.type,
          size: disk.size,
          used: disk.used,
          available: disk.available,
          usedPercent: Math.round((disk.used / disk.size) * 100 * 100) / 100,
          mount: disk.mount
        })),
        network: networkStats.map(net => ({
          iface: net.iface,
          operstate: net.operstate,
          rx_bytes: net.rx_bytes,
          rx_dropped: net.rx_dropped,
          rx_errors: net.rx_errors,
          tx_bytes: net.tx_bytes,
          tx_dropped: net.tx_dropped,
          tx_errors: net.tx_errors,
          rx_sec: net.rx_sec,
          tx_sec: net.tx_sec
        })),
        temperature: {
          main: temp.main,
          cores: temp.cores || [],
          max: temp.max
        }
      };

      // Store in history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistoryLength) {
        this.metricsHistory.shift();
      }

      return {
        success: true,
        metrics
      };
    } catch (error) {
      throw new Error(`Get metrics failed: ${error.message}`);
    }
  }

  async getSystemInfo() {
    try {
      const [cpu, mem, osInfo, system, bios, motherboard] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.system(),
        si.bios(),
        si.baseboard()
      ]);

      return {
        success: true,
        system: {
          cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            family: cpu.family,
            model: cpu.model,
            speed: cpu.speed,
            speedMin: cpu.speedmin,
            speedMax: cpu.speedmax,
            cores: cpu.cores,
            physicalCores: cpu.physicalCores,
            processors: cpu.processors,
            socket: cpu.socket,
            cache: cpu.cache
          },
          memory: {
            total: mem.total,
            swapTotal: mem.swaptotal
          },
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            codename: osInfo.codename,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            hostname: osInfo.hostname,
            fqdn: osInfo.fqdn,
            logofile: osInfo.logofile
          },
          hardware: {
            manufacturer: system.manufacturer,
            model: system.model,
            version: system.version,
            serial: system.serial,
            uuid: system.uuid,
            sku: system.sku
          },
          bios: {
            vendor: bios.vendor,
            version: bios.version,
            releaseDate: bios.releaseDate,
            revision: bios.revision
          },
          motherboard: {
            manufacturer: motherboard.manufacturer,
            model: motherboard.model,
            version: motherboard.version,
            serial: motherboard.serial
          }
        }
      };
    } catch (error) {
      throw new Error(`Get system info failed: ${error.message}`);
    }
  }

  async getProcesses(limit = 20, sortBy = 'cpu') {
    try {
      const processes = await si.processes();
      
      // Sort processes
      let sortedProcesses;
      switch (sortBy) {
        case 'memory':
          sortedProcesses = processes.list.sort((a, b) => b.pmem - a.pmem);
          break;
        case 'name':
          sortedProcesses = processes.list.sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          sortedProcesses = processes.list.sort((a, b) => b.pcpu - a.pcpu);
      }

      const topProcesses = sortedProcesses
        .slice(0, limit)
        .map(proc => ({
          pid: proc.pid,
          name: proc.name,
          command: proc.command,
          cpu: Math.round(proc.pcpu * 100) / 100,
          memory: Math.round(proc.pmem * 100) / 100,
          memVsz: proc.memVsz,
          memRss: proc.memRss,
          nice: proc.nice,
          started: proc.started,
          state: proc.state,
          user: proc.user,
          priority: proc.priority
        }));

      return {
        success: true,
        processes: topProcesses,
        summary: {
          total: processes.all,
          running: processes.running,
          blocked: processes.blocked,
          sleeping: processes.sleeping,
          unknown: processes.unknown
        }
      };
    } catch (error) {
      throw new Error(`Get processes failed: ${error.message}`);
    }
  }

  async getServices() {
    try {
      const services = await si.services('*');
      
      return {
        success: true,
        services: services.map(service => ({
          name: service.name,
          running: service.running,
          startmode: service.startmode,
          pids: service.pids,
          cpu: service.pcpu,
          memory: service.pmem
        }))
      };
    } catch (error) {
      throw new Error(`Get services failed: ${error.message}`);
    }
  }

  async getUptime() {
    try {
      const [uptime, load] = await Promise.all([
        si.time(),
        si.currentLoad()
      ]);

      return {
        success: true,
        uptime: {
          uptime: uptime.uptime,
          uptimeHuman: this.formatUptime(uptime.uptime),
          timezone: uptime.timezone,
          timezoneName: uptime.timezoneName,
          current: uptime.current
        },
        load: {
          avgLoad: load.avgload,
          currentLoad: Math.round(load.currentload * 100) / 100,
          currentLoadUser: Math.round(load.currentloaduser * 100) / 100,
          currentLoadSystem: Math.round(load.currentloadsystem * 100) / 100,
          currentLoadNice: Math.round(load.currentloadnice * 100) / 100,
          currentLoadIdle: Math.round(load.currentloadidle * 100) / 100,
          currentLoadIrq: Math.round(load.currentloadirq * 100) / 100
        }
      };
    } catch (error) {
      throw new Error(`Get uptime failed: ${error.message}`);
    }
  }

  async getDiskUsage() {
    try {
      const disks = await si.fsSize();
      
      return {
        success: true,
        disks: disks.map(disk => ({
          fs: disk.fs,
          type: disk.type,
          size: disk.size,
          sizeHuman: this.formatBytes(disk.size),
          used: disk.used,
          usedHuman: this.formatBytes(disk.used),
          available: disk.available,
          availableHuman: this.formatBytes(disk.available),
          usedPercent: Math.round((disk.used / disk.size) * 100 * 100) / 100,
          mount: disk.mount
        }))
      };
    } catch (error) {
      throw new Error(`Get disk usage failed: ${error.message}`);
    }
  }

  async getNetworkStats() {
    try {
      const [networkStats, networkInterfaces] = await Promise.all([
        si.networkStats(),
        si.networkInterfaces()
      ]);

      return {
        success: true,
        interfaces: networkInterfaces.map(iface => ({
          iface: iface.iface,
          type: iface.type,
          mac: iface.mac,
          ip4: iface.ip4,
          ip6: iface.ip6,
          speed: iface.speed,
          duplex: iface.duplex,
          mtu: iface.mtu,
          operstate: iface.operstate,
          dhcp: iface.dhcp
        })),
        stats: networkStats.map(stat => ({
          iface: stat.iface,
          operstate: stat.operstate,
          rx_bytes: stat.rx_bytes,
          rx_dropped: stat.rx_dropped,
          rx_errors: stat.rx_errors,
          tx_bytes: stat.tx_bytes,
          tx_dropped: stat.tx_dropped,
          tx_errors: stat.tx_errors,
          rx_sec: stat.rx_sec,
          tx_sec: stat.tx_sec,
          ms: stat.ms
        }))
      };
    } catch (error) {
      throw new Error(`Get network stats failed: ${error.message}`);
    }
  }

  async getTemperature() {
    try {
      const temp = await si.cpuTemperature();
      
      return {
        success: true,
        temperature: {
          main: temp.main,
          cores: temp.cores || [],
          max: temp.max,
          socketType: temp.socket,
          chipset: temp.chipset
        }
      };
    } catch (error) {
      throw new Error(`Get temperature failed: ${error.message}`);
    }
  }

  async runCommand(command) {
    try {
      // Whitelist of allowed commands for security
      const allowedCommands = [
        'df -h',
        'free -h',
        'uptime',
        'whoami',
        'date',
        'uname -a',
        'lscpu',
        'lsblk',
        'ps aux | head -20',
        'systemctl status',
        'docker ps',
        'docker stats --no-stream'
      ];

      if (!allowedCommands.includes(command)) {
        throw new Error(`Command not allowed: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command);
      
      return {
        success: true,
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
    } catch (error) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  async checkAlerts() {
    try {
      const metrics = await this.getSystemMetrics();
      const alerts = [];

      // CPU usage alert
      if (metrics.metrics.cpu.usage > this.alertThresholds.cpu) {
        alerts.push({
          type: 'cpu_high',
          severity: 'warning',
          message: `CPU usage is ${metrics.metrics.cpu.usage.toFixed(1)}% (threshold: ${this.alertThresholds.cpu}%)`,
          value: metrics.metrics.cpu.usage,
          threshold: this.alertThresholds.cpu
        });
      }

      // Memory usage alert
      if (metrics.metrics.memory.usedPercent > this.alertThresholds.memory) {
        alerts.push({
          type: 'memory_high',
          severity: 'warning',
          message: `Memory usage is ${metrics.metrics.memory.usedPercent.toFixed(1)}% (threshold: ${this.alertThresholds.memory}%)`,
          value: metrics.metrics.memory.usedPercent,
          threshold: this.alertThresholds.memory
        });
      }

      // Disk usage alerts
      metrics.metrics.disk.forEach(disk => {
        if (disk.usedPercent > this.alertThresholds.disk) {
          alerts.push({
            type: 'disk_high',
            severity: 'warning',
            message: `Disk ${disk.mount} usage is ${disk.usedPercent.toFixed(1)}% (threshold: ${this.alertThresholds.disk}%)`,
            value: disk.usedPercent,
            threshold: this.alertThresholds.disk,
            mount: disk.mount
          });
        }
      });

      // Temperature alert
      if (metrics.metrics.temperature.main && metrics.metrics.temperature.main > this.alertThresholds.temperature) {
        alerts.push({
          type: 'temperature_high',
          severity: 'critical',
          message: `CPU temperature is ${metrics.metrics.temperature.main}°C (threshold: ${this.alertThresholds.temperature}°C)`,
          value: metrics.metrics.temperature.main,
          threshold: this.alertThresholds.temperature
        });
      }

      return {
        success: true,
        alerts,
        alertCount: alerts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Check alerts failed: ${error.message}`);
    }
  }

  async getMetricsHistory(hours = 24) {
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    const filteredHistory = this.metricsHistory.filter(metric => 
      new Date(metric.timestamp) >= startTime
    );

    return {
      success: true,
      history: filteredHistory,
      count: filteredHistory.length,
      period: {
        hours,
        start: startTime.toISOString(),
        end: now.toISOString()
      }
    };
  }

  // Helper methods
  formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    result += `${minutes}m`;
    
    return result;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async healthCheck() {
    try {
      await si.currentLoad();
      return {
        healthy: true,
        message: 'System monitoring operational',
        metricsHistory: this.metricsHistory.length
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  async shutdown() {
    this.logger.info('System skill shutting down');
    
    // Clear metrics history
    this.metricsHistory = [];
  }
}

module.exports = SystemSkill;