import React, { useState, useEffect } from 'react';
import { Server, Play, Square, RotateCcw, Activity, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService, wsService } from '@/lib/api';

export const DockerPanel = () => {
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const response = await apiService.getContainers();
        if (response.success && response.data) {
          setContainers(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch containers:', error);
        // Fallback mock data
        setContainers([
          {
            Id: '1',
            Names: ['/jarvis-backend'],
            Image: 'jarvis-backend:latest',
            State: 'running',
            Status: 'Up 2 hours'
          },
          {
            Id: '2', 
            Names: ['/home-assistant'],
            Image: 'homeassistant/home-assistant:latest',
            State: 'running',
            Status: 'Up 1 day'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();

    // Listen for container updates
    wsService.on('docker_update', (data: any) => {
      fetchContainers();
    });

    // Refresh every 30 seconds
    const interval = setInterval(fetchContainers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleContainerAction = async (containerId: string, action: string) => {
    try {
      let response;
      switch (action) {
        case 'start':
          response = await apiService.startContainer(containerId);
          break;
        case 'stop':
          response = await apiService.stopContainer(containerId);
          break;
        case 'restart':
          // Send restart command via WebSocket
          wsService.send({
            type: 'tool_request',
            tool: 'docker',
            action: 'restart_container',
            args: { nameOrId: containerId }
          });
          break;
      }
      
      if (response?.success) {
        // Refresh containers after action
        setTimeout(() => {
          const fetchContainers = async () => {
            const updatedResponse = await apiService.getContainers();
            if (updatedResponse.success) {
              setContainers(updatedResponse.data);
            }
          };
          fetchContainers();
        }, 1000);
      }
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    }
  };

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'jarvis-status-online';
      case 'exited':
        return 'jarvis-status-critical';
      case 'paused':
        return 'jarvis-status-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return <Activity className="w-4 h-4" />;
      case 'exited':
        return <Square className="w-4 h-4" />;
      default:
        return <HardDrive className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Server className="w-7 h-7 text-neon-cyan" />
            <span>Docker Containers</span>
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading containers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Server className="w-7 h-7 text-neon-cyan" />
          <span>Docker Management</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Active containers:</span>
          <span className="text-sm jarvis-mono jarvis-status-online">
            {containers.filter(c => c.State === 'running').length}
          </span>
        </div>
      </div>

      <div className="jarvis-grid">
        {containers.map((container) => {
          const containerName = container.Names?.[0]?.replace('/', '') || container.Id.slice(0, 12);
          const isRunning = container.State === 'running';
          
          return (
            <Card key={container.Id} className="jarvis-panel hover-scale">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={getStatusColor(container.State)}>
                      {getStatusIcon(container.State)}
                    </div>
                    <span className="text-base">{containerName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      onClick={() => handleContainerAction(container.Id, 'start')}
                      disabled={isRunning}
                      className="jarvis-button ghost w-8 h-8 p-0"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleContainerAction(container.Id, 'stop')}
                      disabled={!isRunning}
                      className="jarvis-button ghost w-8 h-8 p-0"
                    >
                      <Square className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleContainerAction(container.Id, 'restart')}
                      className="jarvis-button ghost w-8 h-8 p-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-sm jarvis-mono ${getStatusColor(container.State)}`}>
                      {container.State?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Image</span>
                    <span className="text-sm jarvis-mono text-right truncate max-w-32">
                      {container.Image}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="text-sm jarvis-mono">
                      {container.Status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* System Info */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-neon-cyan" />
            <span>Docker System</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold jarvis-status-online">
                {containers.filter(c => c.State === 'running').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Stopped</p>
              <p className="text-2xl font-bold jarvis-status-critical">
                {containers.filter(c => c.State === 'exited').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">
                {containers.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};