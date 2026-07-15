'use client';

import React from 'react';
import SceneWrapper from '../3d/SceneWrapper';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { GITHUB_URL, DOCS_URL } from '@/app/landing-content';

// Lazy load the 3D scene
const HeroScene = dynamic(() => import('../3d/HeroScene'), { ssr: false });

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 pt-20">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Column: Text Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 text-primary-400 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            v1.0 Open Source Release
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight mb-6">
            The Open-Source <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-emerald-400">
              WhatsApp CRM
            </span><br/>
            Built for Real Conversations
          </h1>
          
          <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
            Self-hosted, Meta Cloud API native, and built for scale. Manage thousands of conversations, automate workflows, and own your data.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold transition-all transform hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              View on GitHub
            </a>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-xl bg-slate-900/60 backdrop-blur border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold transition-all hover:bg-slate-800/80">
              Self-Host in 5 Minutes
            </a>
          </div>
        </motion.div>

        {/* Right Column: 3D Scene */}
        <div className="h-[600px] w-full relative">
          <SceneWrapper className="w-full h-full">
            <HeroScene />
          </SceneWrapper>
        </div>
      </div>
    </section>
  );
}
