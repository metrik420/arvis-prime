const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const router = express.Router();

const execAsync = util.promisify(exec);

// Get fail2ban status
router.get('/fail2ban/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('fail2ban-client status');
    res.json({
      success: true,
      status: stdout
    });
  } catch (error) {
    res.status(500).json({ error: 'Fail2ban not available or insufficient permissions' });
  }
});

// Get banned IPs
router.get('/fail2ban/banned', async (req, res) => {
  try {
    const { stdout } = await execAsync('fail2ban-client status sshd');
    const bannedMatch = stdout.match(/Banned IP list:\s*(.+)/);
    const bannedIPs = bannedMatch ? bannedMatch[1].split(' ').filter(ip => ip) : [];
    
    res.json({
      success: true,
      bannedIPs
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to get banned IPs' });
  }
});

// Ban IP address
router.post('/fail2ban/ban/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { jail = 'sshd' } = req.body;
    
    await execAsync(`fail2ban-client set ${jail} banip ${ip}`);
    res.json({
      success: true,
      message: `IP ${ip} has been banned`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unban IP address
router.post('/fail2ban/unban/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { jail = 'sshd' } = req.body;
    
    await execAsync(`fail2ban-client set ${jail} unbanip ${ip}`);
    res.json({
      success: true,
      message: `IP ${ip} has been unbanned`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system logs (requires proper permissions)
router.get('/logs/auth', async (req, res) => {
  try {
    const { lines = 100 } = req.query;
    const { stdout } = await execAsync(`tail -n ${lines} /var/log/auth.log`);
    res.json({
      success: true,
      logs: stdout.split('\n')
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to read auth logs' });
  }
});

// Get network connections
router.get('/network/connections', async (req, res) => {
  try {
    const { stdout } = await execAsync('netstat -tuln');
    const connections = stdout.split('\n')
      .filter(line => line.includes('LISTEN'))
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          protocol: parts[0],
          localAddress: parts[3],
          state: parts[5]
        };
      });

    res.json({
      success: true,
      connections
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to get network connections' });
  }
});

// Security audit
router.post('/audit', async (req, res) => {
  try {
    const audit = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // Check SSH configuration
    try {
      const sshConfig = await fs.readFile('/etc/ssh/sshd_config', 'utf8');
      audit.checks.push({
        name: 'SSH Root Login',
        status: sshConfig.includes('PermitRootLogin no') ? 'PASS' : 'WARN',
        details: 'Root SSH login configuration'
      });
    } catch (e) {
      audit.checks.push({
        name: 'SSH Configuration',
        status: 'ERROR',
        details: 'Unable to read SSH config'
      });
    }

    // Check firewall status
    try {
      const { stdout } = await execAsync('ufw status');
      audit.checks.push({
        name: 'Firewall Status',
        status: stdout.includes('Status: active') ? 'PASS' : 'WARN',
        details: stdout
      });
    } catch (e) {
      audit.checks.push({
        name: 'Firewall',
        status: 'ERROR',
        details: 'Unable to check firewall status'
      });
    }

    res.json({
      success: true,
      audit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;