import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import dynamic from 'next/dynamic';
import SceneWrapper from '../3d/SceneWrapper';

const ArchitectureGraph = dynamic(() => import('../3d/ArchitectureGraph'), { ssr: false });

export default function ArchitectureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section ref={containerRef} className="relative py-32 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Built for Production Scale</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            A robust, decoupled architecture ensures high availability, instant message routing, and secure data storage.
          </p>
        </div>

        <motion.div 
          style={{ y, opacity }}
          className="h-[500px] w-full rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur overflow-hidden relative"
        >
          <SceneWrapper className="w-full h-full">
            <ArchitectureGraph />
          </SceneWrapper>
        </motion.div>
      </div>
    </section>
  );
}
