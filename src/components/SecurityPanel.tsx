import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Ban, Eye, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const SecurityPanel = () => {
  const [threats, setThreats] = useState([
    {
      id: 1,
      ip: '203.0.113.5',
      type: 'Brute Force Attack',
      severity: 'high',
      timestamp: '2024-01-15 14:23:45',
      blocked: false,
    },
    {
      id: 2,
      ip: '198.51.100.42',
      type: 'Port Scan',
      severity: 'medium',
      timestamp: '2024-01-15 14:18:12',
      blocked: true,
    },
    {
      id: 3,
      ip: '192.0.2.15',
      type: 'SQL Injection Attempt',
      severity: 'critical',
      timestamp: '2024-01-15 14:15:33',
      blocked: true,
    },
  ]);

  const handleBlockIP = (id: number) => {
    setThreats(threats.map(threat => 
      threat.id === id ? { ...threat, blocked: true } : threat
    ));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'jarvis-status-critical';
      case 'high': return 'jarvis-status-warning';
      case 'medium': return 'text-neon-orange';
      default: return 'jarvis-status-online';
    }
  };

  const securityStats = {
    totalThreats: 147,
    blockedIPs: 23,
    activeSessions: 8,
    failedLogins: 5,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Shield className="w-7 h-7 text-neon-cyan" />
          <span>Security Operations</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Last scan:</span>
          <span className="text-sm jarvis-mono jarvis-status-online">14:25:33</span>
        </div>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Threats</p>
                <p className="text-2xl font-bold jarvis-status-warning">{securityStats.totalThreats}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-neon-orange" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked IPs</p>
                <p className="text-2xl font-bold jarvis-status-critical">{securityStats.blockedIPs}</p>
              </div>
              <Ban className="w-8 h-8 text-neon-red" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold jarvis-status-online">{securityStats.activeSessions}</p>
              </div>
              <Eye className="w-8 h-8 text-neon-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Logins</p>
                <p className="text-2xl font-bold jarvis-status-warning">{securityStats.failedLogins}</p>
              </div>
              <Lock className="w-8 h-8 text-neon-orange" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Threat Monitor */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-neon-orange" />
            <span>Active Threats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {threats.map((threat) => (
              <div
                key={threat.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-surface/30"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${getSeverityColor(threat.severity)} bg-current animate-pulse`} />
                  <div>
                    <p className="font-medium jarvis-mono">{threat.ip}</p>
                    <p className="text-sm text-muted-foreground">{threat.type}</p>
                  </div>
                  <div className="text-sm text-muted-foreground jarvis-mono">
                    {threat.timestamp}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {threat.blocked ? (
                    <div className="flex items-center space-x-1 text-neon-red">
                      <Ban className="w-4 h-4" />
                      <span className="text-sm">Blocked</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleBlockIP(threat.id)}
                      className="jarvis-button ghost"
                      size="sm"
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Block IP
                    </Button>
                  )}
                  
                  <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(threat.severity)} bg-current/10`}>
                    {threat.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle>Quick Security Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button className="jarvis-button ghost flex flex-col items-center space-y-2 h-20">
              <ShieldCheck className="w-6 h-6" />
              <span className="text-sm">Full Scan</span>
            </Button>
            <Button className="jarvis-button ghost flex flex-col items-center space-y-2 h-20">
              <Ban className="w-6 h-6" />
              <span className="text-sm">Block Range</span>
            </Button>
            <Button className="jarvis-button ghost flex flex-col items-center space-y-2 h-20">
              <Eye className="w-6 h-6" />
              <span className="text-sm">View Logs</span>
            </Button>
            <Button className="jarvis-button ghost flex flex-col items-center space-y-2 h-20">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-sm">Emergency Lock</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};