import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Ban, Eye, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService, wsService } from '@/lib/api';

export const SecurityPanel = () => {
  const [threats, setThreats] = useState<any[]>([]);
  const [securityStats, setSecurityStats] = useState({
    totalThreats: 0,
    blockedIPs: 0,
    activeSessions: 0,
    failedLogins: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        const response = await apiService.getSecurityStatus();
        if (response.success) {
          setThreats(response.data?.threats || []);
          setSecurityStats(response.data?.stats || {
            totalThreats: 0,
            blockedIPs: 0,
            activeSessions: 0,
            failedLogins: 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch security data:', error);
        // Fallback to mock data
        setThreats([
          {
            id: 1,
            ip: '203.0.113.5',
            type: 'Brute Force Attack',
            severity: 'high',
            timestamp: new Date().toLocaleString(),
            blocked: false,
          },
          {
            id: 2,
            ip: '198.51.100.42',
            type: 'Port Scan',
            severity: 'medium',
            timestamp: new Date().toLocaleString(),
            blocked: true,
          }
        ]);
        setSecurityStats({
          totalThreats: 23,
          blockedIPs: 5,
          activeSessions: 8,
          failedLogins: 2,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityData();

    // Listen for security updates via WebSocket
    wsService.on('security_alert', (data: any) => {
      const newThreat = {
        id: Date.now(),
        ip: data.ip,
        type: data.type,
        severity: data.severity,
        timestamp: new Date().toLocaleString(),
        blocked: false,
      };
      setThreats(prev => [newThreat, ...prev].slice(0, 20));
    });

    // Refresh every minute
    const interval = setInterval(fetchSecurityData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleBlockIP = async (id: number) => {
    const threat = threats.find(t => t.id === id);
    if (!threat) return;

    try {
      // Send block IP command via WebSocket
      wsService.send({
        type: 'tool_request',
        tool: 'security',
        action: 'block_ip',
        args: { ip: threat.ip }
      });

      // Optimistic update
      setThreats(threats.map(t => 
        t.id === id ? { ...t, blocked: true } : t
      ));
    } catch (error) {
      console.error('Failed to block IP:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'jarvis-status-critical';
      case 'high': return 'jarvis-status-warning';
      case 'medium': return 'text-neon-orange';
      default: return 'jarvis-status-online';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Shield className="w-7 h-7 text-neon-cyan" />
            <span>Security Operations</span>
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading security data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Shield className="w-7 h-7 text-neon-cyan" />
          <span>Security Operations</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Last scan:</span>
          <span className="text-sm jarvis-mono jarvis-status-online">
            {new Date().toLocaleTimeString('en-GB', { hour12: false })}
          </span>
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
            {threats.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheck className="w-12 h-12 text-neon-green mx-auto mb-4" />
                <p className="text-muted-foreground">No active threats detected</p>
              </div>
            ) : (
              threats.map((threat) => (
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
              ))
            )}
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