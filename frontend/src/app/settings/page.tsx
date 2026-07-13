// /frontend/src/app/settings/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Key, ShieldCheck, Database, Copy, Check, Moon, Globe, LogOut, Download, RefreshCw } from 'lucide-react';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'api', label: 'API Configuration', icon: Key },
  { id: 'security', label: 'Security & Admin', icon: ShieldCheck },
  { id: 'data', label: 'Data Management', icon: Database },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center px-4 justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="font-semibold text-sm hidden sm:block">Settings</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <h2 className="text-2xl font-bold mb-6">Settings</h2>
          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap relative ${
                    isActive ? 'text-primary-400 bg-primary-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-primary-500/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">General Settings</h3>
                    <p className="text-slate-400 text-sm mb-6">Manage your basic platform preferences.</p>
                  </div>
                  
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800 rounded-xl">
                          <Moon className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-200">Theme</h4>
                          <p className="text-sm text-slate-400">Currently fixed to dark mode for optimal viewing.</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-xs font-semibold">Active</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800 rounded-xl">
                          <Globe className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-200">Language</h4>
                          <p className="text-sm text-slate-400">Default dashboard language.</p>
                        </div>
                      </div>
                      <select className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 outline-none">
                        <option>English (US)</option>
                        <option>Urdu</option>
                        <option>Spanish</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">API Configuration</h3>
                    <p className="text-slate-400 text-sm mb-6">Manage Meta WhatsApp Cloud API credentials and webhooks.</p>
                  </div>
                  
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
                      <div className="flex gap-2">
                        <input type="text" readOnly value="https://anfa.tech/api/webhooks/meta" className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 outline-none" />
                        <button onClick={() => handleCopy("https://anfa.tech/api/webhooks/meta")} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center">
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Provide this URL to your Meta Developer Dashboard.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">App ID</label>
                        <input type="text" placeholder="Enter App ID" className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">App Secret</label>
                        <input type="password" placeholder="••••••••••••••••" className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 outline-none" />
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <button className="px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-all font-medium">Save Credentials</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Security & Admin</h3>
                    <p className="text-slate-400 text-sm mb-6">Manage authentication and monitor active sessions.</p>
                  </div>
                  
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-slate-200">Zero-Configuration Auth</h4>
                        <p className="text-sm text-slate-400">Hardcoded Dashboard Access</p>
                      </div>
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-semibold">Protected</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-slate-300 font-mono">admin</span>
                        <span className="text-slate-500">logged in via HTTP Basic Auth</span>
                      </div>
                      <button className="text-sm text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors">
                        <LogOut className="w-4 h-4" /> End Session
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Data Management</h3>
                    <p className="text-slate-400 text-sm mb-6">Database maintenance, backups, and encryption.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md hover:border-slate-700 transition-colors cursor-pointer group">
                      <div className="p-3 bg-slate-800 rounded-xl w-max mb-4 group-hover:bg-primary-500/20 transition-colors">
                        <Download className="w-6 h-6 text-slate-300 group-hover:text-primary-400" />
                      </div>
                      <h4 className="font-bold text-slate-200 mb-2">Trigger Backup</h4>
                      <p className="text-sm text-slate-400">Initiate a manual pg_dump backup of all partitioned data.</p>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-md hover:border-slate-700 transition-colors cursor-pointer group">
                      <div className="p-3 bg-slate-800 rounded-xl w-max mb-4 group-hover:bg-amber-500/20 transition-colors">
                        <RefreshCw className="w-6 h-6 text-slate-300 group-hover:text-amber-400" />
                      </div>
                      <h4 className="font-bold text-slate-200 mb-2">Rotate Master Key</h4>
                      <p className="text-sm text-slate-400">Re-encrypt all sensitive fields using a new AES-256-GCM key.</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
