import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Headphones, Settings, Play, Pause, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService, wsService } from '@/lib/api';
import { VoiceWaveform } from './VoiceWaveform';

interface VoiceCommand {
  id: string;
  command: string;
  intent: string;
  confidence: number;
  timestamp: string;
  response?: string;
  executed: boolean;
}

interface VoiceSettings {
  inputSensitivity: number;
  outputVolume: number;
  selectedVoice: string;
  wakeWord: string;
  continuousListening: boolean;
  noiseReduction: boolean;
}

export const VoicePanel = () => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>({
    inputSensitivity: 50,
    outputVolume: 75,
    selectedVoice: 'aria',
    wakeWord: 'Jarvis',
    continuousListening: false,
    noiseReduction: true
  });
  const [availableVoices] = useState([
    { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Natural female voice' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Authoritative male voice' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Friendly female voice' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Calm male voice' }
  ]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Initialize audio permissions
    checkAudioPermissions();
    
    // WebSocket listeners
    wsService.on('voice_command_processed', (data: any) => {
      const newCommand: VoiceCommand = {
        id: Date.now().toString(),
        command: data.transcript,
        intent: data.intent,
        confidence: data.confidence,
        timestamp: new Date().toLocaleTimeString(),
        response: data.response,
        executed: data.success
      };
      setCommands(prev => [newCommand, ...prev.slice(0, 9)]);
    });

    wsService.on('connected', () => setIsConnected(true));
    wsService.on('disconnected', () => setIsConnected(false));

    return () => {
      stopListening();
    };
  }, []);

  const checkAudioPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsConnected(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone access denied:', error);
      setIsConnected(false);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: settings.noiseReduction,
          noiseSuppression: settings.noiseReduction,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      
      // Set up audio analysis for visual feedback
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255 * 100);
        }
        if (isListening) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendAudioForTranscription(audioBlob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsListening(true);
      setIsRecording(true);

    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsConnected(false);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);
    setIsRecording(false);
    setAudioLevel(0);
  };

  const sendAudioForTranscription = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_command.wav');
    formData.append('wake_word', settings.wakeWord);

    try {
      const response = await fetch(`${apiService.get === undefined ? 'http://192.168.50.231:3001' : ''}/api/voice/transcribe`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setTranscript(result.transcript);
        
        // Process the command if it contains the wake word
        if (result.transcript.toLowerCase().includes(settings.wakeWord.toLowerCase())) {
          await processVoiceCommand(result.transcript);
        }
      }
    } catch (error) {
      console.error('Transcription failed:', error);
    }
  };

  const processVoiceCommand = async (command: string) => {
    try {
      const response = await fetch(`${apiService.get === undefined ? 'http://192.168.50.231:3001' : ''}/api/voice/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const result = await response.json();
      
      if (result.success) {
        // Speak the response
        await speakResponse(result.response);
      }
    } catch (error) {
      console.error('Command processing failed:', error);
    }
  };

  const speakResponse = async (text: string) => {
    if (isMuted) return;

    try {
      const response = await fetch(`${apiService.get === undefined ? 'http://192.168.50.231:3001' : ''}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          voice: settings.selectedVoice,
          speed: 1.0 
        })
      });

      const result = await response.json();
      
      if (result.success && result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audio.volume = settings.outputVolume / 100;
        await audio.play();
      }
    } catch (error) {
      console.error('Speech synthesis failed:', error);
    }
  };

  const testVoice = async () => {
    const testText = `Hello, this is ${availableVoices.find(v => v.id === settings.selectedVoice)?.name || 'Jarvis'}. Voice test complete.`;
    await speakResponse(testText);
  };

  const getStatusColor = () => {
    if (!isConnected) return 'jarvis-status-critical';
    if (isListening) return 'jarvis-status-online';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Headphones className="w-7 h-7 text-neon-cyan" />
          <span>Voice Control</span>
        </h1>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} bg-current`} />
          <span className="text-sm text-muted-foreground">
            {!isConnected ? 'Disconnected' : isListening ? 'Listening' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Main Voice Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="jarvis-panel">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="w-5 h-5 text-neon-green" />
              <span>Voice Input</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Waveform */}
            <div className="h-24 bg-surface rounded-lg p-4 flex items-center justify-center">
              <VoiceWaveform isActive={isListening} audioLevel={audioLevel} />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-4">
              <Button
                onClick={isListening ? stopListening : startListening}
                disabled={!isConnected}
                className={`jarvis-button ${isListening ? 'ghost' : 'default'} w-16 h-16 rounded-full`}
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>
              
              <Button
                onClick={() => setIsMuted(!isMuted)}
                className="jarvis-button ghost"
                size="sm"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Current Transcript */}
            <div className="p-4 bg-surface rounded-lg">
              <Label className="text-sm text-muted-foreground">Current Transcript</Label>
              <p className="mt-1 jarvis-mono text-sm">
                {transcript || 'Say "' + settings.wakeWord + '" to activate...'}
              </p>
            </div>

            {/* Wake Word Test */}
            <div className="space-y-2">
              <Label>Test Wake Word</Label>
              <div className="flex space-x-2">
                <Input
                  value={settings.wakeWord}
                  onChange={(e) => setSettings(prev => ({ ...prev, wakeWord: e.target.value }))}
                  placeholder="Wake word"
                />
                <Button onClick={testVoice} className="jarvis-button ghost" size="sm">
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Settings */}
        <Card className="jarvis-panel">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-neon-blue" />
              <span>Voice Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input Sensitivity */}
            <div className="space-y-2">
              <Label>Input Sensitivity: {settings.inputSensitivity}%</Label>
              <Slider
                value={[settings.inputSensitivity]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, inputSensitivity: value }))}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Output Volume */}
            <div className="space-y-2">
              <Label>Output Volume: {settings.outputVolume}%</Label>
              <Slider
                value={[settings.outputVolume]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, outputVolume: value }))}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={settings.selectedVoice}
                onValueChange={(value) => setSettings(prev => ({ ...prev, selectedVoice: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div>
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-xs text-muted-foreground">{voice.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio Processing Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Continuous Listening</Label>
                <Button
                  onClick={() => setSettings(prev => ({ ...prev, continuousListening: !prev.continuousListening }))}
                  className={`jarvis-button ${settings.continuousListening ? 'default' : 'ghost'}`}
                  size="sm"
                >
                  {settings.continuousListening ? 'ON' : 'OFF'}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Noise Reduction</Label>
                <Button
                  onClick={() => setSettings(prev => ({ ...prev, noiseReduction: !prev.noiseReduction }))}
                  className={`jarvis-button ${settings.noiseReduction ? 'default' : 'ghost'}`}
                  size="sm"
                >
                  {settings.noiseReduction ? 'ON' : 'OFF'}
                </Button>
              </div>
            </div>

            {/* Test Voice */}
            <Button onClick={testVoice} className="jarvis-button ghost w-full">
              <Volume2 className="w-4 h-4 mr-2" />
              Test Selected Voice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Command History */}
      <Card className="jarvis-panel">
        <CardHeader>
          <CardTitle>Recent Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {commands.length === 0 ? (
              <div className="text-center py-8">
                <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No voice commands processed yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start listening and say "{settings.wakeWord}" followed by your command
                </p>
              </div>
            ) : (
              commands.map((command) => (
                <div
                  key={command.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface/30 border border-border/20"
                >
                  <div className="flex-1">
                    <p className="font-medium jarvis-mono">{command.command}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {command.intent}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(command.confidence * 100)}% confidence
                      </span>
                    </div>
                    {command.response && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Response: {command.response}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground jarvis-mono">{command.timestamp}</span>
                    <div className={`w-2 h-2 rounded-full ${command.executed ? 'jarvis-status-online bg-current' : 'jarvis-status-critical bg-current'}`} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};