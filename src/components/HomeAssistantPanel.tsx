import React, { useState, useEffect } from 'react';
import { Home, Lightbulb, Thermometer, Lock, Shield, Volume2, Tv, Coffee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { apiService, wsService } from '@/lib/api';

export const HomeAssistantPanel = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenes] = useState([
    { id: 'night_mode', name: 'Night Mode', description: 'Dim lights, arm security, lock doors' },
    { id: 'movie_night', name: 'Movie Night', description: 'Dim lights, turn on TV, close blinds' },
    { id: 'work_focus', name: 'Work Focus', description: 'Bright lights, turn off notifications' },
    { id: 'away_mode', name: 'Away Mode', description: 'Turn off lights, arm security, lock all doors' },
  ]);

  useEffect(() => {
    // Fetch Home Assistant entities
    const fetchEntities = async () => {
      try {
        const response = await apiService.getEntities();
        if (response.success && response.data) {
          setDevices(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch Home Assistant entities:', error);
        // Fallback to mock data if API fails
        setDevices([
          {
            entity_id: 'light.living_room',
            friendly_name: 'Living Room Lights',
            state: 'on',
            domain: 'light',
            attributes: { brightness: 80 }
          },
          {
            entity_id: 'climate.thermostat',
            friendly_name: 'Main Thermostat',
            state: 'heat',
            domain: 'climate',
            attributes: { current_temperature: 22, temperature: 21 }
          },
          {
            entity_id: 'lock.front_door',
            friendly_name: 'Front Door Lock',
            state: 'locked',
            domain: 'lock'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();

    // Listen for Home Assistant state changes
    wsService.on('homeassistant_state', (data: any) => {
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.entity_id === data.entity_id 
            ? { ...device, state: data.state, attributes: { ...device.attributes, ...data.attributes } }
            : device
        )
      );
    });
  }, []);

  const toggleDevice = async (entityId: string) => {
    const device = devices.find(d => d.entity_id === entityId);
    if (!device) return;

    try {
      const isCurrentlyOn = device.state === 'on' || device.state === 'unlocked';
      
      if (isCurrentlyOn) {
        await apiService.turnOff(entityId);
      } else {
        await apiService.turnOn(entityId);
      }
      
      // Optimistic update
      setDevices(devices.map(d => 
        d.entity_id === entityId 
          ? { ...d, state: isCurrentlyOn ? 'off' : 'on' }
          : d
      ));
    } catch (error) {
      console.error('Failed to toggle device:', error);
    }
  };

  const executeScene = async (sceneId: string) => {
    try {
      // Send scene execution command via WebSocket
      wsService.send({
        type: 'tool_request',
        tool: 'homeassistant',
        action: 'call_service',
        args: {
          domain: 'scene',
          service: 'turn_on',
          serviceData: { entity_id: `scene.${sceneId}` }
        }
      });
    } catch (error) {
      console.error('Failed to execute scene:', error);
    }
  };

  const getDeviceIcon = (domain: string) => {
    switch (domain) {
      case 'light': return Lightbulb;
      case 'climate': return Thermometer;
      case 'lock': return Lock;
      case 'alarm_control_panel': return Shield;
      case 'media_player': return Tv;
      case 'switch': return Coffee;
      default: return Home;
    }
  };

  const getDeviceStatus = (device: any) => {
    if (device.domain === 'climate') {
      return `${device.attributes?.current_temperature || 0}°C → ${device.attributes?.temperature || 0}°C`;
    }
    if (device.domain === 'alarm_control_panel') {
      return device.state.replace('_', ' ').toUpperCase();
    }
    if (device.domain === 'lock') {
      return device.state === 'locked' ? 'LOCKED' : 'UNLOCKED';
    }
    return device.state?.toUpperCase() || 'UNKNOWN';
  };

  const getStatusColor = (device: any) => {
    if (device.domain === 'lock') {
      return device.state === 'locked' ? 'jarvis-status-online' : 'jarvis-status-critical';
    }
    if (device.domain === 'alarm_control_panel') {
      return device.state.includes('armed') ? 'jarvis-status-warning' : 'jarvis-status-critical';
    }
    return device.state === 'on' ? 'jarvis-status-online' : 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Home className="w-7 h-7 text-neon-cyan" />
            <span>Home Assistant</span>
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    );
  }

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
          const Icon = getDeviceIcon(device.domain);
          const isOn = device.state === 'on' || device.state === 'unlocked';
          
          return (
            <Card key={device.entity_id} className="jarvis-panel hover-scale">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-neon-cyan" />
                    <span className="text-base">{device.friendly_name || device.entity_id}</span>
                  </div>
                  <Switch
                    checked={isOn}
                    onCheckedChange={() => toggleDevice(device.entity_id)}
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
                  
                  {device.domain === 'light' && device.attributes?.brightness && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Brightness</span>
                      <span className="text-sm jarvis-mono">{device.attributes.brightness}%</span>
                    </div>
                  )}
                  
                  {device.domain === 'climate' && (
                    <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-cyan transition-all duration-300"
                        style={{ width: `${(device.attributes?.current_temperature / 30) * 100}%` }}
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