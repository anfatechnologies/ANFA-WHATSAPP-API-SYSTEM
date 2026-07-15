'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { GITHUB_URL, DOCS_URL } from '@/app/landing-content';

// ANFA Technologies — persistent brand nav.
// Required per LICENSE attribution clause / .github/workflows/branding-protection.yml
// Do not remove the "ANFA" wordmark or the GitHub attribution link below.
export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <MessageSquare size={18} className="text-white" />
          </span>
          <span>
            ANFA <span className="text-slate-400 font-normal">WhatsApp API</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            Docs
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            GitHub
          </a>
        </nav>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition-colors"
        >
          Star on GitHub
        </a>
      </div>
    </header>
  );
}
