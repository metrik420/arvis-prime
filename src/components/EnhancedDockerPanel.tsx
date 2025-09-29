import React, { useState, useEffect } from 'react';
import { Server, Play, Square, RotateCcw, Activity, HardDrive, Download, Upload, Settings, Terminal, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Container {
  Id: string;
  Names: string[];
  Image: string;
  State: 'running' | 'stopped' | 'restarting' | 'paused';
  Status: string;
  Ports?: { PrivatePort: number; PublicPort?: number; Type: string }[];
  Created: number;
  NetworkMode?: string;
  Mounts?: any[];
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

export const EnhancedDockerPanel = () => {
  const [containers, setContainers] = useState<Container[]>([
    {
      Id: '1a2b3c4d',
      Names: ['/jarvis-backend'],
      Image: 'jarvis-backend:latest',
      State: 'running',
      Status: 'Up 2 hours',
      Created: Date.now() - 7200000,
      Ports: [{ PrivatePort: 3001, PublicPort: 3001, Type: 'tcp' }]
    },
    {
      Id: '2b3c4d5e',
      Names: ['/home-assistant'],
      Image: 'homeassistant/home-assistant:latest',
      State: 'running',
      Status: 'Up 1 day',
      Created: Date.now() - 86400000,
      Ports: [{ PrivatePort: 8123, PublicPort: 8123, Type: 'tcp' }]
    },
    {
      Id: '3c4d5e6f',
      Names: ['/nginx-proxy'],
      Image: 'nginx:alpine',
      State: 'stopped',
      Status: 'Exited (0) 30 minutes ago',
      Created: Date.now() - 172800000,
      Ports: [{ PrivatePort: 80, PublicPort: 80, Type: 'tcp' }]
    }
  ]);

  const [images, setImages] = useState<DockerImage[]>([
    {
      Id: 'img1',
      RepoTags: ['jarvis-backend:latest'],
      Size: 245000000,
      Created: Date.now() - 3600000
    },
    {
      Id: 'img2',
      RepoTags: ['homeassistant/home-assistant:latest'],
      Size: 1200000000,
      Created: Date.now() - 86400000
    },
    {
      Id: 'img3',
      RepoTags: ['nginx:alpine'],
      Size: 23000000,
      Created: Date.now() - 172800000
    }
  ]);

  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [newContainerDialog, setNewContainerDialog] = useState(false);
  const { toast } = useToast();

  const [newContainer, setNewContainer] = useState({
    name: '',
    image: '',
    ports: '',
    environment: '',
    volumes: '',
    command: ''
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running': return 'default';
      case 'stopped': return 'secondary';
      case 'restarting': return 'destructive';
      case 'paused': return 'outline';
      default: return 'secondary';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'running': return Play;
      case 'stopped': return Square;
      case 'restarting': return RotateCcw;
      case 'paused': return Square;
      default: return Square;
    }
  };

  const handleContainerAction = async (containerId: string, action: string) => {
    const container = containers.find(c => c.Id === containerId);
    if (!container) return;

    try {
      switch (action) {
        case 'start':
          setContainers(prev => prev.map(c => 
            c.Id === containerId 
              ? { ...c, State: 'running', Status: 'Up just now' }
              : c
          ));
          toast({
            title: "Container Started",
            description: `${container.Names[0]} is now running`,
          });
          break;
        
        case 'stop':
          setContainers(prev => prev.map(c => 
            c.Id === containerId 
              ? { ...c, State: 'stopped', Status: 'Exited (0) just now' }
              : c
          ));
          toast({
            title: "Container Stopped",
            description: `${container.Names[0]} has been stopped`,
          });
          break;
        
        case 'restart':
          setContainers(prev => prev.map(c => 
            c.Id === containerId 
              ? { ...c, State: 'running', Status: 'Up just now' }
              : c
          ));
          toast({
            title: "Container Restarted",
            description: `${container.Names[0]} has been restarted`,
          });
          break;
        
        case 'remove':
          setContainers(prev => prev.filter(c => c.Id !== containerId));
          toast({
            title: "Container Removed",
            description: `${container.Names[0]} has been removed`,
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Action Failed",
        description: `Failed to ${action} container`,
        variant: "destructive"
      });
    }
  };

  const handleCreateContainer = async () => {
    const container: Container = {
      Id: Math.random().toString(36).substr(2, 8),
      Names: [`/${newContainer.name}`],
      Image: newContainer.image,
      State: 'stopped',
      Status: 'Created',
      Created: Date.now()
    };

    setContainers(prev => [...prev, container]);
    setNewContainerDialog(false);
    setNewContainer({
      name: '',
      image: '',
      ports: '',
      environment: '',
      volumes: '',
      command: ''
    });

    toast({
      title: "Container Created",
      description: `Container ${newContainer.name} has been created`,
    });
  };

  const viewLogs = (container: Container) => {
    setSelectedContainer(container);
    // Simulate logs
    setLogs([
      `[${new Date().toISOString()}] Container ${container.Names[0]} started`,
      `[${new Date().toISOString()}] Listening on port ${container.Ports?.[0]?.PrivatePort || 3000}`,
      `[${new Date().toISOString()}] Application initialized successfully`,
      `[${new Date().toISOString()}] Ready to accept connections`,
    ]);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = {
    running: containers.filter(c => c.State === 'running').length,
    stopped: containers.filter(c => c.State === 'stopped').length,
    total: containers.length,
    images: images.length
  };

  return (
    <div className="space-y-6">
      {/* Docker Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold text-green-500">{stats.running}</p>
              </div>
              <Play className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stopped</p>
                <p className="text-2xl font-bold text-gray-500">{stats.stopped}</p>
              </div>
              <Square className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Containers</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Server className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Images</p>
                <p className="text-2xl font-bold">{stats.images}</p>
              </div>
              <HardDrive className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="containers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Docker Containers
                </span>
                <Dialog open={newContainerDialog} onOpenChange={setNewContainerDialog}>
                  <DialogTrigger asChild>
                    <Button>Create Container</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Container</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="container-name">Container Name</Label>
                        <Input
                          id="container-name"
                          value={newContainer.name}
                          onChange={(e) => setNewContainer({...newContainer, name: e.target.value})}
                          placeholder="my-container"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="image-name">Image</Label>
                        <Input
                          id="image-name"
                          value={newContainer.image}
                          onChange={(e) => setNewContainer({...newContainer, image: e.target.value})}
                          placeholder="nginx:latest"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="ports">Ports (host:container)</Label>
                        <Input
                          id="ports"
                          value={newContainer.ports}
                          onChange={(e) => setNewContainer({...newContainer, ports: e.target.value})}
                          placeholder="8080:80"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="environment">Environment Variables</Label>
                        <Textarea
                          id="environment"
                          value={newContainer.environment}
                          onChange={(e) => setNewContainer({...newContainer, environment: e.target.value})}
                          placeholder="KEY1=value1&#10;KEY2=value2"
                          rows={3}
                        />
                      </div>
                      
                      <Button onClick={handleCreateContainer} className="w-full">
                        Create Container
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {containers.map((container) => {
                  const StateIcon = getStateIcon(container.State);
                  return (
                    <div key={container.Id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <StateIcon className="w-5 h-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{container.Names[0]}</p>
                            <Badge variant={getStateColor(container.State) as any}>
                              {container.State}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{container.Image}</p>
                          <p className="text-sm text-muted-foreground">{container.Status}</p>
                          {container.Ports && container.Ports.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Ports: {container.Ports.map(p => 
                                p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : p.PrivatePort
                              ).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {container.State === 'stopped' ? (
                          <Button 
                            size="sm" 
                            onClick={() => handleContainerAction(container.Id, 'start')}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleContainerAction(container.Id, 'stop')}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleContainerAction(container.Id, 'restart')}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewLogs(container)}
                        >
                          <Terminal className="w-4 h-4" />
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleContainerAction(container.Id, 'remove')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Docker Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {images.map((image) => (
                  <div key={image.Id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{image.RepoTags[0]}</p>
                      <p className="text-sm text-muted-foreground">Size: {formatBytes(image.Size)}</p>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(image.Created).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Play className="w-4 h-4 mr-2" />
                        Run
                      </Button>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Container Logs
                {selectedContainer && (
                  <Badge variant="outline">{selectedContainer.Names[0]}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedContainer ? (
                <div className="space-y-2">
                  <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                    {logs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download Logs
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLogs([])}>
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select a container to view its logs
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};