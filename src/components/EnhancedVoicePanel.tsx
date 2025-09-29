import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Play, Square, Brain, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { VoiceWaveform } from './VoiceWaveform';
import { useToast } from '@/hooks/use-toast';

interface VoiceSettings {
  elevenLabsApiKey: string;
  selectedVoice: string;
  speechSpeed: number;
  stability: number;
  clarity: number;
  wakeWord: string;
  continuousListening: boolean;
  autoSpeak: boolean;
  volume: number;
}

export const EnhancedVoicePanel = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [testText, setTestText] = useState('Hello, I am Jarvis. How can I assist you today?');
  const [audioLevel, setAudioLevel] = useState(0);
  const { toast } = useToast();

  const [settings, setSettings] = useState<VoiceSettings>({
    elevenLabsApiKey: '',
    selectedVoice: '9BWtsMINqrJLrRacOk9x', // Aria
    speechSpeed: 1.0,
    stability: 0.5,
    clarity: 0.8,
    wakeWord: 'Jarvis',
    continuousListening: false,
    autoSpeak: true,
    volume: 75
  });

  const [voiceCommands] = useState([
    { command: 'Turn on living room lights', intent: 'homeassistant.light.turn_on', confidence: 0.95 },
    { command: 'Set temperature to 22 degrees', intent: 'homeassistant.climate.set_temperature', confidence: 0.92 },
    { command: 'Show security cameras', intent: 'security.show_cameras', confidence: 0.88 },
    { command: 'Scan network for new devices', intent: 'network.scan_devices', confidence: 0.94 },
  ]);

  const availableVoices = [
    { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Natural female voice' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Authoritative male voice' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Friendly female voice' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Professional female voice' },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Friendly male voice' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young male voice' },
  ];

  useEffect(() => {
    // Check if API key is configured
    if (settings.elevenLabsApiKey) {
      setIsConnected(true);
    }

    // Simulate audio level for demo
    const interval = setInterval(() => {
      if (isListening) {
        setAudioLevel(Math.random() * 100);
      } else {
        setAudioLevel(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [settings.elevenLabsApiKey, isListening]);

  const handleStartListening = async () => {
    if (!settings.elevenLabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key in settings",
        variant: "destructive"
      });
      return;
    }

    setIsListening(true);
    setTranscript('');
    
    // Simulate speech recognition
    setTimeout(() => {
      const sampleCommands = [
        "Turn on the living room lights",
        "What's the temperature in the bedroom?",
        "Show me the security cameras",
        "Run a network scan"
      ];
      const randomCommand = sampleCommands[Math.floor(Math.random() * sampleCommands.length)];
      setTranscript(randomCommand);
      
      if (settings.autoSpeak) {
        handleProcessCommand(randomCommand);
      }
    }, 3000);
  };

  const handleStopListening = () => {
    setIsListening(false);
    setAudioLevel(0);
  };

  const handleProcessCommand = async (command: string) => {
    setIsSpeaking(true);
    
    // Simulate processing
    const responses = [
      "Turning on the living room lights now.",
      "The bedroom temperature is currently 22 degrees Celsius.",
      "Displaying security camera feeds on your screen.",
      "Starting network scan. I'll notify you when it's complete."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    setResponse(randomResponse);
    
    // Simulate TTS
    setTimeout(() => {
      setIsSpeaking(false);
      toast({
        title: "Command Executed",
        description: randomResponse,
      });
    }, 2000);
  };

  const handleTestSpeech = async () => {
    if (!settings.elevenLabsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key to test speech",
        variant: "destructive"
      });
      return;
    }

    setIsSpeaking(true);
    
    // Simulate TTS API call
    setTimeout(() => {
      setIsSpeaking(false);
      toast({
        title: "Speech Test Complete",
        description: "Text-to-speech is working correctly",
      });
    }, 2000);
  };

  const handleSaveSettings = () => {
    // In a real app, this would save to backend or localStorage
    toast({
      title: "Settings Saved",
      description: "Voice configuration has been updated",
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="control">Voice Control</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-4">
          {/* Main Voice Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Jarvis Voice Assistant
                </span>
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice Visualization */}
              <div className="flex justify-center">
                <div className="w-64 h-32 flex items-center justify-center">
                  <VoiceWaveform isActive={isListening || isSpeaking} />
                </div>
              </div>

              {/* Audio Level */}
              {isListening && (
                <div className="space-y-2">
                  <Label>Audio Level</Label>
                  <Progress value={audioLevel} className="w-full" />
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div className="space-y-2">
                  <Label>You said:</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="italic">"{transcript}"</p>
                  </div>
                </div>
              )}

              {/* Response */}
              {response && (
                <div className="space-y-2">
                  <Label>Jarvis response:</Label>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p>{response}</p>
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  size="lg"
                  className="h-16 w-16 rounded-full"
                  variant={isListening ? 'destructive' : 'default'}
                  onClick={isListening ? handleStopListening : handleStartListening}
                  disabled={!isConnected}
                >
                  {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>
                
                <Button
                  size="lg"
                  className="h-16 w-16 rounded-full"
                  variant="outline"
                  disabled={isSpeaking}
                >
                  {isSpeaking ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => handleProcessCommand("Turn on all lights")}>
                  Turn on lights
                </Button>
                <Button variant="outline" onClick={() => handleProcessCommand("Show security status")}>
                  Security status
                </Button>
                <Button variant="outline" onClick={() => handleProcessCommand("Check network devices")}>
                  Network scan
                </Button>
                <Button variant="outline" onClick={() => handleProcessCommand("Set night mode")}>
                  Night mode
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Voice Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!settings.elevenLabsApiKey && (
                <Alert>
                  <AlertDescription>
                    To use voice features, please configure your ElevenLabs API key. 
                    You can get one from <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline">elevenlabs.io</a>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="api-key">ElevenLabs API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={settings.elevenLabsApiKey}
                  onChange={(e) => setSettings({...settings, elevenLabsApiKey: e.target.value})}
                  placeholder="Enter your ElevenLabs API key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice">Voice Selection</Label>
                <Select 
                  value={settings.selectedVoice} 
                  onValueChange={(value) => setSettings({...settings, selectedVoice: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} - {voice.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Speech Speed: {settings.speechSpeed}x</Label>
                <Slider
                  value={[settings.speechSpeed]}
                  onValueChange={([value]) => setSettings({...settings, speechSpeed: value})}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <Label>Voice Stability: {(settings.stability * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.stability]}
                  onValueChange={([value]) => setSettings({...settings, stability: value})}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <Label>Voice Clarity: {(settings.clarity * 100).toFixed(0)}%</Label>
                <Slider
                  value={[settings.clarity]}
                  onValueChange={([value]) => setSettings({...settings, clarity: value})}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wake-word">Wake Word</Label>
                <Input
                  id="wake-word"
                  value={settings.wakeWord}
                  onChange={(e) => setSettings({...settings, wakeWord: e.target.value})}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.continuousListening}
                  onCheckedChange={(checked) => setSettings({...settings, continuousListening: checked})}
                />
                <Label>Continuous Listening</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.autoSpeak}
                  onCheckedChange={(checked) => setSettings({...settings, autoSpeak: checked})}
                />
                <Label>Auto-speak responses</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-text">Test Text</Label>
                <Textarea
                  id="test-text"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleTestSpeech} disabled={isSpeaking}>
                  <Play className="w-4 h-4 mr-2" />
                  Test Speech
                </Button>
                <Button onClick={handleSaveSettings} variant="outline">
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Voice Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {voiceCommands.map((cmd, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">"{cmd.command}"</p>
                      <p className="text-sm text-muted-foreground">{cmd.intent}</p>
                    </div>
                    <Badge variant="outline">
                      {(cmd.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voice Interaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">Voice Command</p>
                    <span className="text-xs text-muted-foreground">2 minutes ago</span>
                  </div>
                  <p className="text-sm">User: "Turn on living room lights"</p>
                  <p className="text-sm text-muted-foreground">Jarvis: "Turning on the living room lights now."</p>
                </div>
                
                <div className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">Voice Command</p>
                    <span className="text-xs text-muted-foreground">5 minutes ago</span>
                  </div>
                  <p className="text-sm">User: "What's the temperature?"</p>
                  <p className="text-sm text-muted-foreground">Jarvis: "The current temperature is 22 degrees Celsius."</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};