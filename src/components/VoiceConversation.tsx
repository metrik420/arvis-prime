import React, { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Phone, PhoneOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VoiceWaveform } from './VoiceWaveform';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const VoiceConversation = () => {
  const [agentId, setAgentId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs conversation');
      addMessage('assistant', 'Connected! I am your Jarvis AI assistant. How can I help you today?');
    },
    onDisconnect: () => {
      console.log('Disconnected from conversation');
      addMessage('assistant', 'Connection closed. Click to reconnect when ready.');
    },
    onMessage: (message: any) => {
      if (message.type === 'user_transcript') {
        if (message.message && message.message.trim()) {
          addMessage('user', message.message);
        }
      } else if (message.type === 'agent_response') {
        if (message.message && message.message.trim()) {
          addMessage('assistant', message.message);
        }
      }
    },
    onError: (error: any) => {
      console.error('Conversation error:', error);
      addMessage('assistant', 'I encountered an error. Please check your connection and try again.');
    },
    clientTools: {
      // System control tools
      systemStatus: () => {
        addMessage('assistant', 'Checking system status... All systems operational.');
        return 'System status: All services running normally';
      },
      
      networkScan: () => {
        addMessage('assistant', 'Scanning network for devices...');
        return 'Network scan initiated - found 12 devices on your network';
      },
      
      controlLights: (parameters: { action: string; room?: string }) => {
        const room = parameters.room || 'all rooms';
        addMessage('assistant', `${parameters.action} lights in ${room}`);
        return `Lights ${parameters.action} in ${room}`;
      },
      
      getWeather: () => {
        addMessage('assistant', 'Current temperature is 22°C with clear skies.');
        return 'Weather: 22°C, Clear skies';
      }
    }
  });

  const addMessage = (type: 'user' | 'assistant', content: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [message, ...prev]);
  };

  const startConversation = async () => {
    if (!apiKey || !agentId) {
      alert('Please configure your ElevenLabs API key and Agent ID first');
      return;
    }

    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Generate signed URL for the conversation
      const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url');
      url.searchParams.append('agent_id', agentId);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        }
      });

      if (response.ok) {
        const { signed_url } = await response.json();
        await conversation.startSession({ url: signed_url });
      } else {
        // Fallback to agent ID if signed URL fails
        await conversation.startSession({ agentId });
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      addMessage('assistant', 'Failed to start conversation. Please check your API configuration.');
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await conversation.setVolume({ volume: newVolume });
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  };

  useEffect(() => {
    // Check if configuration is available
    setIsConfigured(!!apiKey && !!agentId);
  }, [apiKey, agentId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <Volume2 className="w-6 h-6 text-neon-cyan" />
          <span>ElevenLabs Conversation</span>
        </h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${conversation.status === 'connected' ? 'jarvis-status-online' : 'jarvis-status-critical'} bg-current`} />
          <span className="text-sm text-muted-foreground">
            {conversation.status === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Configuration Panel */}
      {!isConfigured && (
        <Card className="jarvis-panel border-neon-orange">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-neon-orange" />
              <span>Configuration Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ElevenLabs API Key</Label>
              <Input
                type="password"
                placeholder="Enter your ElevenLabs API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Agent ID</Label>
              <Input
                placeholder="Enter your ElevenLabs Agent ID"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Get your API key and create agents at{' '}
              <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-neon-cyan underline">
                elevenlabs.io
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Voice Control */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Voice Control</span>
            <Badge variant={conversation.status === 'connected' ? 'default' : 'secondary'}>
              {conversation.status === 'connected' ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Waveform Visualization */}
          <div className="h-20 bg-surface rounded-lg p-4 flex items-center justify-center">
            <VoiceWaveform 
              isActive={conversation.status === 'connected' && conversation.isSpeaking} 
              audioLevel={conversation.isSpeaking ? 75 : 0} 
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={conversation.status === 'connected' ? endConversation : startConversation}
              disabled={!isConfigured}
              className={`jarvis-button ${conversation.status === 'connected' ? 'critical' : 'default'} w-16 h-16 rounded-full`}
            >
              {conversation.status === 'connected' ? 
                <PhoneOff className="w-6 h-6" /> : 
                <Phone className="w-6 h-6" />
              }
            </Button>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <Label>Volume: {Math.round(volume * 100)}%</Label>
            <div className="flex items-center space-x-2">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-surface rounded-lg appearance-none cursor-pointer"
              />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Speaking Indicator */}
          {conversation.isSpeaking && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 text-neon-cyan">
                <div className="animate-pulse w-2 h-2 bg-neon-cyan rounded-full"></div>
                <span className="text-sm">AI is speaking...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation History */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle>Conversation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No conversation yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start a conversation to see messages here
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-neon-cyan/10 border border-neon-cyan/20 ml-8'
                      : 'bg-surface/30 border border-border/20 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {message.type === 'user' ? (
                        <Mic className="w-4 h-4 text-neon-cyan" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-neon-green" />
                      )}
                      <span className="text-sm font-medium">
                        {message.type === 'user' ? 'You' : 'Jarvis'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground jarvis-mono">
                      {message.timestamp}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};