const express = require('express');
const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const router = express.Router();

const execAsync = util.promisify(exec);

// Get system information
router.get('/info', async (req, res) => {
  try {
    const [cpu, mem, osInfo, system] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.system()
    ]);

    res.json({
      success: true,
      system: {
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          speed: cpu.speed,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores
        },
        memory: {
          total: mem.total,
          free: mem.free,
          used: mem.used,
          active: mem.active,
          available: mem.available
        },
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          kernel: osInfo.kernel
        },
        hardware: {
          manufacturer: system.manufacturer,
          model: system.model,
          version: system.version,
          serial: system.serial
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get real-time metrics
router.get('/metrics', async (req, res) => {
  try {
    const [currentLoad, mem, disks, networkStats, temp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.cpuTemperature()
    ]);

    res.json({
      success: true,
      metrics: {
        cpu: {
          usage: currentLoad.currentload,
          loadAvg: currentLoad.avgload,
          cores: currentLoad.cpus.map(core => ({
            usage: core.load,
            loadUser: core.loaduser,
            loadSystem: core.loadsystem
          }))
        },
        memory: {
          total: mem.total,
          free: mem.free,
          used: mem.used,
          usedPercent: ((mem.used / mem.total) * 100).toFixed(1),
          cached: mem.cached,
          buffers: mem.buffers
        },
        disk: disks.map(disk => ({
          fs: disk.fs,
          type: disk.type,
          size: disk.size,
          used: disk.used,
          available: disk.available,
          usedPercent: ((disk.used / disk.size) * 100).toFixed(1),
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
          cores: temp.cores,
          max: temp.max
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get running processes
router.get('/processes', async (req, res) => {
  try {
    const processes = await si.processes();
    
    // Sort by CPU usage and get top processes
    const topProcesses = processes.list
      .sort((a, b) => b.pcpu - a.pcpu)
      .slice(0, parseInt(req.query.limit) || 20)
      .map(proc => ({
        pid: proc.pid,
        name: proc.name,
        command: proc.command,
        cpu: proc.pcpu,
        memory: proc.pmem,
        memVsz: proc.memVsz,
        memRss: proc.memRss,
        nice: proc.nice,
        started: proc.started,
        state: proc.state,
        user: proc.user
      }));

    res.json({
      success: true,
      processes: topProcesses,
      summary: {
        running: processes.running,
        blocked: processes.blocked,
        sleeping: processes.sleeping,
        unknown: processes.unknown
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get service status
router.get('/services', async (req, res) => {
  try {
    const services = await si.services('*');
    
    res.json({
      success: true,
      services: services.map(service => ({
        name: service.name,
        running: service.running,
        startmode: service.startmode,
        pids: service.pids,
        cpu: service.pcpu,
        memory: service.pmem
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uptime and load
router.get('/uptime', async (req, res) => {
  try {
    const [uptime, load] = await Promise.all([
      si.time(),
      si.currentLoad()
    ]);

    res.json({
      success: true,
      uptime: {
        uptime: uptime.uptime,
        timezone: uptime.timezone,
        timezoneName: uptime.timezoneName,
        current: uptime.current
      },
      load: {
        avgLoad: load.avgload,
        currentLoad: load.currentload,
        currentLoadUser: load.currentloaduser,
        currentLoadSystem: load.currentloadsystem,
        currentLoadNice: load.currentloadnice,
        currentLoadIdle: load.currentloadidle,
        currentLoadIrq: load.currentloadirq
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute system command (restricted)
router.post('/command', async (req, res) => {
  try {
    const { command } = req.body;
    
    // Whitelist of allowed commands for security
    const allowedCommands = [
      'df -h',
      'free -h',
      'uptime',
      'whoami',
      'date',
      'systemctl status',
      'docker ps'
    ];

    if (!allowedCommands.includes(command)) {
      return res.status(403).json({ error: 'Command not allowed' });
    }

    const { stdout, stderr } = await execAsync(command);
    
    res.json({
      success: true,
      stdout: stdout,
      stderr: stderr
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stderr: error.stderr 
    });
  }
});

module.exports = router;