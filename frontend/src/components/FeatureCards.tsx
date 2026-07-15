"use client";

import { motion } from "framer-motion";
import { MessageSquare, Zap, Shield, Database } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Real-time Messaging",
    description: "Send and receive WhatsApp messages instantly. Supports text, media, and template messages.",
  },
  {
    icon: Zap,
    title: "n8n Automation",
    description: "Native support for webhooks to forward messages to n8n or any external automation system.",
  },
  {
    icon: Shield,
    title: "Self-Hosted & Secure",
    description: "Keep complete control of your data. AES-256-GCM encryption for credentials at rest.",
  },
  {
    icon: Database,
    title: "High Performance",
    description: "Built with FastAPI, Redis, and PostgreSQL for maximum throughput and reliability.",
  },
];

export default function FeatureCards() {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need</h2>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-400">
          A complete platform for managing WhatsApp Business API interactions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group relative rounded-2xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm transition-all hover:border-green-500/50 hover:bg-gray-800/80 hover:shadow-[0_0_30px_rgba(37,211,102,0.15)]"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-green-400 group-hover:bg-green-500/20 group-hover:text-green-300 transition-colors">
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">{feature.title}</h3>
            <p className="text-sm text-gray-400">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
