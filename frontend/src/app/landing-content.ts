/**
 * ANFA WhatsApp API — Landing Page Content File
 * -----------------------------------------------
 * Non-devs can safely edit the text, links, and copy in this file.
 *
 * ⚠️  BRANDING RULES (do NOT edit the following — they are hardcoded in page.tsx):
 *    - "ANFA" name and logo in header/footer
 *    - "Built by ANFA Technologies" footer line
 *    - GitHub link (https://github.com/anfatechnologies)
 *    - HTML <title> and meta branding
 *
 * These are governed by the LICENSE.md attribution clause.
 */

export const GITHUB_REPO = 'anfatechnologies/ANFA-WHATSAPP-API-SYSTEM';
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const DOCS_URL = `${GITHUB_URL}#readme`;
export const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/CONTRIBUTING.md`;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
export const DISCORD_URL = ''; // Set to Discord invite link if one exists

// ─── Hero ────────────────────────────────────────────────────────────────────

export const HERO = {
  headline: 'Open-Source WhatsApp Business API Platform for Teams',
  subheadline:
    'Deploy a self-hosted, privacy-first WhatsApp CRM on your own infrastructure. ' +
    'Full data sovereignty — your messages never leave your servers.',
  primaryCta: 'Deploy Now',
  secondaryCta: 'View on GitHub',
  badges: ['Open Source', 'Self-Hosted', 'MIT Licensed'],
};

// ─── Features ────────────────────────────────────────────────────────────────

export const FEATURES = [
  {
    icon: 'MessageSquare',
    title: 'Real-Time Inbound & Outbound Messaging',
    description:
      'Full Meta Cloud API integration with Server-Sent Events for instant message streaming to the dashboard.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Webhook Signature Verification',
    description:
      'HMAC-SHA256 signature validation with constant-time comparison and Redis-backed idempotency to prevent replay attacks.',
  },
  {
    icon: 'Phone',
    title: 'Multi-Phone-Number Support',
    description:
      'Manage multiple WhatsApp Business numbers from a single dashboard, each with isolated credentials and settings.',
  },
  {
    icon: 'Zap',
    title: 'n8n Automation Integration',
    description:
      'Route inbound messages to n8n workflows for CRM sync, auto-tagging, escalation logic, or any custom automation.',
  },
  {
    icon: 'Bot',
    title: 'Auto-Reply Engine',
    description:
      'Automatically greet new contacts with a configurable welcome message. Toggle on/off and customize from the dashboard.',
  },
  {
    icon: 'Lock',
    title: 'AES-256-GCM Encryption at Rest',
    description:
      'All message content and API secrets are encrypted at the application layer before hitting the database — not just TLS.',
  },
  {
    icon: 'Gauge',
    title: 'Rate-Limit-Aware Sending',
    description:
      'Sliding-window token bucket with global 429 backoff across all worker instances — prevents WhatsApp account bans.',
  },
  {
    icon: 'Container',
    title: 'One-Command Docker Deployment',
    description:
      'Production-ready Docker Compose stack: Nginx, FastAPI, Next.js, PostgreSQL 16, Redis, and n8n — up in minutes.',
  },
];

// ─── Architecture Steps ───────────────────────────────────────────────────────

export const ARCHITECTURE_STEPS = [
  {
    step: '01',
    title: 'Meta Sends Webhook',
    description: 'WhatsApp Cloud API fires a signed HTTP webhook to your Nginx ingress on every inbound message or status update.',
  },
  {
    step: '02',
    title: 'Signature Verified & Queued',
    description: 'FastAPI verifies the HMAC-SHA256 signature and pushes the payload to the ARQ/Redis job queue — returning 202 in < 50ms.',
  },
  {
    step: '03',
    title: 'Worker Processes & Stores',
    description: 'The inbound worker decrypts, persists to PostgreSQL, and publishes a real-time event via Redis Pub/Sub.',
  },
  {
    step: '04',
    title: 'Dashboard Updates Instantly',
    description: 'The Next.js dashboard receives the SSE push and shows the new message without a page refresh. Agents reply; outbound worker sends via Meta Graph API.',
  },
];

// ─── Quick Start ──────────────────────────────────────────────────────────────

export const QUICKSTART_STEPS = [
  { label: 'Clone the repo', code: `git clone ${GITHUB_URL}.git` },
  { label: 'Copy env file', code: 'cp .env.example .env   # Fill in your Meta credentials' },
  { label: 'Start the stack', code: 'docker compose up -d' },
  { label: 'Open dashboard', code: 'open http://localhost   # or your server IP' },
];

// ─── Open Source Section ──────────────────────────────────────────────────────

export const OPEN_SOURCE = {
  title: 'Built in the Open',
  body:
    'ANFA WhatsApp API was born from the frustration of expensive, closed SaaS WhatsApp platforms. ' +
    'We believe mission-critical communication infrastructure should be auditable, self-hostable, and owned by the teams running it. ' +
    'The entire stack — from Nginx config to ARQ worker — is open for inspection, contribution, and forking.',
  license: 'MIT License',
};

// ─── Nav Links ────────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Quick Start', href: '#quickstart' },
  { label: 'Docs', href: DOCS_URL, external: true },
  { label: 'GitHub', href: GITHUB_URL, external: true },
];
