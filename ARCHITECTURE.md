# Jarvis HUD Architecture

This document outlines the technical architecture of the Jarvis HUD frontend interface and its integration points with the broader Jarvis AI system.

## 🏗 System Overview

The Jarvis HUD serves as the primary user interface for a complete AI assistant system. It's designed as a modern, responsive web application that provides real-time visualization and control of various smart home and server management functions.

```
┌─────────────────────────────────────────────────────────────┐
│                    Jarvis HUD Frontend                     │
├─────────────────────────────────────────────────────────────┤
│  React App │ Three.js │ WebSocket │ REST API │ Voice UI    │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    Reverse Proxy      │
                    │    (Nginx/Traefik)    │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
│   Orchestrator │    │  Voice Service  │    │  WebSocket API  │
│   (Node.js)    │    │  (Python/Rust)  │    │   (Real-time)   │
└────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
    ┌───────────────────────────┴───────────────────────────┐
    │                 Backend Services                      │
    ├─────────────────────────────────────────────────────────┤
    │ Home Assistant │ Docker │ Security │ Plex │ Search    │
    └─────────────────────────────────────────────────────────┘
```

## 🎨 Frontend Architecture

### Component Hierarchy
```
App.tsx
├── JarvisHUD.tsx (Main Layout)
│   ├── Header (Voice controls, status)
│   ├── Navigation Sidebar
│   │   └── SystemMetrics.tsx
│   ├── Main Content Area
│   │   ├── ConsolePanel.tsx
│   │   ├── HomeAssistantPanel.tsx
│   │   ├── SecurityPanel.tsx
│   │   └── ServerPanel.tsx (Future)
│   └── Holographic Display
│       └── HolographicRing.tsx (Three.js)
└── VoiceWaveform.tsx (Audio visualization)
```

### Design System
Located in `src/index.css`, the design system provides:

**Color System**
- HSL color space for consistency
- Semantic color tokens (primary, secondary, success, warning, critical)
- Neon accent colors for cyberpunk aesthetic
- Dark theme optimized for long viewing sessions

**Component System**
- `.jarvis-panel` - Standard panel styling
- `.jarvis-button` - Consistent button variants
- `.jarvis-status-*` - Color-coded status indicators
- `.jarvis-glow` - Interactive glow effects

**Animation System**
- CSS custom properties for smooth transitions
- GSAP-ready classes for complex animations
- Three.js integration for 3D effects

### State Management
```typescript
// Global state structure
interface AppState {
  // Voice interaction
  isListening: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  
  // System status
  isOnline: boolean;
  systemMetrics: SystemMetrics;
  
  // UI state
  activePanel: string;
  notifications: Notification[];
}
```

## 🔗 Integration Architecture

### WebSocket Communication
Real-time bidirectional communication for:
- Live voice transcription
- System status updates
- Tool execution results
- Error notifications

```typescript
// WebSocket message format
interface WebSocketMessage {
  type: 'transcript' | 'intent' | 'tool_call' | 'result' | 'error';
  timestamp: string;
  data: any;
  metadata?: {
    userId?: string;
    sessionId?: string;
    toolName?: string;
  };
}
```

### REST API Integration
HTTP endpoints for CRUD operations:
```typescript
// API client structure
class JarvisAPI {
  // Home Assistant integration
  async getDevices(): Promise<Device[]>
  async controlDevice(id: string, action: DeviceAction): Promise<void>
  async executeScene(sceneId: string): Promise<void>
  
  // Security operations
  async getThreats(): Promise<Threat[]>
  async blockIP(ip: string): Promise<void>
  async getSecurityStatus(): Promise<SecurityStatus>
  
  // System monitoring
  async getSystemMetrics(): Promise<SystemMetrics>
  async getContainerStatus(): Promise<ContainerStatus[]>
  async restartContainer(containerId: string): Promise<void>
}
```

### Voice Processing Pipeline
```
Audio Input → VAD → ASR → NLU → Intent → Tool Selection → Execution → TTS
     ↑                                                              ↓
 Microphone                                                   Audio Output
     ↑                                                              ↓
 VoiceWaveform.tsx ←→ WebSocket ←→ Voice Service ←→ Orchestrator
```

## 🔧 Technical Stack

### Core Technologies
- **React 18.3.1** - Component framework with concurrent features
- **TypeScript** - Type safety and developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first styling framework

### 3D Graphics
- **Three.js 0.160** - 3D rendering engine
- **React Three Fiber** - React renderer for Three.js
- **React Three Drei** - Helpful abstractions and helpers

### UI Components
- **Shadcn/ui** - Headless component library
- **Radix UI** - Primitive components for accessibility
- **Lucide React** - Modern icon library

### Development Tools
- **ESLint** - Code linting and formatting
- **TypeScript Compiler** - Type checking
- **Vite Plugin React** - Hot module replacement

## 🏗 Build Architecture

### Development Build
```bash
npm run dev
├── Vite Dev Server (Port 8080)
├── Hot Module Replacement
├── TypeScript Compilation (watch mode)
└── ESLint (on-save)
```

### Production Build
```bash
npm run build
├── TypeScript Compilation
├── Vite Bundle Creation
│   ├── Code Splitting
│   ├── Tree Shaking
│   ├── Asset Optimization
│   └── Source Map Generation
└── Static Asset Generation
```

### Container Architecture
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
# ... build steps ...

FROM nginx:alpine
# ... production serving ...
```

## 🔒 Security Architecture

### Frontend Security
- **Content Security Policy** - XSS protection
- **HTTPS Enforcement** - Encrypted communication
- **Input Validation** - Client-side sanitization
- **Authentication Ready** - JWT token support

### Communication Security
- **WebSocket Secure (WSS)** - Encrypted real-time communication
- **API Authentication** - Bearer token authentication
- **CORS Configuration** - Cross-origin request control

### Container Security
- **Non-root User** - Container runs as unprivileged user
- **Read-only Filesystem** - Immutable container filesystem
- **Resource Limits** - CPU and memory constraints
- **Health Checks** - Automated container monitoring

## 📊 Performance Architecture

### Frontend Optimization
- **Code Splitting** - Lazy loading of route components
- **Tree Shaking** - Unused code elimination
- **Asset Optimization** - Image and font optimization
- **Caching Strategy** - Browser and CDN caching

### Rendering Optimization
- **React.memo** - Component memoization
- **useMemo/useCallback** - Hook optimization
- **Virtual Scrolling** - Large list performance
- **Three.js Optimization** - Efficient 3D rendering

### Network Optimization
- **Gzip Compression** - Response compression
- **HTTP/2** - Multiplexed connections
- **CDN Integration** - Global asset distribution
- **WebSocket Pooling** - Connection management

## 🔄 Data Flow Architecture

### User Interaction Flow
```
User Input → Component → State Update → API Call → Backend Processing → Response → State Update → UI Update
```

### Voice Interaction Flow
```
Voice Input → WebSocket → Voice Service → Intent Recognition → Tool Execution → Result → WebSocket → UI Update
```

### Real-time Update Flow
```
Backend Event → WebSocket → Frontend Handler → State Update → Component Re-render
```

## 🌐 Deployment Architecture

### Container Orchestration
```yaml
# docker-compose.yml structure
services:
  jarvis-hud:      # Frontend (this project)
  orchestrator:    # Backend API (future)
  voice-service:   # Voice processing (future)
  redis:          # Session storage (future)
  postgres:       # Data persistence (future)
```

### Network Architecture
```
Internet → Load Balancer → Reverse Proxy → Application Containers
                    ↓
                SSL Termination
                    ↓
              Request Routing
                    ↓
            Backend Services
```

## 🔮 Future Architecture Considerations

### Scalability
- **Horizontal Scaling** - Multiple frontend instances
- **CDN Integration** - Global content distribution
- **Microservices** - Service decomposition
- **Event-Driven Architecture** - Async communication

### Advanced Features
- **PWA Support** - Offline capabilities
- **WebRTC** - Direct peer-to-peer communication
- **WebAssembly** - High-performance computations
- **WebXR** - Immersive 3D interfaces

### Monitoring and Observability
- **Performance Monitoring** - Real user metrics
- **Error Tracking** - Exception monitoring
- **Usage Analytics** - User behavior insights
- **Health Monitoring** - Application status

## 📝 Development Guidelines

### Code Organization
```
src/
├── components/     # Reusable UI components
├── pages/         # Route-level components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
├── types/         # TypeScript definitions
└── assets/        # Static assets
```

### Naming Conventions
- **Components**: PascalCase (e.g., `VoiceWaveform.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useVoiceState.ts`)
- **Utils**: camelCase (e.g., `formatTimestamp.ts`)
- **Types**: PascalCase (e.g., `ApiResponse.ts`)

### Best Practices
- **Single Responsibility** - One concern per component
- **Composition over Inheritance** - Prefer component composition
- **TypeScript Strict Mode** - Enable all strict checks
- **Accessibility** - WCAG 2.1 compliance
- **Performance** - Monitor bundle size and runtime performance

---

This architecture provides a solid foundation for building a production-ready AI assistant interface while maintaining flexibility for future enhancements and integrations.