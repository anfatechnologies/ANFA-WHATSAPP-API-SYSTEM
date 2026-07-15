'use client';

import React, { useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function AnimatedCounter({ value, label }: { value: number, label: string }) {
  const [count, setCount] = useState(0);
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const duration = 2000;
      const increment = end / (duration / 16);
      
      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-black text-white mb-2">
        {count.toLocaleString()}{value >= 1000 ? '+' : ''}
      </div>
      <div className="text-primary-400 font-medium uppercase tracking-wider text-sm">
        {label}
      </div>
    </div>
  );
}

export default function MetricsStrip() {
  return (
    <section className="py-20 bg-slate-950 border-y border-slate-800/50">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <AnimatedCounter value={10000} label="Messages/Day" />
          <AnimatedCounter value={15} label="Contributors" />
          <AnimatedCounter value={99} label="Uptime (%)" />
          <div className="text-center flex flex-col items-center justify-center">
            <div className="flex -space-x-4 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`w-12 h-12 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center overflow-hidden z-[${6-i}]`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="avatar" />
                </div>
              ))}
            </div>
            <div className="text-slate-400 text-sm font-medium">Community Driven</div>
          </div>
        </div>
      </div>
    </section>
  );
}
