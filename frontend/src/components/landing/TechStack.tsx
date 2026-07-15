'use client';

import React from 'react';
import { motion } from 'framer-motion';

const techLogos = [
  { name: 'Next.js', url: 'https://cdn.worldvectorlogo.com/logos/next-js.svg' },
  { name: 'FastAPI', url: 'https://cdn.worldvectorlogo.com/logos/fastapi-1.svg' },
  { name: 'PostgreSQL', url: 'https://cdn.worldvectorlogo.com/logos/postgresql.svg' },
  { name: 'Redis', url: 'https://cdn.worldvectorlogo.com/logos/redis.svg' },
  { name: 'Docker', url: 'https://cdn.worldvectorlogo.com/logos/docker.svg' },
];

export default function TechStack() {
  return (
    <section className="py-24 bg-slate-950 overflow-hidden">
      <div className="container mx-auto px-6 text-center">
        <h3 className="text-xl font-medium text-slate-400 mb-12">Powered by modern open-source technologies</h3>
        
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          {techLogos.map((tech, idx) => (
            <motion.div 
              key={tech.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center gap-3 hover:scale-110 transition-transform cursor-pointer"
            >
              <div className="h-12 w-auto flex items-center justify-center">
                <img src={tech.url} alt={tech.name} className="max-h-full max-w-full object-contain filter invert opacity-80" />
              </div>
              <span className="text-sm text-slate-500 font-mono">{tech.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
