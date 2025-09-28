import React, { useState } from 'react';
import { Home, Lightbulb, Thermometer, Lock, Shield, Volume2, Tv, Coffee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export const HomeAssistantPanel = () => {
  const [devices, setDevices] = useState([
    {
      id: 'living_room_lights',
      name: 'Living Room Lights',
      type: 'light',
      state: true,
      brightness: 80,
      icon: Lightbulb,
    },
    {
      id: 'thermostat',
      name: 'Main Thermostat',
      type: 'climate',
      state: true,
      temperature: 22,
      target: 21,
      icon: Thermometer,
    },
    {
      id: 'front_door',
      name: 'Front Door Lock',
      type: 'lock',
      state: false,
      icon: Lock,
    },
    {
      id: 'security_system',
      name: 'Security System',
      type: 'alarm',
      state: true,
      mode: 'armed_home',
      icon: Shield,
    },
    {
      id: 'living_room_tv',
      name: 'Living Room TV',
      type: 'media',
      state: false,
      icon: Tv,
    },
    {
      id: 'coffee_maker',
      name: 'Coffee Maker',
      type: 'switch',
      state: false,
      icon: Coffee,
    },
  ]);

  const [scenes] = useState([
    { id: 'night_mode', name: 'Night Mode', description: 'Dim lights, arm security, lock doors' },
    { id: 'movie_night', name: 'Movie Night', description: 'Dim lights, turn on TV, close blinds' },
    { id: 'work_focus', name: 'Work Focus', description: 'Bright lights, turn off notifications' },
    { id: 'away_mode', name: 'Away Mode', description: 'Turn off lights, arm security, lock all doors' },
  ]);

  const toggleDevice = (deviceId: string) => {
    setDevices(devices.map(device => 
      device.id === deviceId ? { ...device, state: !device.state } : device
    ));
  };

  const executeScene = (sceneId: string) => {
    // Mock scene execution
    console.log(`Executing scene: ${sceneId}`);
  };

  const getDeviceStatus = (device: any) => {
    if (device.type === 'climate') {
      return `${device.temperature}°C → ${device.target}°C`;
    }
    if (device.type === 'alarm') {
      return device.mode.replace('_', ' ').toUpperCase();
    }
    return device.state ? 'ON' : 'OFF';
  };

  const getStatusColor = (device: any) => {
    if (device.type === 'lock') {
      return device.state ? 'jarvis-status-critical' : 'jarvis-status-online';
    }
    if (device.type === 'alarm') {
      return device.state ? 'jarvis-status-warning' : 'jarvis-status-critical';
    }
    return device.state ? 'jarvis-status-online' : 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Home className="w-7 h-7 text-neon-cyan" />
          <span>Home Assistant</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Connected devices:</span>
          <span className="text-sm jarvis-mono jarvis-status-online">{devices.length}</span>
        </div>
      </div>

      {/* Quick Scenes */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle>Quick Scenes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {scenes.map((scene) => (
              <Button
                key={scene.id}
                onClick={() => executeScene(scene.id)}
                className="jarvis-button ghost flex flex-col items-center space-y-2 h-24 text-left"
              >
                <Volume2 className="w-6 h-6" />
                <div>
                  <div className="font-medium">{scene.name}</div>
                  <div className="text-xs text-muted-foreground">{scene.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device Controls */}
      <div className="jarvis-grid">
        {devices.map((device) => {
          const Icon = device.icon;
          return (
            <Card key={device.id} className="jarvis-panel hover-scale">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-neon-cyan" />
                    <span className="text-base">{device.name}</span>
                  </div>
                  <Switch
                    checked={device.state}
                    onCheckedChange={() => toggleDevice(device.id)}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-sm jarvis-mono ${getStatusColor(device)}`}>
                      {getDeviceStatus(device)}
                    </span>
                  </div>
                  
                  {device.type === 'light' && device.brightness && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Brightness</span>
                      <span className="text-sm jarvis-mono">{device.brightness}%</span>
                    </div>
                  )}
                  
                  {device.type === 'climate' && (
                    <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-cyan transition-all duration-300"
                        style={{ width: `${(device.temperature / 30) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Climate Overview */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Thermometer className="w-5 h-5 text-neon-orange" />
            <span>Climate Control</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Living Room</p>
              <p className="text-2xl font-bold jarvis-status-online">22°C</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Bedroom</p>
              <p className="text-2xl font-bold jarvis-status-online">20°C</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Outside</p>
              <p className="text-2xl font-bold text-muted-foreground">15°C</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};