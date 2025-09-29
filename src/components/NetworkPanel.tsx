import React, { useState, useEffect } from 'react';
import { Wifi, Globe, Router, Smartphone, Monitor, Server, RefreshCw, Shield, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiService } from '@/lib/api';
import { Network3D } from './Network3D';
import { NetworkControlPanel } from './NetworkControlPanel';

interface NetworkDevice {
  ip: string;
  mac: string;
  vendor: string;
  hostname?: string;
  type?: string;
  status: 'online' | 'offline';
  ports?: number[];
  classification?: string;
}

export const NetworkPanel = () => {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [view3D, setView3D] = useState(true);
  const [networkConfig, setNetworkConfig] = useState({
    subnet: '192.168.1.0/24',
    timeout: 1000,
    portScanEnabled: true,
    autoScan: false,
    scanInterval: 300000
  });
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNetworkDevices();
      if (response.devices) {
        setDevices(response.devices);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNetworkScan = async () => {
    setLoading(true);
    setScanProgress(0);
    
    try {
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      const response = await apiService.scanNetwork(networkConfig.subnet, networkConfig.timeout);
      if (response.devices) {
        setDevices(response.devices);
      }
    } catch (error) {
      console.error('Network scan failed:', error);
    } finally {
      setLoading(false);
      setTimeout(() => setScanProgress(0), 2000);
    }
  };

  const handleDeviceAction = (action: string, device: any) => {
    console.log(`Performing ${action} on device:`, device);
  };

  const stats = {
    totalDevices: devices.length,
    activeDevices: devices.filter(d => d.status === 'online').length,
    securityRisks: devices.filter(d => d.ports && d.ports.length > 5).length
  };

  return (
    <div className="space-y-6">
      {/* Network Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{stats.totalDevices}</p>
              </div>
              <Wifi className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Devices</p>
                <p className="text-2xl font-bold text-green-500">{stats.activeDevices}</p>
              </div>
              <Globe className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Risks</p>
                <p className="text-2xl font-bold text-red-500">{stats.securityRisks}</p>
              </div>
              <Shield className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scan Progress</p>
                <Progress value={scanProgress} className="w-full mt-2" />
              </div>
              <RefreshCw className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Visualization */}
        {view3D && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    3D Network Topology
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setView3D(false)}
                  >
                    Switch to List View
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Network3D 
                  devices={devices} 
                  onDeviceClick={setSelectedDevice}
                  selectedDevice={selectedDevice}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Device List */}
        {!view3D && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wifi className="w-5 h-5" />
                    Network Devices
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setView3D(true)}
                  >
                    Switch to 3D View
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div 
                      key={device.ip}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDevice(device)}
                    >
                      <div className="flex items-center gap-3">
                        <Server className="w-5 h-5" />
                        <div>
                          <p className="font-medium">{device.hostname || device.ip}</p>
                          <p className="text-sm text-muted-foreground">{device.vendor}</p>
                        </div>
                      </div>
                      <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                        {device.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Control Panel */}
        <div>
          <NetworkControlPanel
            selectedDevice={selectedDevice}
            onDeviceAction={handleDeviceAction}
            networkConfig={networkConfig}
            onConfigChange={setNetworkConfig}
            monitoringEnabled={monitoringEnabled}
            onMonitoringToggle={setMonitoringEnabled}
            scanProgress={scanProgress}
            onStartScan={startNetworkScan}
          />
        </div>
      </div>
    </div>
  );
};