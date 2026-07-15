'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Connect Meta App',
    desc: 'Create a WhatsApp Cloud API app in the Meta Developer Portal and get your tokens.',
  },
  {
    num: '02',
    title: 'Deploy via Docker',
    desc: 'Run a single docker-compose command to spin up the API, database, and dashboard.',
  },
  {
    num: '03',
    title: 'Start Messaging',
    desc: 'Log into your secure dashboard and start managing conversations instantly.',
  },
];

export default function HowItWorks() {
  const targetRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["10%", "-60%"]);

  return (
    <section ref={targetRef} className="h-[300vh] bg-slate-950 relative">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        
        <div className="absolute top-24 left-0 w-full text-center px-6">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Up and running in minutes</h2>
          <p className="text-slate-400 text-lg">No complex infrastructure required. Built for simplicity.</p>
        </div>

        <motion.div style={{ x }} className="flex gap-16 px-[10vw] pt-32">
          {steps.map((step, idx) => (
            <div 
              key={idx}
              className="w-[80vw] md:w-[400px] h-[500px] shrink-0 bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden group"
            >
              {/* Large background number */}
              <div className="absolute -right-4 -bottom-10 text-[200px] font-black text-slate-800/30 select-none group-hover:scale-110 transition-transform duration-500">
                {step.num}
              </div>
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-full bg-primary-600/20 flex items-center justify-center text-primary-400 font-bold text-2xl border border-primary-500/30 mb-8">
                  {step.num}
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">{step.title}</h3>
                <p className="text-slate-400 text-lg leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
