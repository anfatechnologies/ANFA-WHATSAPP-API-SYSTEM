'use client';

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, Sphere, Line, Box, Html } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

function Particles() {
  const count = 100;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 15;
  }
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#10b981" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function PhoneMockup() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((state) => {
    if (groupRef.current) {
      // Subtle mouse parallax
      const targetRotationX = (mouse.y * Math.PI) / 10;
      const targetRotationY = (mouse.x * Math.PI) / 10;
      
      groupRef.current.rotation.x += (targetRotationX - groupRef.current.rotation.x) * 0.1;
      groupRef.current.rotation.y += (targetRotationY - groupRef.current.rotation.y) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Box args={[1.8, 3.8, 0.2]} material-color="#0f172a">
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
          
          {/* Screen */}
          <Box args={[1.6, 3.5, 0.01]} position={[0, 0, 0.11]}>
             <meshBasicMaterial color="#020617" />
          </Box>

          {/* Chat Bubbles */}
          <group position={[0, 0, 0.15]}>
            <Box args={[1.2, 0.4, 0.05]} position={[-0.1, 0.8, 0]} material-color="#1e293b" />
            <Box args={[1.0, 0.3, 0.05]} position={[0.2, 0.3, 0]} material-color="#059669">
              <meshBasicMaterial color="#059669" toneMapped={false} />
            </Box>
            <Box args={[1.3, 0.5, 0.05]} position={[-0.05, -0.3, 0]} material-color="#1e293b" />
          </group>
        </Box>
      </Float>
    </group>
  );
}

export default function HeroScene() {
  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 5, 15]} />
      
      <Particles />
      
      <group position={[1, 0, 0]}>
        <PhoneMockup />
      </group>

      {/* Connection Lines (representing flow) */}
      <group position={[-2, -1, -2]}>
        <Line points={[[1, 1, 1], [-1, 0, -1], [-2, -2, -3]]} color="#059669" lineWidth={2} />
        <Sphere args={[0.1]} position={[-1, 0, -1]}>
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </Sphere>
      </group>

      <EffectComposer>
        <Bloom luminanceThreshold={1} mipmapBlur />
      </EffectComposer>
    </>
  );
}
