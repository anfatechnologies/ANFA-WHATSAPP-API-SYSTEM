'use client';

import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { MessageSquare, Shield, Users, Zap, Lock, Container } from 'lucide-react';

const features = [
  {
    title: 'Realtime Inbox',
    description: 'Instant message delivery and typing indicators powered by WebSockets.',
    icon: MessageSquare,
  },
  {
    title: 'Webhook Security',
    description: 'HMAC signature verification ensures payloads originate securely from Meta.',
    icon: Shield,
  },
  {
    title: 'Multi-Agent Support',
    description: 'Assign conversations to team members and collaborate seamlessly.',
    icon: Users,
  },
  {
    title: 'Automation & n8n Integration',
    description: 'Connect triggers and actions to build intelligent chatbots and workflows.',
    icon: Zap,
  },
  {
    title: 'Encrypted Credential Storage',
    description: 'API keys and access tokens are securely encrypted at rest.',
    icon: Lock,
  },
  {
    title: 'Docker-Ready',
    description: 'Deploy everything in a single compose file. Infrastructure as Code.',
    icon: Container,
  },
];

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const ref = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const transform = useMotionTemplate`rotateX(${mouseXSpring}deg) rotateY(${mouseYSpring}deg)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(yPct * 20); // Tilt up/down
    y.set(xPct * 20); // Tilt left/right
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Icon = feature.icon;

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transform, transformStyle: "preserve-3d" }}
        className="h-full bg-slate-900/60 backdrop-blur border border-slate-800 p-8 rounded-2xl transition-colors hover:border-primary-500/50 group"
      >
        <div 
          style={{ transform: "translateZ(50px)" }}
          className="w-14 h-14 bg-slate-800/80 rounded-xl flex items-center justify-center mb-6 text-primary-400 group-hover:text-primary-300 group-hover:bg-primary-900/20 transition-colors shadow-lg"
        >
          <Icon size={28} />
        </div>
        <h3 style={{ transform: "translateZ(30px)" }} className="text-xl font-semibold text-white mb-3">
          {feature.title}
        </h3>
        <p style={{ transform: "translateZ(20px)" }} className="text-slate-400 leading-relaxed">
          {feature.description}
        </p>
      </motion.div>
    </div>
  );
}

export default function FeatureGrid() {
  return (
    <section className="py-24 bg-slate-950 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Enterprise Features, Open Source</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Everything you need to run a professional customer support or sales operation on WhatsApp, without the vendor lock-in.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <FeatureCard key={i} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
