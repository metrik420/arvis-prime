import React, { useState, useEffect } from 'react';
import { Power, Cpu, HardDrive, Wifi, Shield, Home, Server, Brain, Settings, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiService } from '@/lib/api';

interface SystemStatus {
  online: boolean;
  uptime: number;
  cpu: number;
  memory: number;
  storage: number;
  temperature: number;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: string;
  description: string;
}

export const MasterControlPanel: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    online: true,
    uptime: 259200,
    cpu: 45.2,
    memory: 67.8,
    storage: 82.1,
    temperature: 52
  });

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Network Discovery', status: 'running', uptime: '2d 3h', description: 'Active network scanning' },
    { name: 'Voice Assistant', status: 'running', uptime: '2d 3h', description: 'ElevenLabs integration' },
    { name: 'Home Assistant', status: 'running', uptime: '5d 12h', description: 'Smart home control' },
    { name: 'Docker Engine', status: 'running', uptime: '7d 8h', description: 'Container management' },
    { name: 'Security Monitor', status: 'running', uptime: '2d 3h', description: 'Threat detection' },
    { name: 'Media Server', status: 'stopped', uptime: '0m', description: 'Multimedia streaming' }
  ]);

  const [alerts, setAlerts] = useState([
    { id: 1, type: 'warning', message: 'High CPU usage detected (>80%)', timestamp: '2 minutes ago' },
    { id: 2, type: 'info', message: 'New device discovered on network', timestamp: '5 minutes ago' },
    { id: 3, type: 'success', message: 'Security scan completed - no threats', timestamp: '10 minutes ago' }
  ]);

  const [quickActions] = useState([
    { name: 'Restart All Services', icon: Power, action: 'restart_services', variant: 'destructive' as const },
    { name: 'Full System Scan', icon: Shield, action: 'security_scan', variant: 'default' as const },
    { name: 'Network Discovery', icon: Wifi, action: 'network_scan', variant: 'default' as const },
    { name: 'Container Health Check', icon: Server, action: 'docker_check', variant: 'default' as const },
    { name: 'Voice Calibration', icon: Brain, action: 'voice_calibration', variant: 'default' as const },
    { name: 'Home Auto Sync', icon: Home, action: 'ha_sync', variant: 'default' as const }
  ]);

  useEffect(() => {
    // Simulate real-time system monitoring
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        cpu: Math.max(20, Math.min(95, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(30, Math.min(90, prev.memory + (Math.random() - 0.5) * 5)),
        temperature: Math.max(35, Math.min(70, prev.temperature + (Math.random() - 0.5) * 3))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleQuickAction = async (action: string) => {
    console.log(`Executing quick action: ${action}`);
    // In demo mode, just show success
    switch (action) {
      case 'restart_services':
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'info',
          message: 'Service restart initiated',
          timestamp: 'Just now'
        }]);
        break;
      case 'security_scan':
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'info',
          message: 'Security scan started',
          timestamp: 'Just now'
        }]);
        break;
      default:
        setAlerts(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `${action.replace('_', ' ')} completed successfully`,
          timestamp: 'Just now'
        }]);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">Online</span>
                </div>
              </div>
              <Power className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Uptime: {formatUptime(systemStatus.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CPU Usage</p>
                <p className="font-semibold">{systemStatus.cpu.toFixed(1)}%</p>
                <Progress value={systemStatus.cpu} className="w-16 h-2 mt-1" />
              </div>
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Temp: {systemStatus.temperature}°C
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Memory</p>
                <p className="font-semibold">{systemStatus.memory.toFixed(1)}%</p>
                <Progress value={systemStatus.memory} className="w-16 h-2 mt-1" />
              </div>
              <HardDrive className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              8.2GB / 16GB used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Storage</p>
                <p className="font-semibold">{systemStatus.storage.toFixed(1)}%</p>
                <Progress value={systemStatus.storage} className="w-16 h-2 mt-1" />
              </div>
              <HardDrive className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              410GB / 500GB used
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={service.status === 'running' ? 'default' : service.status === 'error' ? 'destructive' : 'secondary'}
                      >
                        {service.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{service.uptime}</p>
                      <p className="text-xs text-muted-foreground">uptime</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Alert key={alert.id} className={
                    alert.type === 'warning' ? 'border-yellow-500' :
                    alert.type === 'error' ? 'border-red-500' : 
                    alert.type === 'success' ? 'border-green-500' : 'border-blue-500'
                  }>
                    <AlertDescription className="flex justify-between items-center">
                      <span>{alert.message}</span>
                      <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={index}
                      variant={action.variant}
                      onClick={() => handleQuickAction(action.action)}
                      className="justify-start h-auto p-4"
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <p className="font-medium">{action.name}</p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};