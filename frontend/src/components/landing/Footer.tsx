import React from 'react';
import { Code, Book, ShieldAlert, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 pt-24 pb-12 border-t border-slate-900 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-primary-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to take control?</h2>
          <p className="text-slate-400 max-w-xl mb-8 text-lg">
            Stop paying per-message markups to third-party CRMs. Self-host your own robust WhatsApp infrastructure today.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors">
              <Code size={20} />
              Star on GitHub
            </a>
            <a href="#" className="flex items-center gap-2 px-8 py-4 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors">
              <Book size={20} />
              Read the Docs
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center border-t border-slate-800/60 pt-8 text-sm">
          <div className="text-slate-500 flex items-center justify-center md:justify-start gap-1">
            Built with <Heart size={14} className="text-rose-500" /> by the open-source community.
          </div>
          <div className="flex justify-center md:justify-end gap-6 text-slate-400">
            <a href="#" className="hover:text-primary-400 transition-colors flex items-center gap-1">
              <ShieldAlert size={14} /> GPL-3.0 License
            </a>
            <a href="#" className="hover:text-primary-400 transition-colors">Contribute</a>
            <a href="#" className="hover:text-primary-400 transition-colors">Discord</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
