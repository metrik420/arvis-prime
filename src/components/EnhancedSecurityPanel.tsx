import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Ban, Eye, Lock, Unlock, Scan, Activity, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface SecurityThreat {
  id: string;
  ip: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  blocked: boolean;
  description: string;
}

interface SecurityStats {
  totalThreats: number;
  blockedIPs: number;
  activeSessions: number;
  failedLogins: number;
  firewallRules: number;
  lastScan: string;
}

export const EnhancedSecurityPanel = () => {
  const [threats, setThreats] = useState<SecurityThreat[]>([
    {
      id: '1',
      ip: '203.0.113.5',
      type: 'Brute Force Attack',
      severity: 'high',
      timestamp: new Date().toLocaleString(),
      blocked: false,
      description: 'Multiple failed SSH login attempts detected'
    },
    {
      id: '2',
      ip: '198.51.100.42',
      type: 'Port Scan',
      severity: 'medium',
      timestamp: new Date(Date.now() - 300000).toLocaleString(),
      blocked: true,
      description: 'Suspicious port scanning activity'
    },
    {
      id: '3',
      ip: '192.0.2.15',
      type: 'DDoS Attempt',
      severity: 'critical',
      timestamp: new Date(Date.now() - 600000).toLocaleString(),
      blocked: true,
      description: 'Distributed denial of service attack detected'
    }
  ]);

  const [stats, setStats] = useState<SecurityStats>({
    totalThreats: 23,
    blockedIPs: 8,
    activeSessions: 3,
    failedLogins: 15,
    firewallRules: 47,
    lastScan: new Date().toLocaleString()
  });

  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [realTimeProtection, setRealTimeProtection] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const { toast } = useToast();

  const [firewallRules] = useState([
    { id: 1, name: 'Block SSH Brute Force', enabled: true, rule: 'DROP INPUT tcp:22 rate>10/min' },
    { id: 2, name: 'Allow HTTP/HTTPS', enabled: true, rule: 'ACCEPT INPUT tcp:80,443' },
    { id: 3, name: 'Block Known Bad IPs', enabled: true, rule: 'DROP INPUT src:blacklist' },
    { id: 4, name: 'Allow Internal Network', enabled: true, rule: 'ACCEPT INPUT src:192.168.0.0/16' }
  ]);

  const startSecurityScan = async () => {
    setIsScanning(true);
    setScanProgress(0);

    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsScanning(false);
          toast({
            title: "Security Scan Complete",
            description: "No new threats detected. System is secure.",
          });
          setStats(prev => ({ ...prev, lastScan: new Date().toLocaleString() }));
          return 100;
        }
        return prev + 5;
      });
    }, 200);
  };

  const blockIP = async (threatId: string) => {
    setThreats(prev => prev.map(threat => 
      threat.id === threatId 
        ? { ...threat, blocked: true }
        : threat
    ));
    
    toast({
      title: "IP Blocked",
      description: "The threatening IP has been added to the firewall blocklist.",
    });

    setStats(prev => ({ ...prev, blockedIPs: prev.blockedIPs + 1 }));
  };

  const unblockIP = async (threatId: string) => {
    setThreats(prev => prev.map(threat => 
      threat.id === threatId 
        ? { ...threat, blocked: false }
        : threat
    ));
    
    toast({
      title: "IP Unblocked",
      description: "The IP has been removed from the firewall blocklist.",
    });

    setStats(prev => ({ ...prev, blockedIPs: Math.max(0, prev.blockedIPs - 1) }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return ShieldAlert;
      case 'high': return ShieldAlert;
      case 'medium': return AlertTriangle;
      case 'low': return Eye;
      default: return Eye;
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Status</p>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span className="font-semibold text-green-500">Protected</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Threats</p>
              <p className="text-2xl font-bold text-red-500">{stats.totalThreats}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Blocked IPs</p>
              <p className="text-2xl font-bold">{stats.blockedIPs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Active Sessions</p>
              <p className="text-2xl font-bold text-blue-500">{stats.activeSessions}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Failed Logins</p>
              <p className="text-2xl font-bold text-orange-500">{stats.failedLogins}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Firewall Rules</p>
              <p className="text-2xl font-bold text-purple-500">{stats.firewallRules}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="threats" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="threats">Active Threats</TabsTrigger>
          <TabsTrigger value="firewall">Firewall</TabsTrigger>
          <TabsTrigger value="scan">Security Scan</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Security Threats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {threats.map((threat) => {
                  const SeverityIcon = getSeverityIcon(threat.severity);
                  return (
                    <div key={threat.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <SeverityIcon className="w-5 h-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{threat.type}</p>
                            <Badge variant={getSeverityColor(threat.severity) as any}>
                              {threat.severity}
                            </Badge>
                            {threat.blocked && (
                              <Badge variant="outline">Blocked</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">IP: {threat.ip}</p>
                          <p className="text-sm text-muted-foreground">{threat.description}</p>
                          <p className="text-xs text-muted-foreground">{threat.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!threat.blocked ? (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => blockIP(threat.id)}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Block
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => unblockIP(threat.id)}
                          >
                            <Unlock className="w-4 h-4 mr-2" />
                            Unblock
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firewall" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Firewall Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {firewallRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch checked={rule.enabled} />
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{rule.rule}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Button className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Add New Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5" />
                Security Scanning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isScanning && (
                <div className="space-y-2">
                  <Label>Scan Progress</Label>
                  <Progress value={scanProgress} />
                  <p className="text-sm text-muted-foreground">{scanProgress}% complete</p>
                </div>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Last security scan: {stats.lastScan}
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                <Button 
                  onClick={startSecurityScan} 
                  disabled={isScanning}
                  className="w-full"
                >
                  <Scan className="w-4 h-4 mr-2" />
                  {isScanning ? 'Scanning...' : 'Start Full Security Scan'}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline">
                    <Shield className="w-4 h-4 mr-2" />
                    Vulnerability Scan
                  </Button>
                  <Button variant="outline">
                    <Activity className="w-4 h-4 mr-2" />
                    Network Scan
                  </Button>
                  <Button variant="outline">
                    <Lock className="w-4 h-4 mr-2" />
                    Audit Logs
                  </Button>
                  <Button variant="outline">
                    <Eye className="w-4 h-4 mr-2" />
                    Intrusion Detection
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Scan Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">Deep packet inspection</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">Malware detection</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label className="text-sm">Aggressive scanning (may affect performance)</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Security Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Real-time Protection</Label>
                    <p className="text-sm text-muted-foreground">Monitor threats in real-time</p>
                  </div>
                  <Switch
                    checked={realTimeProtection}
                    onCheckedChange={setRealTimeProtection}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Auto-block Threats</Label>
                    <p className="text-sm text-muted-foreground">Automatically block high-severity threats</p>
                  </div>
                  <Switch
                    checked={autoBlock}
                    onCheckedChange={setAutoBlock}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Security Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified of security events</p>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="block-threshold">Auto-block Threshold</Label>
                <Input id="block-threshold" defaultValue="5" placeholder="Failed attempts before auto-block" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scan-interval">Automatic Scan Interval (hours)</Label>
                <Input id="scan-interval" defaultValue="24" placeholder="Hours between automatic scans" />
              </div>

              <Button className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};