import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Mic, MicOff, Volume2, VolumeX, Power, Cpu, HardDrive, Shield, Home, Server, Brain, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HolographicRing } from '@/components/three/HolographicRing';
import { VoiceWaveform } from '@/components/VoiceWaveform';
import { SystemMetrics } from '@/components/SystemMetrics';
import { SecurityPanel } from '@/components/SecurityPanel';
import { HomeAssistantPanel } from '@/components/HomeAssistantPanel';
import { ConsolePanel } from '@/components/ConsolePanel';
import { DockerPanel } from '@/components/DockerPanel';
import SettingsPanel from '@/components/SettingsPanel';
import { wsService, apiService } from '@/lib/api';

const JarvisHUD = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activePanel, setActivePanel] = useState('console');
  const [isOnline, setIsOnline] = useState(false);

  // Connect to WebSocket on component mount
  useEffect(() => {
    wsService.connect();

    wsService.on('connected', () => {
      setIsOnline(true);
    });

    wsService.on('disconnected', () => {
      setIsOnline(false);
    });

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Real voice interaction
  const toggleListening = () => {
    if (!isOnline) return;
    
    setIsListening(!isListening);
    
    if (!isListening) {
      // Send voice input start message
      wsService.send({
        type: 'voice_input',
        action: 'start_listening'
      });
      
      // Listen for voice events
      wsService.on('voice_transcript', (data: any) => {
        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 2000);
      });
    } else {
      // Stop listening
      wsService.send({
        type: 'voice_input', 
        action: 'stop_listening'
      });
    }
  };

  const navigationItems = [
    { id: 'console', label: 'Console', icon: Brain },
    { id: 'home', label: 'Home', icon: Home },
    { id: 'servers', label: 'Servers', icon: Server },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background Scan Line Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-scan opacity-30" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/30 jarvis-backdrop">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-neon-cyan to-neon-blue animate-pulse-glow" />
                <span className="text-xl font-semibold jarvis-mono">JARVIS</span>
                <span className={`text-sm ${isOnline ? 'jarvis-status-online' : 'jarvis-status-critical'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Voice Controls */}
            <div className="flex items-center space-x-4">
              <VoiceWaveform isActive={isListening || isSpeaking} />
              
              <Button
                onClick={toggleListening}
                className={`jarvis-button ${isListening ? 'primary' : 'ghost'} w-12 h-12 rounded-full`}
              >
                {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button className="jarvis-button ghost w-12 h-12 rounded-full">
                {isSpeaking ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Navigation Sidebar */}
        <nav className="w-64 border-r border-border/30 jarvis-backdrop p-6">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activePanel === item.id
                      ? 'bg-accent/20 border border-accent/50 text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* System Status */}
          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              System Status
            </h3>
            <SystemMetrics />
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Primary Panel */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activePanel === 'console' && <ConsolePanel />}
              {activePanel === 'home' && <HomeAssistantPanel />}
              {activePanel === 'servers' && <DockerPanel />}
              {activePanel === 'security' && <SecurityPanel />}
              {activePanel === 'settings' && <SettingsPanel />}
            </div>

            {/* Holographic Display */}
            <div className="w-80 border-l border-border/30 jarvis-backdrop">
              <div className="h-full p-6">
                <h3 className="text-lg font-semibold mb-4">System Overview</h3>
                <div className="h-64 jarvis-hologram rounded-lg overflow-hidden animate-hologram">
                  <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={0.2} />
                    <pointLight position={[10, 10, 10]} intensity={0.5} color="#00ffff" />
                    <HolographicRing />
                    <OrbitControls enableZoom={false} enablePan={false} />
                  </Canvas>
                </div>
                
                {/* Additional Metrics */}
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <span className="jarvis-status-online">Optimal</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Security</span>
                    <span className="jarvis-status-online">Secure</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Performance</span>
                    <span className="jarvis-status-online">Excellent</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default JarvisHUD;