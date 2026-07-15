'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';

interface SceneWrapperProps {
  children: React.ReactNode;
  className?: string;
}

// A fallback component while the 3D scene loads
const Loader = () => {
  return (
    <div className="flex items-center justify-center w-full h-full bg-slate-950">
      <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};

export default function SceneWrapper({ children, className = '' }: SceneWrapperProps) {
  // Check if we are on a mobile device to optionally disable heavy 3D
  // In a real app, you might want to use a more robust hook for this
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className={`relative ${className} bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center`}>
        {/* Mobile fallback illustration can go here */}
        <div className="text-center p-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-primary-600/20 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">ANFA WhatsApp CRM</h3>
          <p className="text-slate-400 text-sm">Interactive 3D view disabled on mobile for performance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Suspense fallback={<Loader />}>
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset="city" />
          {children}
        </Canvas>
      </Suspense>
    </div>
  );
}
