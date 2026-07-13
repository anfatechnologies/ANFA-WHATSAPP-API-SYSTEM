/* ============================================================================
   ANFA WhatsApp API — Landing Page
   Original branding by ANFA Technologies.
   Do not remove per LICENSE.md attribution clause.
   Any PR modifying this file requires manual review from the repo owner.
   ============================================================================ */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, ShieldCheck, Phone, Zap, Bot, Lock,
  Gauge, Container, Star, GitFork, Users,
  ExternalLink, Copy, Check, Menu, X, ChevronRight,
  ArrowRight, Terminal, Cpu, Database, Globe,
} from 'lucide-react';
import {
  HERO, FEATURES, ARCHITECTURE_STEPS, QUICKSTART_STEPS,
  OPEN_SOURCE, NAV_LINKS, GITHUB_URL, GITHUB_REPO,
  DOCS_URL, CONTRIBUTING_URL, LICENSE_URL, DISCORD_URL,
} from './landing-content';

// GitHub SVG icon (lucide-react does not export 'Github' in v1.x)
function GithubIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare, ShieldCheck, Phone, Zap, Bot, Lock, Gauge, Container,
};

// ─── Utility Components ──────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'none';
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 24 : 0,
      x: direction === 'left' ? -24 : direction === 'right' ? 24 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GradientText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

// ─── GitHub Stats ─────────────────────────────────────────────────────────────

function useGitHubStats(repo: string) {
  const [stats, setStats] = useState<{ stars: number; forks: number; watchers: number } | null>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo}`)
      .then((r) => r.json())
      .then((d) => setStats({ stars: d.stargazers_count ?? 0, forks: d.forks_count ?? 0, watchers: d.subscribers_count ?? 0 }))
      .catch(() => {});
  }, [repo]);
  return stats;
}

function StatNumber({ value }: { value: number }) {
  return (
    <span>{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}</span>
  );
}

// ─── CopyCode ─────────────────────────────────────────────────────────────────

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/80 px-5 py-3.5 font-mono text-sm text-slate-300 backdrop-blur-sm">
      <Terminal className="h-4 w-4 shrink-0 text-emerald-400" />
      <span className="flex-1 overflow-x-auto whitespace-pre">{code}</span>
      <button
        onClick={copy}
        aria-label="Copy code"
        className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ stars }: { stars: number | null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* BRANDING — hardcoded per attribution clause */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/25 transition-transform group-hover:scale-105">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            ANFA <span className="text-emerald-400">WhatsApp API</span>
          </span>
        </a>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-white"
              >
                {link.label}
                {link.external && <ExternalLink className="h-3 w-3 opacity-60" />}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            id="github-star-btn"
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white"
          >
            <Star className="h-4 w-4 text-yellow-400" />
            Star on GitHub
            {stars !== null && (
              <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300">
                <StatNumber value={stars} />
              </span>
            )}
          </a>
          <a
            href="#quickstart"
            id="nav-get-started-btn"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:brightness-110 active:scale-95"
          >
            Get Started
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-slate-800/60 bg-slate-950/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200"
              >
                <Star className="h-4 w-4 text-yellow-400" />
                Star on GitHub
              </a>
              <a
                href="#quickstart"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Get Started
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ stats }: { stats: ReturnType<typeof useGitHubStats> }) {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden px-6 pt-24 pb-16">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/6 blur-3xl" />
        <div className="absolute bottom-1/4 left-0 h-[300px] w-[300px] rounded-full bg-blue-500/6 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open Source · Self-Hosted · Production Ready
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            <GradientText>{HERO.headline}</GradientText>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-10 text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            {HERO.subheadline}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href="#quickstart"
              id="hero-deploy-btn"
              className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:brightness-110 active:scale-95"
            >
              {HERO.primaryCta}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="hero-github-btn"
              className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-800/60 px-8 py-4 text-base font-semibold text-slate-200 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              <GithubIcon className="h-5 w-5" />
              {HERO.secondaryCta}
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {HERO.badges.map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/50 px-3.5 py-1.5 text-xs font-medium text-slate-400"
              >
                <Check className="h-3 w-3 text-emerald-400" />
                {badge}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Dashboard preview card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-20 max-w-5xl"
        >
          <div className="relative rounded-2xl border border-slate-700/40 bg-slate-900/80 p-1 shadow-2xl shadow-black/40 backdrop-blur-sm">
            {/* Window chrome */}
            <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-700/40 bg-slate-800/60 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-4 flex-1 text-center text-xs text-slate-500">
                ANFA WhatsApp API Dashboard
              </span>
            </div>
            {/* Simulated dashboard */}
            <div className="grid grid-cols-12 gap-3 rounded-b-xl bg-slate-950/60 p-4">
              {/* Sidebar */}
              <div className="col-span-3 rounded-xl border border-slate-800/60 bg-slate-900/80 p-3">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Inbox</div>
                {[
                  { name: 'Ahmed K.', preview: 'Hello, I need help...', time: '2m', unread: 2 },
                  { name: 'Sara M.', preview: 'My order status?', time: '8m', unread: 1 },
                  { name: 'Ali R.', preview: 'Thank you!', time: '15m', unread: 0 },
                  { name: 'Fatima N.', preview: 'When will it arrive?', time: '1h', unread: 0 },
                ].map((c) => (
                  <div key={c.name} className={`mb-2 cursor-pointer rounded-lg p-2.5 transition-colors ${c.unread ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-slate-800/40'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${c.unread ? 'text-white' : 'text-slate-400'}`}>{c.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-600">{c.time}</span>
                        {c.unread > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">{c.unread}</span>}
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{c.preview}</p>
                  </div>
                ))}
              </div>
              {/* Chat area */}
              <div className="col-span-9 flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/80 p-3">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-800/60 pb-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500" />
                  <div>
                    <div className="text-sm font-semibold text-white">Ahmed K.</div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Online</div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <div className="h-7 w-20 rounded-lg bg-slate-800/60" />
                    <div className="h-7 w-16 rounded-lg bg-emerald-500/20 border border-emerald-500/30" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-start"><div className="rounded-2xl rounded-tl-sm bg-slate-800 px-3.5 py-2 text-xs text-slate-300">Hello, I need help with my order</div></div>
                  <div className="flex justify-end"><div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-2 text-xs text-white">Hi Ahmed! Let me check that for you right away.</div></div>
                  <div className="flex justify-start"><div className="rounded-2xl rounded-tl-sm bg-slate-800 px-3.5 py-2 text-xs text-slate-300">Order #4521 — I haven't received it yet</div></div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5 text-xs text-slate-500">Type a message...</div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500">
                    <ArrowRight className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: ReturnType<typeof useGitHubStats> }) {
  const items = [
    { icon: Star, label: 'GitHub Stars', value: stats?.stars ?? '—', color: 'text-yellow-400' },
    { icon: GitFork, label: 'Forks', value: stats?.forks ?? '—', color: 'text-blue-400' },
    { icon: Users, label: 'Watchers', value: stats?.watchers ?? '—', color: 'text-emerald-400' },
    { icon: Globe, label: 'Self-Hosted', value: '100%', color: 'text-cyan-400' },
  ];

  return (
    <FadeIn className="border-y border-slate-800/60 bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className={`h-5 w-5 ${color}`} />
              <div className="text-2xl font-bold text-white">
                {typeof value === 'number' ? <StatNumber value={value} /> : value}
              </div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

// ─── Features Grid ────────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Everything you need to run <GradientText>WhatsApp at scale</GradientText>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Production-grade features built in — not bolted on as paid add-ons.
          </p>
        </FadeIn>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon] ?? MessageSquare;
            return (
              <FadeIn key={feature.title} delay={i * 0.06}>
                <div className="group relative h-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-emerald-500/5">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 ring-1 ring-emerald-500/20 transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-white leading-snug">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{feature.description}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Architecture ─────────────────────────────────────────────────────────────

function ArchitectureSection() {
  const layers = [
    { icon: Globe, label: 'Meta Cloud API', color: 'from-blue-500 to-indigo-500' },
    { icon: ShieldCheck, label: 'Nginx · TLS · IP Allowlist', color: 'from-slate-500 to-slate-600' },
    { icon: Cpu, label: 'FastAPI · ARQ Workers', color: 'from-emerald-500 to-cyan-500' },
    { icon: Database, label: 'PostgreSQL · Redis', color: 'from-orange-500 to-amber-500' },
  ];

  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            How It <GradientText>Works</GradientText>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            A clean four-layer architecture designed for reliability and zero data loss.
          </p>
        </FadeIn>

        {/* Architecture diagram */}
        <FadeIn className="mb-20">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
            {layers.map((layer, i) => {
              const Icon = layer.icon;
              return (
                <div key={layer.label} className="w-full">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-6 py-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${layer.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-semibold text-white">{layer.label}</span>
                    <div className="ml-auto hidden gap-1.5 sm:flex">
                      {[...Array(3)].map((_, j) => (
                        <motion.div
                          key={j}
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.4, delay: j * 0.2 + i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  </div>
                  {i < layers.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ChevronRight className="h-5 w-5 rotate-90 text-slate-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FadeIn>

        {/* Steps */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ARCHITECTURE_STEPS.map((step, i) => (
            <FadeIn key={step.step} delay={i * 0.08}>
              <div className="relative rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5">
                <div className="mb-3 text-5xl font-black text-slate-800">{step.step}</div>
                <h3 className="mb-2 text-sm font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Quick Start ──────────────────────────────────────────────────────────────

function QuickStartSection() {
  return (
    <section id="quickstart" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="grid lg:grid-cols-2">
            {/* Left */}
            <div className="p-10 lg:p-14">
              <FadeIn>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-400">
                  <Terminal className="h-3.5 w-3.5" />
                  Quick Start
                </div>
                <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-white">
                  Up in <GradientText>4 commands</GradientText>
                </h2>
                <p className="mb-8 text-slate-400">
                  One Docker Compose stack brings up Nginx, FastAPI, Next.js, PostgreSQL, Redis, and n8n. No cloud accounts. No monthly bills.
                </p>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                >
                  Read the full documentation <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </FadeIn>
            </div>

            {/* Right — code blocks */}
            <div className="flex flex-col justify-center gap-3 border-t border-slate-800/60 bg-slate-950/50 p-10 lg:border-l lg:border-t-0 lg:p-14">
              {QUICKSTART_STEPS.map((step, i) => (
                <FadeIn key={step.label} delay={i * 0.1} direction="right">
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    Step {i + 1} — {step.label}
                  </div>
                  <CopyCode code={step.code} />
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Open Source Section ──────────────────────────────────────────────────────

function OpenSourceSection() {
  return (
    <section id="open-source" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeIn>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-sm font-medium text-cyan-400">
              <GithubIcon className="h-3.5 w-3.5" />
              Open Source
            </div>
            <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-white">
              <GradientText>{OPEN_SOURCE.title}</GradientText>
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-400">
              {OPEN_SOURCE.body}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                id="oss-github-btn"
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:text-white"
              >
                <GithubIcon className="h-4 w-4" />
                View on GitHub
              </a>
              <a
                href={CONTRIBUTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-600 hover:text-white"
              >
                Contribute
              </a>
              <a
                href={LICENSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-400"
              >
                {OPEN_SOURCE.license}
              </a>
              {DISCORD_URL && (
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-2.5 text-sm font-medium text-indigo-400"
                >
                  Join Discord
                </a>
              )}
            </div>
          </FadeIn>

          <FadeIn direction="right">
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShieldCheck, title: 'Auditable', desc: 'Every line of code is open for inspection. No black boxes.' },
                { icon: Lock, title: 'Private', desc: 'Your data stays on your servers. Zero telemetry.' },
                { icon: GitFork, title: 'Forkable', desc: 'Adapt it to your exact needs. No vendor lock-in.' },
                { icon: Users, title: 'Community', desc: 'Built collaboratively and improved by real users.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5">
                  <Icon className="mb-3 h-6 w-6 text-emerald-400" />
                  <div className="mb-1 text-sm font-semibold text-white">{title}</div>
                  <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── Footer (BRANDING CRITICAL — hardcoded) ───────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    /* ANFA WhatsApp API — Original branding by ANFA Technologies.
       Do not remove per LICENSE.md attribution clause. */
    <footer className="border-t border-slate-800/60 bg-slate-950 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column — hardcoded, not in content.ts */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                ANFA <span className="text-emerald-400">WhatsApp API</span>
              </span>
            </div>
            <p className="mb-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Open-source WhatsApp Business API platform for teams who believe in data sovereignty.
            </p>
            {/* HARDCODED — attribution clause — do not remove */}
            <p className="text-sm font-medium text-slate-400">
              Built with ❤️ by{' '}
              <a
                href="https://github.com/anfatechnologies"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                ANFA Technologies
              </a>
            </p>
          </div>

          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Product</div>
            <ul className="space-y-2.5">
              {[
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Quick Start', href: '#quickstart' },
                { label: 'Open Source', href: '#open-source' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Links</div>
            <ul className="space-y-2.5">
              {[
                { label: 'GitHub', href: GITHUB_URL },
                { label: 'Documentation', href: DOCS_URL },
                { label: 'License', href: LICENSE_URL },
                { label: 'Contributing', href: CONTRIBUTING_URL },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {label}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800/60 pt-8 sm:flex-row">
          {/* HARDCODED — attribution clause — do not remove */}
          <p className="text-sm text-slate-600">
            © {year} ANFA Technologies. All rights reserved.
          </p>
          <p className="text-xs text-slate-700">
            ANFA WhatsApp API — Original branding by ANFA Technologies. Do not remove per LICENSE.md attribution clause.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const stats = useGitHubStats(GITHUB_REPO);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar stars={stats?.stars ?? null} />
      <main>
        <HeroSection stats={stats} />
        <StatsBar stats={stats} />
        <FeaturesSection />
        <ArchitectureSection />
        <QuickStartSection />
        <OpenSourceSection />
      </main>
      <Footer />
    </div>
  );
}
