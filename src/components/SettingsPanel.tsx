import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiService } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ConfigSection {
  [key: string]: string | number | boolean;
}

interface Config {
  server: ConfigSection;
  homeassistant: ConfigSection;
  docker: ConfigSection;
  security: ConfigSection;
  voice: ConfigSection;
  media: ConfigSection;
  system: ConfigSection;
}

const SettingsPanel = () => {
  const [config, setConfig] = useState<Config>({
    server: {},
    homeassistant: {},
    docker: {},
    security: {},
    voice: {},
    media: {},
    system: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/config');
      setConfig(response.data.config || {
        server: {},
        homeassistant: {},
        docker: {},
        security: {},
        voice: {},
        media: {},
        system: {}
      });
    } catch (error) {
      toast({
        title: "Error loading configuration",
        description: "Failed to load settings from server",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await apiService.post('/config', { config });
      toast({
        title: "Configuration saved",
        description: "Settings have been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error saving configuration",
        description: "Failed to save settings to server",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section: string, key: string, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const renderInput = (section: string, key: string, label: string, type: 'text' | 'number' | 'password' | 'boolean' = 'text') => {
    const value = config[section]?.[key] || '';

    if (type === 'boolean') {
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={`${section}-${key}`}>{label}</Label>
          <Switch
            id={`${section}-${key}`}
            checked={Boolean(value)}
            onCheckedChange={(checked) => updateConfig(section, key, checked)}
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={`${section}-${key}`}>{label}</Label>
        <Input
          id={`${section}-${key}`}
          type={type}
          value={String(value)}
          onChange={(e) => updateConfig(section, key, type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-accent" />
          <h2 className="text-2xl font-bold">System Configuration</h2>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadConfig} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="server" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="server">Server</TabsTrigger>
          <TabsTrigger value="homeassistant">Home Assistant</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="server">
          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('server', 'NODE_ENV', 'Environment')}
              {renderInput('server', 'PORT', 'Port', 'number')}
              {renderInput('server', 'HOST', 'Host')}
              {renderInput('server', 'FRONTEND_URL', 'Frontend URL')}
              {renderInput('server', 'JWT_SECRET', 'JWT Secret', 'password')}
              {renderInput('server', 'PIN_SALT', 'PIN Salt', 'password')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homeassistant">
          <Card>
            <CardHeader>
              <CardTitle>Home Assistant Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('homeassistant', 'HA_URL', 'Home Assistant URL')}
              {renderInput('homeassistant', 'HA_TOKEN', 'Access Token', 'password')}
              {renderInput('homeassistant', 'HA_TIMEOUT', 'Timeout (ms)', 'number')}
              {renderInput('homeassistant', 'ENABLE_WEBSOCKET', 'Enable WebSocket', 'boolean')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docker">
          <Card>
            <CardHeader>
              <CardTitle>Docker Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('docker', 'DOCKER_SOCKET', 'Docker Socket Path')}
              {renderInput('docker', 'DOCKER_API_VERSION', 'API Version')}
              {renderInput('docker', 'DOCKER_TIMEOUT', 'Timeout (ms)', 'number')}
              {renderInput('docker', 'STATS_INTERVAL', 'Stats Collection Interval (ms)', 'number')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security & Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('security', 'TELEGRAM_BOT_TOKEN', 'Telegram Bot Token', 'password')}
              {renderInput('security', 'TELEGRAM_CHAT_ID', 'Telegram Chat ID')}
              {renderInput('security', 'DISCORD_WEBHOOK', 'Discord Webhook URL', 'password')}
              {renderInput('security', 'ENABLE_IP_MONITORING', 'Enable IP Monitoring', 'boolean')}
              {renderInput('security', 'SCAN_INTERVAL', 'Security Scan Interval (ms)', 'number')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <CardTitle>Voice Processing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('voice', 'VOICE_MODEL_PATH', 'Voice Model Path')}
              {renderInput('voice', 'VOICE_ENGINE', 'Voice Engine')}
              {renderInput('voice', 'VOICE_ID', 'Voice ID')}
              {renderInput('voice', 'SAMPLE_RATE', 'Sample Rate', 'number')}
              {renderInput('voice', 'CHUNK_SIZE', 'Chunk Size', 'number')}
              {renderInput('voice', 'ENABLE_NOISE_REDUCTION', 'Enable Noise Reduction', 'boolean')}
              {renderInput('voice', 'OPENAI_API_KEY', 'OpenAI API Key (Fallback)', 'password')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Media Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('media', 'PLEX_URL', 'Plex Server URL')}
              {renderInput('media', 'PLEX_TOKEN', 'Plex Token', 'password')}
              {renderInput('media', 'ENABLE_TRANSCODING', 'Enable Transcoding', 'boolean')}
              {renderInput('media', 'DEFAULT_QUALITY', 'Default Quality')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderInput('system', 'METRICS_INTERVAL', 'Metrics Collection Interval (ms)', 'number')}
              {renderInput('system', 'ENABLE_GPU_MONITORING', 'Enable GPU Monitoring', 'boolean')}
              {renderInput('system', 'ENABLE_TEMPERATURE_MONITORING', 'Enable Temperature Monitoring', 'boolean')}
              {renderInput('system', 'CPU_TEMP_THRESHOLD', 'CPU Temperature Threshold (°C)', 'number')}
              {renderInput('system', 'CPU_THRESHOLD', 'CPU Usage Threshold (%)', 'number')}
              {renderInput('system', 'MEMORY_THRESHOLD', 'Memory Usage Threshold (%)', 'number')}
              {renderInput('system', 'DISK_THRESHOLD', 'Disk Usage Threshold (%)', 'number')}
              {renderInput('system', 'LOG_LEVEL', 'Log Level')}
              {renderInput('system', 'LOG_FILE', 'Log File Path')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPanel;