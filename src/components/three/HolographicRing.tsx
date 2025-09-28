import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

export const HolographicRing = () => {
  const meshRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const outerRingRef = useRef<Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.5;
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
    }
    
    if (ringRef.current) {
      ringRef.current.rotation.z = -time * 0.3;
    }
    
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = time * 0.2;
    }
  });

  return (
    <group>
      {/* Central Core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#004444"
          transparent
          opacity={0.8}
          wireframe
        />
      </mesh>

      {/* Inner Ring */}
      <mesh ref={ringRef} position={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.05, 16, 100]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#003333"
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Middle Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.03, 16, 100]} />
        <meshStandardMaterial
          color="#0088ff"
          emissive="#002244"
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Outer Ring */}
      <mesh ref={outerRingRef} rotation={[0, Math.PI / 4, 0]}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#6600ff"
          emissive="#220044"
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Floating Particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 3;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle * 0.5) * 0.5,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#004444"
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};