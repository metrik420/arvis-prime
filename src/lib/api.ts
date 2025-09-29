const API_BASE_URL = 'http://192.168.50.231:3001/api';
const WS_URL = 'ws://192.168.50.231:3001/ws';

// Demo data for when backend is unavailable
const DEMO_NETWORK_DEVICES = [
  {
    ip: '192.168.1.1',
    mac: '00:11:22:33:44:55',
    hostname: 'Router',
    vendor: 'ASUS',
    type: 'router',
    status: 'online' as const,
    services: ['HTTP', 'SSH', 'HTTPS'],
    classification: 'Network Infrastructure',
    ports: [22, 80, 443],
    lastSeen: new Date().toISOString()
  },
  {
    ip: '192.168.1.100',
    mac: '00:aa:bb:cc:dd:ee',
    hostname: 'Home-Assistant',
    vendor: 'Raspberry Pi Foundation',
    type: 'server',
    status: 'online' as const,
    services: ['HTTP', 'HTTPS', 'SSH'],
    classification: 'Home Automation',
    ports: [22, 8123, 443],
    lastSeen: new Date().toISOString()
  },
  {
    ip: '192.168.1.50',
    mac: '00:ff:ee:dd:cc:bb',
    hostname: 'iPhone-Pro',
    vendor: 'Apple',
    type: 'mobile',
    status: 'online' as const,
    services: [],
    classification: 'Mobile Device',
    ports: [],
    lastSeen: new Date().toISOString()
  },
  {
    ip: '192.168.1.75',
    mac: '00:12:34:56:78:90',
    hostname: 'Smart-TV',
    vendor: 'Samsung',
    type: 'iot',
    status: 'online' as const,
    services: ['HTTP'],
    classification: 'Smart TV',
    ports: [8000, 8080],
    lastSeen: new Date().toISOString()
  },
  {
    ip: '192.168.1.200',
    mac: '00:99:88:77:66:55',
    hostname: 'Laptop-Dell',
    vendor: 'Dell Inc.',
    type: 'computer',
    status: 'offline' as const,
    services: [],
    classification: 'Computer',
    ports: [],
    lastSeen: new Date(Date.now() - 3600000).toISOString()
  }
];

const DEMO_SYSTEM_METRICS = {
  cpu: 45.2,
  memory: 67.8,
  disk: 82.1,
  temperature: 52
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventCallbacks: { [event: string]: Function[] } = {};

  connect() {
    try {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.emit('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(event: string, callback: Function) {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  private emit(event: string, data?: any) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// API Service functions with demo fallback
export const apiService = {
  // Demo data provider
  getDemoData(endpoint: string) {
    if (endpoint.includes('/system/metrics')) {
      return DEMO_SYSTEM_METRICS;
    }
    if (endpoint.includes('/network/devices')) {
      return { devices: DEMO_NETWORK_DEVICES };
    }
    if (endpoint.includes('/network/scan')) {
      setTimeout(() => {
        console.log('Demo network scan completed');
      }, 2000);
      return { message: 'Demo network scan started', devices: DEMO_NETWORK_DEVICES };
    }
    if (endpoint.includes('/docker/containers')) {
      return {
        containers: [
          { id: '1', name: 'homeassistant', status: 'running', image: 'homeassistant/home-assistant:latest' },
          { id: '2', name: 'nginx-proxy', status: 'running', image: 'nginx:alpine' }
        ]
      };
    }
    if (endpoint.includes('/security/status')) {
      return {
        status: 'secure',
        lastScan: new Date().toISOString(),
        threats: 0,
        vulnerabilities: []
      };
    }
    if (endpoint.includes('/home-assistant/entities')) {
      return {
        entities: [
          { entity_id: 'light.living_room', state: 'on', friendly_name: 'Living Room Light' },
          { entity_id: 'light.bedroom', state: 'off', friendly_name: 'Bedroom Light' },
          { entity_id: 'switch.coffee_maker', state: 'off', friendly_name: 'Coffee Maker' }
        ]
      };
    }
    return {};
  },

  // Generic HTTP methods with fallback
  async get(endpoint: string) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`API call failed, using demo data for ${endpoint}:`, error);
      return this.getDemoData(endpoint);
    }
  },

  async post(endpoint: string, data?: any) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`API call failed, using demo data for ${endpoint}:`, error);
      return this.getDemoData(endpoint);
    }
  },

  async put(endpoint: string, data?: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  },

  // System API
  async getSystemMetrics() {
    try {
      const response = await fetch(`${API_BASE_URL}/system/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.warn('System metrics API failed, using demo data:', error);
      return DEMO_SYSTEM_METRICS;
    }
  },

  // Docker API
  async getContainers() {
    const response = await fetch(`${API_BASE_URL}/docker/containers`);
    return response.json();
  },

  async startContainer(nameOrId: string) {
    const response = await fetch(`${API_BASE_URL}/docker/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameOrId })
    });
    return response.json();
  },

  async stopContainer(nameOrId: string) {
    const response = await fetch(`${API_BASE_URL}/docker/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameOrId })
    });
    return response.json();
  },

  // Home Assistant API
  async getEntities() {
    const response = await fetch(`${API_BASE_URL}/home-assistant/entities`);
    return response.json();
  },

  async turnOn(entityId: string) {
    const response = await fetch(`${API_BASE_URL}/home-assistant/turn-on`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId })
    });
    return response.json();
  },

  async turnOff(entityId: string) {
    const response = await fetch(`${API_BASE_URL}/home-assistant/turn-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId })
    });
    return response.json();
  },

  // Security API
  async getSecurityStatus() {
    const response = await fetch(`${API_BASE_URL}/security/status`);
    return response.json();
  },

  // Network API
  async scanNetwork(subnet?: string, timeout?: number) {
    const response = await fetch(`${API_BASE_URL}/network/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subnet, timeout })
    });
    return response.json();
  },

  async getNetworkDevices(filter?: any) {
    const params = new URLSearchParams(filter);
    const response = await fetch(`${API_BASE_URL}/network/devices?${params}`);
    return response.json();
  },

  async getDeviceInfo(ip: string) {
    const response = await fetch(`${API_BASE_URL}/network/devices/${ip}`);
    return response.json();
  },

  // Voice API
  async transcribeAudio(audioBlob: Blob, wakeWord?: string) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_command.wav');
    if (wakeWord) formData.append('wake_word', wakeWord);

    const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },

  async speakText(text: string, voice?: string, speed?: number) {
    const response = await fetch(`${API_BASE_URL}/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed })
    });
    return response.json();
  },

  async processVoiceCommand(command: string) {
    const response = await fetch(`${API_BASE_URL}/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return response.json();
  }
};

// Global WebSocket instance
export const wsService = new WebSocketService();