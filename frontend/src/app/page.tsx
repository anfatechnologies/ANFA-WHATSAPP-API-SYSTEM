// /frontend/src/app/page.tsx
// ANFA Landing Page - Server Component
// SEO-optimized landing page with Bento Grid, Glassmorphism, and Premium UX.

import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldCheck, Zap, Database, Server } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ANFA WhatsApp Platform | Open-Source Self-Hosted CRM',
  description:
    'Deploy a self-hosted, local-first WhatsApp CRM on your own infrastructure. ' +
    'Complete data sovereignty with FastAPI, PostgreSQL, and Next.js.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-primary-500/30">
      {/* Navigation */}
      <nav className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/20">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-lg font-semibold text-slate-100 tracking-tight">ANFA Platform</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all shadow-lg shadow-primary-600/20 hover:shadow-primary-500/30 active:scale-95"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-900/30 border border-primary-500/30 text-primary-400 text-sm mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            Open-Source & Self-Hosted
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-100 tracking-tight leading-tight mb-6">
            WhatsApp CRM with <br />
            <span className="bg-gradient-to-r from-slate-200 via-indigo-300 to-slate-400 text-transparent bg-clip-text">
              Absolute Data Sovereignty
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Deploy a fully self-hosted WhatsApp Business API management platform on your own infrastructure. No data ever leaves your servers.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/40 active:scale-95"
            >
              Launch Dashboard
            </Link>
          </div>

          {/* Bento Grid Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { label: 'Data Sovereignty', value: '100%', desc: 'Local-first architecture', className: 'md:col-span-2 bg-gradient-to-br from-indigo-500/10 to-slate-900/50' },
              { label: 'Docker Services', value: '5', desc: 'Minimal footprint', className: 'md:col-span-1' },
              { label: 'Messages/Sec', value: '500+', desc: 'High throughput', className: 'md:col-span-1' },
              { label: 'Uptime', value: '99.9%', desc: 'Enterprise reliability', className: 'md:col-span-2 bg-gradient-to-br from-slate-900/50 to-indigo-500/10' },
            ].map((stat, idx) => (
              <div 
                key={idx} 
                className={`group relative p-8 rounded-3xl backdrop-blur-10 border border-slate-800 hover:border-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 text-left overflow-hidden ${stat.className || 'bg-slate-900/50'}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-4xl font-bold text-slate-100 mb-2">{stat.value}</h3>
                <p className="text-base font-medium text-slate-300">{stat.label}</p>
                <p className="text-sm text-slate-500 mt-2">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="relative py-24 bg-slate-900/20 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-100 mb-4">Core Pillars</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Built from the ground up for teams that demand privacy and performance.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-primary-500/30 transition-colors shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-6 text-primary-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Enterprise Security</h3>
              <p className="text-slate-400 leading-relaxed">
                HMAC-SHA256 webhook verification, JWT authentication, and bcrypt password hashing ensuring zero-trust.
              </p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-primary-500/30 transition-colors shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-6 text-primary-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Real-Time Speed</h3>
              <p className="text-slate-400 leading-relaxed">
                Server-Sent Events (SSE) deliver messages to your dashboard instantly. Zero polling, zero delays.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-primary-500/30 transition-colors shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-6 text-primary-400">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Partitioned Storage</h3>
              <p className="text-slate-400 leading-relaxed">
                PostgreSQL 16 with native range partitioning handles high-volume message retention automatically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
