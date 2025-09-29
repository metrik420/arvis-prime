import React, { useState } from 'react';
import { Shield, Ban, Zap, Activity, Settings, Play, Pause, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface NetworkControlPanelProps {
  selectedDevice: any;
  onDeviceAction: (action: string, device: any) => void;
  networkConfig: any;
  onConfigChange: (config: any) => void;
  monitoringEnabled: boolean;
  onMonitoringToggle: (enabled: boolean) => void;
  scanProgress: number;
  onStartScan: () => void;
}

export const NetworkControlPanel: React.FC<NetworkControlPanelProps> = ({
  selectedDevice,
  onDeviceAction,
  networkConfig,
  onConfigChange,
  monitoringEnabled,
  onMonitoringToggle,
  scanProgress,
  onStartScan
}) => {
  const [isBlocking, setIsBlocking] = useState(false);
  const [portScanTarget, setPortScanTarget] = useState('');
  const { toast } = useToast();

  const handleBlockDevice = async (device: any) => {
    setIsBlocking(true);
    try {
      // In demo mode, just simulate the action
      toast({
        title: "Device Blocked",
        description: `Successfully blocked ${device.ip} (${device.hostname})`,
      });
      onDeviceAction('block', device);
    } catch (error) {
      toast({
        title: "Block Failed",
        description: "Failed to block device",
        variant: "destructive"
      });
    } finally {
      setIsBlocking(false);
    }
  };

  const handlePingDevice = async (device: any) => {
    try {
      toast({
        title: "Ping Test",
        description: `Pinging ${device.ip}... Response time: 12ms`,
      });
    } catch (error) {
      toast({
        title: "Ping Failed",
        description: "Device unreachable",
        variant: "destructive"
      });
    }
  };

  const handlePortScan = async () => {
    if (!portScanTarget) return;
    
    toast({
      title: "Port Scan Started",
      description: `Scanning ports on ${portScanTarget}`,
    });

    // Simulate port scan
    setTimeout(() => {
      toast({
        title: "Port Scan Complete",
        description: "Open ports: 22, 80, 443, 8080",
      });
    }, 3000);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="device" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="device">Device Control</TabsTrigger>
          <TabsTrigger value="scan">Network Scan</TabsTrigger>
          <TabsTrigger value="monitor">Monitoring</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="device" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Device Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDevice ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold">{selectedDevice.hostname || selectedDevice.ip}</h4>
                    <p className="text-sm text-muted-foreground">{selectedDevice.vendor}</p>
                    <Badge variant={selectedDevice.status === 'online' ? 'default' : 'secondary'}>
                      {selectedDevice.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handlePingDevice(selectedDevice)} size="sm">
                      <Activity className="w-4 h-4 mr-2" />
                      Ping Test
                    </Button>
                    <Button 
                      onClick={() => handleBlockDevice(selectedDevice)} 
                      variant="destructive" 
                      size="sm"
                      disabled={isBlocking}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Block Device
                    </Button>
                    <Button onClick={() => onDeviceAction('wake', selectedDevice)} size="sm">
                      <Zap className="w-4 h-4 mr-2" />
                      Wake on LAN
                    </Button>
                    <Button onClick={() => onDeviceAction('monitor', selectedDevice)} size="sm">
                      <Shield className="w-4 h-4 mr-2" />
                      Monitor
                    </Button>
                  </div>

                  {selectedDevice.ports && selectedDevice.ports.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Open Ports</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDevice.ports.map((port: number) => (
                          <Badge key={port} variant="outline" className="text-xs">
                            {port}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select a device from the network visualization to control it
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Network Scanning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subnet">Subnet to Scan</Label>
                <Input
                  id="subnet"
                  value={networkConfig.subnet}
                  onChange={(e) => onConfigChange({ ...networkConfig, subnet: e.target.value })}
                  placeholder="192.168.1.0/24"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={networkConfig.timeout}
                  onChange={(e) => onConfigChange({ ...networkConfig, timeout: parseInt(e.target.value) })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={networkConfig.portScanEnabled}
                  onCheckedChange={(checked) => onConfigChange({ ...networkConfig, portScanEnabled: checked })}
                />
                <Label>Enable Port Scanning</Label>
              </div>

              {scanProgress > 0 && scanProgress < 100 && (
                <div className="space-y-2">
                  <Label>Scan Progress</Label>
                  <Progress value={scanProgress} />
                  <p className="text-sm text-muted-foreground">{scanProgress}% complete</p>
                </div>
              )}

              <Button onClick={onStartScan} className="w-full" disabled={scanProgress > 0 && scanProgress < 100}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Network Scan
              </Button>

              <div className="space-y-2">
                <Label htmlFor="port-scan">Custom Port Scan</Label>
                <div className="flex gap-2">
                  <Input
                    id="port-scan"
                    value={portScanTarget}
                    onChange={(e) => setPortScanTarget(e.target.value)}
                    placeholder="192.168.1.100"
                  />
                  <Button onClick={handlePortScan} disabled={!portScanTarget}>
                    Scan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Network Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Continuous Monitoring</Label>
                  <p className="text-sm text-muted-foreground">Automatically scan for new devices</p>
                </div>
                <Switch
                  checked={monitoringEnabled}
                  onCheckedChange={onMonitoringToggle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Scan Interval (minutes)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={networkConfig.scanInterval / 60000}
                  onChange={(e) => onConfigChange({ 
                    ...networkConfig, 
                    scanInterval: parseInt(e.target.value) * 60000 
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Monitoring Stats</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Devices Tracked</p>
                    <p className="font-semibold">15</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">New Devices Today</p>
                    <p className="font-semibold">2</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Alerts Generated</p>
                    <p className="font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uptime</p>
                    <p className="font-semibold">99.8%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Advanced Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={networkConfig.autoScan}
                  onCheckedChange={(checked) => onConfigChange({ ...networkConfig, autoScan: checked })}
                />
                <Label>Automatic Scanning on Startup</Label>
              </div>

              <div className="space-y-2">
                <Label>Discovery Methods</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">ARP Scanning</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">mDNS Discovery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">UPnP Discovery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label className="text-sm">SNMP Scanning</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Security Settings</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked />
                    <Label className="text-sm">Block Unknown Devices</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label className="text-sm">Alert on New Devices</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch />
                    <Label className="text-sm">Aggressive Port Scanning</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};