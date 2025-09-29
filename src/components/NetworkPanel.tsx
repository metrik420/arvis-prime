import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Globe, Router, Smartphone, Monitor, Printer, Camera, Server, Play, Pause, RefreshCw, MapPin, Shield, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiService, wsService } from '@/lib/api';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Text, Line } from '@react-three/drei';
import * as THREE from 'three';

interface NetworkDevice {
  ip: string;
  mac: string;
  vendor: string;
  hostname?: string;
  classification: {
    type: string;
    confidence: number;
    reasons: string[];
  };
  openPorts: number[];
  webServices: any[];
  os: string;
  alive: boolean;
  discoveryMethods: string[];
}

interface NetworkStats {
  totalDevices: number;
  activeDevices: number;
  deviceTypes: { [key: string]: number };
  securityRisks: number;
}

// 3D Network Visualization Component
const NetworkVisualization: React.FC<{ devices: NetworkDevice[]; onDeviceClick: (device: NetworkDevice) => void }> = ({ devices, onDeviceClick }) => {
  const getDeviceColor = (device: NetworkDevice) => {
    const type = device.classification?.type || 'Unknown';
    const colorMap: { [key: string]: string } = {
      'Router/Gateway': '#00ff88',
      'Smart TV': '#0088ff',
      'Smartphone': '#ff8800',
      'Computer': '#8800ff',
      'Printer': '#ff0088',
      'IP Camera': '#ff4444',
      'IoT Device': '#44ff44',
      'Unknown Device': '#888888'
    };
    return colorMap[type] || '#00ffff';
  };

  const getDevicePosition = (index: number, total: number): [number, number, number] => {
    const radius = 5;
    const phi = (index / total) * Math.PI * 2;
    const theta = Math.acos(1 - 2 * (index % 7) / 7);
    
    return [
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(theta)
    ];
  };

  return (
    <group>
      {/* Central hub/router */}
      <Sphere args={[0.5]} position={[0, 0, 0]}>
        <meshPhongMaterial color="#00ff88" emissive="#004422" />
      </Sphere>
      <Text position={[0, -1, 0]} fontSize={0.3} color="#00ff88">
        Network Hub
      </Text>

      {/* Device nodes */}
      {devices.map((device, index) => {
        const position = getDevicePosition(index, devices.length);
        const color = getDeviceColor(device);
        
        return (
          <group key={device.ip}>
            {/* Device sphere */}
            <Sphere 
              args={[0.2]} 
              position={position}
              onClick={() => onDeviceClick(device)}
            >
              <meshPhongMaterial 
                color={color} 
                emissive={color} 
                emissiveIntensity={0.3}
              />
            </Sphere>
            
            {/* Connection line to center */}
            <Line
              points={[
                [0, 0, 0],
                position
              ]}
              color={color}
              opacity={0.6}
              transparent
            />
            
            {/* Device label */}
            <Text 
              position={[position[0], position[1] - 0.5, position[2]]} 
              fontSize={0.15} 
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {device.hostname || device.ip}
            </Text>
          </group>
        );
      })}
    </group>
  );
};

export const NetworkPanel = () => {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [stats, setStats] = useState<NetworkStats>({
    totalDevices: 0,
    activeDevices: 0,
    deviceTypes: {},
    securityRisks: 0
  });
  const [view3D, setView3D] = useState(true);

  useEffect(() => {
    loadDevices();
    
    // Listen for network updates via WebSocket
    wsService.on('network_device_discovered', (data: any) => {
      setDevices(prev => {
        const existing = prev.find(d => d.ip === data.device.ip);
        if (existing) {
          return prev.map(d => d.ip === data.device.ip ? { ...d, ...data.device } : d);
        }
        return [...prev, data.device];
      });
    });

    wsService.on('network_scan_complete', (data: any) => {
      setDevices(data.devices || []);
      setScanning(false);
    });
  }, []);

  useEffect(() => {
    // Calculate stats whenever devices change
    const activeDevices = devices.filter(d => d.alive).length;
    const deviceTypes: { [key: string]: number } = {};
    let securityRisks = 0;

    devices.forEach(device => {
      const type = device.classification?.type || 'Unknown';
      deviceTypes[type] = (deviceTypes[type] || 0) + 1;
      
      // Count security risks
      if (device.openPorts?.includes(23) || device.openPorts?.includes(21)) { // Telnet or FTP
        securityRisks++;
      }
    });

    setStats({
      totalDevices: devices.length,
      activeDevices,
      deviceTypes,
      securityRisks
    });
  }, [devices]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/network/devices');
      if (response.success) {
        setDevices(response.devices || []);
      }
    } catch (error) {
      console.error('Failed to load network devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNetworkScan = async () => {
    setScanning(true);
    try {
      const response = await apiService.post('/network/scan', {
        timeout: 5000
      });
      
      if (response.success) {
        setDevices(response.devices || []);
      }
    } catch (error) {
      console.error('Network scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (monitoring) {
        await apiService.post('/network/monitoring/stop');
        setMonitoring(false);
      } else {
        await apiService.post('/network/monitoring/start', {
          interval: 300000 // 5 minutes
        });
        setMonitoring(true);
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'router/gateway': return Router;
      case 'smart tv': return Monitor;
      case 'smartphone': return Smartphone;
      case 'printer': return Printer;
      case 'ip camera': return Camera;
      case 'nas/storage': return Server;
      default: return Globe;
    }
  };

  const getSecurityLevel = (device: NetworkDevice) => {
    const riskyPorts = [21, 23, 135, 139, 445]; // FTP, Telnet, NetBIOS, SMB
    const openRiskyPorts = device.openPorts?.filter(port => riskyPorts.includes(port)) || [];
    
    if (openRiskyPorts.length > 0) return 'high';
    if (device.openPorts?.length > 10) return 'medium';
    return 'low';
  };

  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'high': return 'jarvis-status-critical';
      case 'medium': return 'jarvis-status-warning';
      default: return 'jarvis-status-online';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Wifi className="w-7 h-7 text-neon-cyan" />
            <span>Network Discovery</span>
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading network data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Wifi className="w-7 h-7 text-neon-cyan" />
          <span>Network Discovery</span>
        </h1>
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => setView3D(!view3D)}
            className="jarvis-button ghost"
            size="sm"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {view3D ? '2D View' : '3D View'}
          </Button>
          <Button
            onClick={toggleMonitoring}
            className={`jarvis-button ${monitoring ? 'ghost' : 'default'}`}
            size="sm"
          >
            {monitoring ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {monitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button
            onClick={startNetworkScan}
            disabled={scanning}
            className="jarvis-button default"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Network'}
          </Button>
        </div>
      </div>

      {/* Network Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold jarvis-status-online">{stats.totalDevices}</p>
              </div>
              <Globe className="w-8 h-8 text-neon-cyan" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Devices</p>
                <p className="text-2xl font-bold jarvis-status-online">{stats.activeDevices}</p>
              </div>
              <Wifi className="w-8 h-8 text-neon-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Device Types</p>
                <p className="text-2xl font-bold jarvis-status-online">{Object.keys(stats.deviceTypes).length}</p>
              </div>
              <Router className="w-8 h-8 text-neon-blue" />
            </div>
          </CardContent>
        </Card>

        <Card className="jarvis-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Risks</p>
                <p className="text-2xl font-bold jarvis-status-warning">{stats.securityRisks}</p>
              </div>
              <Shield className="w-8 h-8 text-neon-orange" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Network Visualization */}
        {view3D && (
          <Card className="jarvis-panel lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-neon-cyan" />
                <span>Network Topology</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <Canvas camera={{ position: [10, 10, 10], fov: 60 }}>
                  <ambientLight intensity={0.3} />
                  <pointLight position={[10, 10, 10]} />
                  <NetworkVisualization 
                    devices={devices} 
                    onDeviceClick={setSelectedDevice}
                  />
                  <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
                </Canvas>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Device Details */}
        <Card className={`jarvis-panel ${view3D ? '' : 'lg:col-span-3'}`}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-neon-green" />
              <span>Device Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDevice ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  {React.createElement(getDeviceIcon(selectedDevice.classification?.type || ''), { 
                    className: "w-6 h-6 text-neon-cyan" 
                  })}
                  <div>
                    <h3 className="font-semibold jarvis-mono">{selectedDevice.hostname || selectedDevice.ip}</h3>
                    <p className="text-sm text-muted-foreground">{selectedDevice.classification?.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">IP Address</p>
                    <p className="jarvis-mono">{selectedDevice.ip}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MAC Address</p>
                    <p className="jarvis-mono text-xs">{selectedDevice.mac || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="text-sm">{selectedDevice.vendor || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">OS</p>
                    <p className="text-sm">{selectedDevice.os || 'Unknown'}</p>
                  </div>
                </div>

                {selectedDevice.openPorts && selectedDevice.openPorts.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Open Ports</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDevice.openPorts.slice(0, 10).map(port => (
                        <Badge key={port} variant="outline" className="text-xs">
                          {port}
                        </Badge>
                      ))}
                      {selectedDevice.openPorts.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{selectedDevice.openPorts.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Security Level</p>
                  <p className={`text-sm font-semibold ${getSecurityColor(getSecurityLevel(selectedDevice))}`}>
                    {getSecurityLevel(selectedDevice).toUpperCase()}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Discovery Methods</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedDevice.discoveryMethods?.map(method => (
                      <Badge key={method} variant="secondary" className="text-xs">
                        {method.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {view3D ? 'Click on a device in the 3D view to see details' : 'Select a device from the list below'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      {!view3D && (
        <Card className="jarvis-panel">
          <CardHeader>
            <CardTitle>Discovered Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device) => {
                const Icon = getDeviceIcon(device.classification?.type || '');
                const securityLevel = getSecurityLevel(device);
                
                return (
                  <div
                    key={device.ip}
                    onClick={() => setSelectedDevice(device)}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-surface/30 hover:bg-surface/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <Icon className="w-6 h-6 text-neon-cyan" />
                      <div>
                        <p className="font-medium jarvis-mono">{device.hostname || device.ip}</p>
                        <p className="text-sm text-muted-foreground">{device.classification?.type}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-sm jarvis-mono">{device.ip}</p>
                        <p className="text-xs text-muted-foreground">{device.vendor}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm jarvis-mono">{device.openPorts?.length || 0} ports</p>
                        <p className={`text-xs ${getSecurityColor(securityLevel)}`}>
                          {securityLevel.toUpperCase()}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${device.alive ? 'jarvis-status-online bg-current' : 'bg-gray-500'}`} />
                    </div>
                  </div>
                );
              })}
              
              {devices.length === 0 && (
                <div className="text-center py-8">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No devices discovered yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Click "Scan Network" to discover devices</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};