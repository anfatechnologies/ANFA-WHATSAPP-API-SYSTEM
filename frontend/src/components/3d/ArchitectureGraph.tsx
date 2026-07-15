'use client';

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

interface NodeProps {
  position: [number, number, number];
  label: string;
  description: string;
  color?: string;
}

function GraphNode({ position, label, description, color = '#10b981' }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const scale = hovered ? 1.2 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial 
          color={color} 
          wireframe={!hovered} 
          emissive={hovered ? color : '#000000'}
          emissiveIntensity={hovered ? 0.5 : 0}
        />
      </mesh>
      
      <Text position={[0, -0.8, 0]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
        {label}
      </Text>

      {hovered && (
        <Html position={[0.5, 0.5, 0]} center>
          <div className="bg-slate-900/90 backdrop-blur border border-slate-700 text-white p-3 rounded-lg shadow-xl w-48 text-sm pointer-events-none transition-opacity duration-200">
            <h4 className="font-semibold text-primary-400 mb-1">{label}</h4>
            <p className="text-slate-300 text-xs">{description}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function ArchitectureGraph() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  const nodes = [
    { pos: [-4, 1, 0] as [number, number, number], label: 'WhatsApp API', desc: 'Meta Cloud API Endpoint' },
    { pos: [-1.5, 1, 1] as [number, number, number], label: 'Webhook', desc: 'Receives real-time events', color: '#6366f1' },
    { pos: [1.5, 0, 0] as [number, number, number], label: 'FastAPI', desc: 'Core routing & business logic', color: '#f59e0b' },
    { pos: [4, 1, -1] as [number, number, number], label: 'Database', desc: 'PostgreSQL & Redis', color: '#ef4444' },
    { pos: [4, -1, 1] as [number, number, number], label: 'Dashboard', desc: 'Next.js Frontend UI' },
  ];

  return (
    <group ref={groupRef}>
      {nodes.map((n, i) => (
        <GraphNode key={i} position={n.pos} label={n.label} description={n.desc} color={n.color} />
      ))}
      
      {/* Connecting Lines */}
      <Line points={[nodes[0].pos, nodes[1].pos]} color="#334155" lineWidth={2} dashed dashSize={0.2} gapSize={0.1} />
      <Line points={[nodes[1].pos, nodes[2].pos]} color="#334155" lineWidth={2} />
      <Line points={[nodes[2].pos, nodes[3].pos]} color="#334155" lineWidth={2} />
      <Line points={[nodes[2].pos, nodes[4].pos]} color="#334155" lineWidth={2} />

      {/* Animated Pulses on Lines */}
      <Sphere args={[0.05]} position={[-2.75, 1, 0.5]}>
         <meshBasicMaterial color="#34d399" toneMapped={false} />
      </Sphere>
    </group>
  );
}
