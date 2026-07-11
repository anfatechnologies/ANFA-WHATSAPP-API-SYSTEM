// /frontend/src/app/page.tsx
// ANFA Landing Page - Server Component
// SEO-optimized landing page with hero section, feature grid, and CTA.

import Link from 'next/link';
import { Metadata } from 'next';

// Override metadata for the landing page
export const metadata: Metadata = {
  title: 'ANFA WhatsApp Platform | Open-Source Self-Hosted CRM',
  description:
    'Deploy a self-hosted, local-first WhatsApp CRM on your own infrastructure. ' +
    'Complete data sovereignty with FastAPI, PostgreSQL, and Next.js.',
};

// =============================================================================
// FEATURES DATA
// =============================================================================

const features = [
  {
    title: 'Absolute Data Sovereignty',
    description:
      'All messages, contacts, and metadata stay on your servers. No third-party access, no data mining, no external dependencies.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Streaming',
    description:
      'Server-Sent Events (SSE) deliver incoming messages to your dashboard instantly. No polling, no delays, no missed messages.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Enterprise Security',
    description:
      'HMAC-SHA256 webhook verification, JWT authentication, bcrypt password hashing, and constant-time signature validation.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Multi-Agent Inbox',
    description:
      'Collaborative shared inbox with session assignment, status tracking, priority scoring, and agent workload balancing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Smart Rate Limiting',
    description:
      'Sliding-window token bucket rate limiting prevents Meta API throttling. Automatic 429 handling with dynamic backoff.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Partitioned Database',
    description:
      'PostgreSQL 16 with native range partitioning by month. Automatic partition management via pg_partman with 12-month retention.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
];

const techStack = [
  { name: 'FastAPI', category: 'Backend', description: 'Async Python web framework' },
  { name: 'SQLAlchemy 2.0', category: 'ORM', description: 'Async database operations' },
  { name: 'PostgreSQL 16', category: 'Database', description: 'Range-partitioned messages' },
  { name: 'Redis 7', category: 'Cache/Queue', description: 'Pub/sub, rate limiting, tasks' },
  { name: 'arq', category: 'Workers', description: 'Async job queue' },
  { name: 'Next.js 14', category: 'Frontend', description: 'App Router, SSR, streaming' },
  { name: 'Tailwind CSS', category: 'Styling', description: 'Utility-first CSS' },
  { name: 'Nginx', category: 'Ingress', description: 'HTTP/2, SSE optimization' },
];

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function LandingPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ANFA WhatsApp Platform",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <div className="min-h-screen bg-anfa-dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Navigation */}
      <nav className="border-b border-anfa-border bg-anfa-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-lg font-semibold text-anfa-text">ANFA Platform</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/anfa-tech/anfa-whatsapp-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="text-anfa-muted hover:text-anfa-text transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 to-transparent pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-900/50 border border-primary-700/50 text-primary-300 text-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-anfa-accent animate-pulse" />
              Open-Source & Self-Hosted
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-anfa-text leading-tight mb-6">
              WhatsApp CRM with{' '}
              <span className="text-primary-400">Absolute Data Sovereignty</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-anfa-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              Deploy a fully self-hosted WhatsApp Business API management platform on your own
              infrastructure. No data ever leaves your servers. Open-source, production-ready,
              and built for privacy-first organizations.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/dashboard"
                className="px-8 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-all hover:shadow-lg hover:shadow-primary-600/25"
              >
                Launch Dashboard
              </Link>
              <a
                href="https://docs.anfa.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 rounded-xl border border-anfa-border hover:border-anfa-muted text-anfa-text font-semibold transition-colors"
              >
                Documentation
              </a>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
              {[
                { label: 'Docker Services', value: '5' },
                { label: 'Messages/Second', value: '500+' },
                { label: 'Data Sovereignty', value: '100%' },
                { label: 'Uptime SLA', value: '99.9%' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary-400">{stat.value}</div>
                  <div className="text-sm text-anfa-muted mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="py-16 border-y border-anfa-border bg-anfa-panel/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-anfa-text mb-4">
              Containerized Architecture
            </h2>
            <p className="text-anfa-muted max-w-xl mx-auto">
              Five services orchestrated via Docker Compose with isolated internal networking
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {[
              { name: 'Nginx', role: 'Reverse Proxy', port: '80/443', color: 'border-green-500/50 bg-green-500/10' },
              { name: 'Next.js', role: 'Frontend UI', port: '3000', color: 'border-blue-500/50 bg-blue-500/10' },
              { name: 'FastAPI', role: 'Backend API', port: '4000', color: 'border-yellow-500/50 bg-yellow-500/10' },
              { name: 'PostgreSQL 16', role: 'Database', port: '5432', color: 'border-purple-500/50 bg-purple-500/10' },
              { name: 'Redis 7', role: 'Cache/Queue', port: '6379', color: 'border-red-500/50 bg-red-500/10' },
            ].map((service) => (
              <div
                key={service.name}
                className={`p-4 rounded-xl border ${service.color} text-center`}
              >
                <div className="font-semibold text-anfa-text mb-1">{service.name}</div>
                <div className="text-sm text-anfa-muted">{service.role}</div>
                <div className="text-xs text-anfa-muted mt-2 font-mono">{service.port}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-anfa-text mb-4">
              Built for Production Workloads
            </h2>
            <p className="text-anfa-muted max-w-xl mx-auto">
              Every component is designed with security, scalability, and operational excellence in mind
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-anfa-border bg-anfa-panel/50 hover:bg-anfa-panel transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary-900/50 border border-primary-700/50 flex items-center justify-center text-primary-400 mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-anfa-text mb-2">
                  {feature.title}
                </h3>
                <p className="text-anfa-muted text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 border-y border-anfa-border bg-anfa-panel/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-anfa-text mb-4">
              Modern Tech Stack
            </h2>
            <p className="text-anfa-muted max-w-xl mx-auto">
              Battle-tested technologies chosen for performance, security, and developer experience
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="p-4 rounded-xl border border-anfa-border bg-anfa-dark text-center hover:border-primary-600/50 transition-colors"
              >
                <div className="text-sm font-semibold text-anfa-text">{tech.name}</div>
                <div className="text-xs text-primary-400 mt-1">{tech.category}</div>
                <div className="text-xs text-anfa-muted mt-1">{tech.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-anfa-text mb-4">
                Security-First Design
              </h2>
              <p className="text-anfa-muted mb-6 leading-relaxed">
                Every security-sensitive function includes inline rationale explaining its purpose.
                From HMAC-SHA256 webhook verification to constant-time signature comparison,
                we prioritize defense in depth.
              </p>
              
              <ul className="space-y-3">
                {[
                  'HMAC-SHA256 webhook signature verification',
                  'Constant-time comparison prevents timing attacks',
                  'Dynamic credential lookup per phone_number_id',
                  'No Docker socket mounting required',
                  'bcrypt password hashing with automatic salting',
                  'JWT tokens with configurable expiration',
                  'Non-privileged container execution',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-anfa-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-anfa-text text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Security Code Preview */}
            <div className="rounded-xl border border-anfa-border bg-anfa-panel overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-anfa-border bg-anfa-dark">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-anfa-muted ml-2 font-mono">security.py</span>
              </div>
              <pre className="p-4 text-xs sm:text-sm text-anfa-muted overflow-x-auto">
                <code>{`# Constant-time comparison prevents
# timing side-channel attacks
if not hmac.compare_digest(
    computed_sig, 
    received_sig
):
    raise HTTPException(
        status_code=401,
        detail="Signature verification failed"
    )`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-8 sm:p-12 rounded-2xl border border-primary-700/50 bg-gradient-to-b from-primary-900/30 to-anfa-panel/50">
            <h2 className="text-2xl sm:text-3xl font-bold text-anfa-text mb-4">
              Ready to Take Control of Your Data?
            </h2>
            <p className="text-anfa-muted mb-8 max-w-xl mx-auto">
              Deploy the entire platform with a single command. Your data stays on your servers,
              under your control, always.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="px-8 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-all hover:shadow-lg hover:shadow-primary-600/25"
              >
                Launch Dashboard
              </Link>
              <div className="text-anfa-muted text-sm font-mono bg-anfa-dark px-4 py-3 rounded-xl border border-anfa-border">
                docker compose up -d
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-anfa-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">A</span>
              </div>
              <span className="text-sm text-anfa-muted">
                ANFA Technology &copy; {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-anfa-muted">
              <a href="https://docs.anfa.tech" className="hover:text-anfa-text transition-colors">Docs</a>
              <a href="https://github.com/anfa-tech/anfa-whatsapp-platform" className="hover:text-anfa-text transition-colors">GitHub</a>
              <a href="/llms.txt" className="hover:text-anfa-text transition-colors">LLMs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
