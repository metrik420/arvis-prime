import React, { useState, useEffect } from 'react';
import { Terminal, Brain, CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { wsService } from '@/lib/api';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'transcript' | 'intent' | 'tool_call' | 'result' | 'error';
  content: string;
  metadata?: any;
}

export const ConsolePanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: '14:25:33',
      type: 'transcript',
      content: 'Set house to Night Mode and arm perimeter',
    },
    {
      id: '2',
      timestamp: '14:25:34',
      type: 'intent',
      content: 'Scene execution: night_mode + security arming',
    },
    {
      id: '3',
      timestamp: '14:25:35',
      type: 'tool_call',
      content: 'homeassistant.set_scene(name: "night")',
    },
    {
      id: '4',
      timestamp: '14:25:36',
      type: 'result',
      content: 'Night scene activated successfully',
    },
    {
      id: '5',
      timestamp: '14:25:37',
      type: 'tool_call',
      content: 'homeassistant.arm_perimeter(mode: "home")',
    },
    {
      id: '6',
      timestamp: '14:25:38',
      type: 'result',
      content: 'Security system armed in home mode',
    },
  ]);

  const [currentTranscript, setCurrentTranscript] = useState('Listening...');
  const [isProcessing, setIsProcessing] = useState(false);

  // Real-time updates from WebSocket
  useEffect(() => {
    // Listen for various event types
    wsService.on('transcript', (data: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: 'transcript',
        content: data.transcript || data.content,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    });

    wsService.on('intent', (data: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: 'intent',
        content: data.intent || data.content,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    });

    wsService.on('tool_call', (data: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: 'tool_call',
        content: data.tool || data.content,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    });

    wsService.on('result', (data: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: 'result',
        content: data.result || data.content,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    });

    wsService.on('error', (data: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        type: 'error',
        content: data.error || data.message || 'Unknown error',
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'transcript':
        return <Terminal className="w-4 h-4" />;
      case 'intent':
        return <Brain className="w-4 h-4" />;
      case 'tool_call':
        return <ArrowRight className="w-4 h-4" />;
      case 'result':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'transcript':
        return 'text-neon-cyan';
      case 'intent':
        return 'text-neon-purple';
      case 'tool_call':
        return 'text-neon-orange';
      case 'result':
        return 'jarvis-status-online';
      case 'error':
        return 'jarvis-status-critical';
      default:
        return 'text-muted-foreground';
    }
  };

  const activeTools = [
    { name: 'Home Assistant', status: 'online', lastUsed: '2 min ago' },
    { name: 'Docker Engine', status: 'online', lastUsed: '5 min ago' },
    { name: 'Security Ops', status: 'online', lastUsed: '1 min ago' },
    { name: 'Plex Media', status: 'idle', lastUsed: '15 min ago' },
    { name: 'Search & RAG', status: 'online', lastUsed: '30 sec ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Brain className="w-7 h-7 text-neon-cyan" />
          <span>Jarvis Console</span>
        </h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">System:</span>
          <span className="text-sm jarvis-mono jarvis-status-online">OPERATIONAL</span>
        </div>
      </div>

      {/* Current Transcript */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-neon-cyan" />
            <span>Live Transcript</span>
            {isProcessing && (
              <div className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-elevated rounded-lg p-4 jarvis-mono">
            <p className="text-neon-cyan text-lg">{currentTranscript}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <Card className="jarvis-panel">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-surface/30 border border-border/20"
                >
                  <div className={`mt-0.5 ${getLogColor(log.type)}`}>
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${getLogColor(log.type)} font-medium`}>
                        {log.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground jarvis-mono">
                        {log.timestamp}
                      </span>
                    </div>
                    <p className="text-sm mt-1 jarvis-mono">{log.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Tools */}
        <Card className="jarvis-panel">
          <CardHeader>
            <CardTitle>Active Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTools.map((tool, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface/30 border border-border/20"
                >
                  <div>
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Last used: {tool.lastUsed}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        tool.status === 'online'
                          ? 'bg-neon-green animate-pulse'
                          : 'bg-muted'
                      }`}
                    />
                    <span
                      className={`text-xs jarvis-mono ${
                        tool.status === 'online'
                          ? 'jarvis-status-online'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {tool.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle>Quick Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border/30 bg-surface/20 hover:border-neon-cyan/30 transition-colors cursor-pointer">
              <p className="font-medium">System Status</p>
              <p className="text-sm text-muted-foreground jarvis-mono">
                "Status of all containers"
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-surface/20 hover:border-neon-cyan/30 transition-colors cursor-pointer">
              <p className="font-medium">Security Scan</p>
              <p className="text-sm text-muted-foreground jarvis-mono">
                "Run security scan on all devices"
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-surface/20 hover:border-neon-cyan/30 transition-colors cursor-pointer">
              <p className="font-medium">Night Mode</p>
              <p className="text-sm text-muted-foreground jarvis-mono">
                "Set house to night mode"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};