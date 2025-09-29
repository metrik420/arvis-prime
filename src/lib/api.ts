const API_BASE_URL = 'http://192.168.50.231:3001/api';
const WS_URL = 'ws://192.168.50.231:3001/ws';

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

// API Service functions
export const apiService = {
  // Generic HTTP methods
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return response.json();
  },

  async post(endpoint: string, data?: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
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
    const response = await fetch(`${API_BASE_URL}/system/metrics`);
    return response.json();
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