import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { apiService } from '@/lib/api';

interface NetworkDevice {
  ip: string;
  mac: string;
  hostname?: string;
  vendor?: string;
  type?: string;
  status: 'online' | 'offline' | 'unknown';
  services?: string[];
}

interface DeviceNodeProps {
  device: NetworkDevice;
  position: [number, number, number];
  onClick: (device: NetworkDevice) => void;
  isSelected: boolean;
}

const DeviceNode: React.FC<DeviceNodeProps> = ({ device, position, onClick, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (hovered || isSelected) {
        meshRef.current.scale.setScalar(1.2);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  const getDeviceColor = () => {
    if (isSelected) return '#00ffff';
    if (device.status === 'online') return '#00ff00';
    if (device.status === 'offline') return '#ff0000';
    return '#ffff00';
  };

  const getDeviceGeometry = () => {
    switch (device.type) {
      case 'router':
      case 'gateway':
        return <octahedronGeometry args={[0.5, 0]} />;
      case 'server':
        return <boxGeometry args={[0.8, 0.4, 0.8]} />;
      case 'mobile':
      case 'phone':
        return <capsuleGeometry args={[0.2, 0.8, 4, 8]} />;
      case 'iot':
        return <dodecahedronGeometry args={[0.3, 0]} />;
      default:
        return <sphereGeometry args={[0.3, 32, 32]} />;
    }
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(device);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {getDeviceGeometry()}
        <meshStandardMaterial
          color={getDeviceColor()}
          emissive={getDeviceColor()}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Device label */}
      <Text
        position={[0, 0.8, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {device.hostname || device.ip}
      </Text>

      {/* Connection lines to nearby devices */}
      {device.status === 'online' && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([0, 0, 0, 0, -2, 0])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00ffff" opacity={0.3} transparent />
        </line>
      )}
    </group>
  );
};

const NetworkSphere: React.FC<{ devices: NetworkDevice[]; onDeviceClick: (device: NetworkDevice) => void; selectedDevice: NetworkDevice | null }> = ({
  devices,
  onDeviceClick,
  selectedDevice
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  // Arrange devices in a sphere
  const devicePositions = devices.map((_, index) => {
    const phi = Math.acos(-1 + (2 * index) / devices.length);
    const theta = Math.sqrt(devices.length * Math.PI) * phi;
    const radius = 3;
    
    return [
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi)
    ] as [number, number, number];
  });

  return (
    <group ref={groupRef}>
      {/* Central network hub */}
      <mesh position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color="#ff6b00"
          emissive="#ff6b00"
          emissiveIntensity={0.5}
          wireframe
        />
      </mesh>

      <Text
        position={[0, -1, 0]}
        fontSize={0.2}
        color="#ff6b00"
        anchorX="center"
        anchorY="middle"
      >
        Network Hub
      </Text>

      {/* Render devices */}
      {devices.map((device, index) => (
        <DeviceNode
          key={device.ip}
          device={device}
          position={devicePositions[index]}
          onClick={onDeviceClick}
          isSelected={selectedDevice?.ip === device.ip}
        />
      ))}

      {/* Connection lines from center to devices */}
      {devices.map((device, index) => (
        device.status === 'online' && (
          <line key={`line-${device.ip}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  0, 0, 0,
                  ...devicePositions[index]
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial 
              color="#00ffff" 
              opacity={selectedDevice?.ip === device.ip ? 1 : 0.2} 
              transparent 
            />
          </line>
        )
      ))}
    </group>
  );
};

export const Network3D: React.FC<{ devices: NetworkDevice[]; onDeviceClick: (device: NetworkDevice) => void; selectedDevice: NetworkDevice | null }> = ({
  devices,
  onDeviceClick,
  selectedDevice
}) => {
  return (
    <div className="w-full h-full min-h-[400px] bg-black/20 rounded-lg overflow-hidden">
      <Canvas
        camera={{
          position: [5, 5, 5],
          fov: 60
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        <pointLight position={[0, 0, 0]} intensity={0.8} color="#00ffff" />
        
        <NetworkSphere 
          devices={devices} 
          onDeviceClick={onDeviceClick}
          selectedDevice={selectedDevice}
        />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={false}
          maxDistance={15}
          minDistance={3}
        />
        
        {/* Starfield background */}
        <mesh>
          <sphereGeometry args={[50, 32, 32]} />
          <meshBasicMaterial 
            color="#000011"
            side={THREE.BackSide}
            transparent
            opacity={0.8}
          />
        </mesh>
        
        {/* Add some floating particles */}
        {Array.from({ length: 50 }).map((_, i) => (
          <mesh 
            key={i}
            position={[
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20
            ]}
          >
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        ))}
      </Canvas>
    </div>
  );
};