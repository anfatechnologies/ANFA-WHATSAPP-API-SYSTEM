"use client";

import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center pt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl"
      >
        <div className="mb-6 inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm text-green-400 backdrop-blur-md">
          <span className="mr-2 flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          Self-Hosted WhatsApp Business API
        </div>

        <h1 className="mb-6 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">
          The Open-Source <br />
          <span className="text-[#25D366]">WhatsApp API</span> Platform
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400 sm:text-xl">
          Send and receive WhatsApp messages, automate replies, integrate with n8n, and manage everything from a web dashboard — all running on your own infrastructure.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/anfatechnologies/ANFA-WHATSAPP-API-SYSTEM"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-md bg-[#25D366] px-8 text-sm font-medium text-black transition-colors hover:bg-[#20b858] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 shadow-[0_0_20px_rgba(37,211,102,0.3)]"
          >
            View on GitHub
          </a>
          <a
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-md border border-gray-700 bg-black/50 px-8 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Dashboard Login
          </a>
        </div>
      </motion.div>
    </div>
  );
}
