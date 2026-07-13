'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, Shield, Database, Key, Copy, Bot, Bell, Moon, Sun, Monitor, Languages, Zap
} from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('api');
  
  // Local state for the settings categories
  // H4 FIX: Added businessAccountId — was missing from UI despite being in DB schema
  const [apiConfig, setApiConfig] = useState({ businessAccountId: '', appId: '', appSecret: '', accessToken: '' });
  const [automationConfig, setAutomationConfig] = useState({ n8n_webhook_url: '', auto_reply_enabled: false, default_reply_message: '' });
  const [privacyConfig, setPrivacyConfig] = useState({ data_retention_days: 90, enable_logging: true });
  const [appearanceConfig, setAppearanceConfig] = useState({ themeMode: 'system', notificationsEnabled: true, language: 'en' });
  const [adminConfig, setAdminConfig] = useState({ username: '', password: '' });
  
  const { data: settingsData, isLoading, isError } = useSettings();
  const updateSettings = useUpdateSettings();

  useEffect(() => {
    if (settingsData) {
       setApiConfig({
         // H4 FIX: populate Business Account ID from backend
         businessAccountId: settingsData.whatsapp_business_account_id || '',
         appId: settingsData.phone_number_id || '',
         appSecret: settingsData.app_secret || '',
         accessToken: settingsData.access_token || '',
       });
       setAutomationConfig({
         n8n_webhook_url: settingsData.n8n_webhook_url || '',
         auto_reply_enabled: settingsData.auto_reply_enabled || false,
         default_reply_message: settingsData.default_reply_message || '',
       });
       setPrivacyConfig({
         data_retention_days: settingsData.data_retention_days || 90,
         enable_logging: settingsData.enable_logging !== undefined ? settingsData.enable_logging : true,
       });
    }
  }, [settingsData]);

  const handleUpdateSettings = async (category: string) => {
    try {
      let payload = {};
      if (category === 'api') {
        // H4 FIX: include businessAccountId in payload
        payload = { api_config: { businessAccountId: apiConfig.businessAccountId, appId: apiConfig.appId, appSecret: apiConfig.appSecret, accessToken: apiConfig.accessToken } };
      } else if (category === 'automation') {
        payload = { automation: automationConfig };
      } else if (category === 'privacy') {
        payload = { privacy: privacyConfig };
      } else if (category === 'security') {
        payload = { admin_credentials: { new_username: adminConfig.username || undefined, new_password: adminConfig.password || undefined } };
      }

      updateSettings.mutate(payload, {
        onSuccess: () => {
          toast.success('Settings updated successfully!');
        },
        onError: (error: any) => {
          toast.error('Failed to update settings: ' + error.message);
        }
      });
    } catch (error: any) {
      toast.error('An unexpected error occurred.');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 w-full">
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-10 flex items-center px-6 flex-shrink-0">
        <h1 className="font-semibold text-lg flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-500" />
          Platform Settings
        </h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-10 p-4 flex flex-col gap-2 flex-shrink-0">
          <button onClick={() => setActiveTab('api')} className={`p-3 rounded-lg text-left text-sm font-medium transition-colors ${activeTab === 'api' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}>Meta Business Config</button>
          <button onClick={() => setActiveTab('automation')} className={`p-3 rounded-lg text-left text-sm font-medium transition-colors ${activeTab === 'automation' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}>Automation & Workflow</button>
          <button onClick={() => setActiveTab('privacy')} className={`p-3 rounded-lg text-left text-sm font-medium transition-colors ${activeTab === 'privacy' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}>System & Privacy</button>
          <button onClick={() => setActiveTab('appearance')} className={`p-3 rounded-lg text-left text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}>Appearance & UI</button>
          <button onClick={() => setActiveTab('security')} className={`p-3 rounded-lg text-left text-sm font-medium transition-colors mt-auto ${activeTab === 'security' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-slate-800 text-slate-400'}`}>Security & Admin</button>
        </aside>

        {/* Settings Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <motion.div 
            key={activeTab}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            {activeTab === 'api' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-indigo-400"/> Meta API Configuration</h2>
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-10 space-y-4">
                  {/* H4 FIX: Added WhatsApp Business Account ID field — was missing from UI */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">WhatsApp Business Account ID</label>
                    <div className="flex gap-2">
                      <input 
                        id="settings-business-account-id"
                        type="text" 
                        value={apiConfig.businessAccountId}
                        onChange={e => setApiConfig({...apiConfig, businessAccountId: e.target.value})}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" 
                        placeholder="e.g. 102938475600123" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">Phone Number ID</label>
                    <div className="flex gap-2">
                      <input 
                        id="settings-phone-number-id"
                        type="text" 
                        value={apiConfig.appId}
                        onChange={e => setApiConfig({...apiConfig, appId: e.target.value})}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" 
                        placeholder="e.g. 1029384756" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">App Secret</label>
                    <div className="flex gap-2">
                      <input 
                        id="settings-app-secret"
                        type="password" 
                        value={apiConfig.appSecret}
                        onChange={e => setApiConfig({...apiConfig, appSecret: e.target.value})}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" 
                        placeholder="••••••••••••••••" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">Permanent Access Token</label>
                    <div className="flex gap-2">
                      <input 
                        id="settings-access-token"
                        type="password" 
                        value={apiConfig.accessToken}
                        onChange={e => setApiConfig({...apiConfig, accessToken: e.target.value})}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" 
                        placeholder="EAA..." 
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                     <button 
                        id="settings-save-api"
                        onClick={() => handleUpdateSettings('api')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                     >
                       Save API Configuration
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-indigo-400"/> Automation & Workflow</h2>
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-10 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">n8n Webhook URL</label>
                    <input 
                      type="url" 
                      value={automationConfig.n8n_webhook_url}
                      onChange={e => setAutomationConfig({...automationConfig, n8n_webhook_url: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" 
                      placeholder="https://n8n.yourdomain.com/webhook/..." 
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div>
                      <h4 className="text-sm font-medium">Enable Auto-Reply</h4>
                      <p className="text-xs text-slate-400">Automatically reply to new inbound sessions.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={automationConfig.auto_reply_enabled} onChange={e => setAutomationConfig({...automationConfig, auto_reply_enabled: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">Default Reply Message</label>
                    <textarea 
                      value={automationConfig.default_reply_message}
                      onChange={e => setAutomationConfig({...automationConfig, default_reply_message: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none h-24 resize-none" 
                      placeholder="Hello! We have received your message and an agent will be with you shortly." 
                    />
                  </div>
                  <div className="pt-2">
                     <button 
                        onClick={() => handleUpdateSettings('automation')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                     >
                       Save Automation Settings
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-indigo-400"/> System & Data Sovereignty</h2>
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-10 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div>
                      <h4 className="text-sm font-medium">Data Retention Policy</h4>
                      <p className="text-xs text-slate-400">Number of days to keep messages before automatic deletion.</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <input 
                          type="number" 
                          min="1" max="365"
                          value={privacyConfig.data_retention_days}
                          onChange={e => setPrivacyConfig({...privacyConfig, data_retention_days: parseInt(e.target.value) || 90})}
                          className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm focus:border-indigo-500 outline-none text-center" 
                        />
                        <span className="text-sm text-slate-400">days</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div>
                      <h4 className="text-sm font-medium">Detailed Logging</h4>
                      <p className="text-xs text-slate-400">Enable verbose logging for debugging system events.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={privacyConfig.enable_logging} onChange={e => setPrivacyConfig({...privacyConfig, enable_logging: e.target.checked})} />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>
                  
                  <div className="pt-2 flex justify-between items-center">
                     <button 
                        onClick={() => handleUpdateSettings('privacy')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                     >
                       Save Privacy Settings
                     </button>
                     <button className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm font-medium text-slate-300 transition-colors flex items-center gap-2">
                       <Key className="w-4 h-4"/> Rotate Master Key
                     </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Appearance & UI</h2>
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-10 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <button className="p-4 rounded-lg border border-slate-700 bg-slate-950 flex flex-col items-center gap-2 hover:border-indigo-500">
                      <Sun className="w-6 h-6 text-slate-400"/>
                      <span className="text-sm">Light</span>
                    </button>
                    <button className="p-4 rounded-lg border border-indigo-500 bg-indigo-500/10 flex flex-col items-center gap-2">
                      <Moon className="w-6 h-6 text-indigo-400"/>
                      <span className="text-sm">Dark</span>
                    </button>
                    <button className="p-4 rounded-lg border border-slate-700 bg-slate-950 flex flex-col items-center gap-2 hover:border-indigo-500">
                      <Monitor className="w-6 h-6 text-slate-400"/>
                      <span className="text-sm">System</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-slate-400"/>
                      <div>
                        <h4 className="text-sm font-medium">Notification Sounds</h4>
                        <p className="text-xs text-slate-400">Play a sound for new inbound messages.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-red-400"/> Security & Admin</h2>
                <div className="p-6 rounded-xl border border-red-900/30 bg-red-950/10 backdrop-blur-10">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">New Admin Username</label>
                      <input 
                        type="text" 
                        value={adminConfig.username}
                        onChange={e => setAdminConfig({...adminConfig, username: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none" 
                        placeholder="admin" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">New Password</label>
                      <input 
                        type="password" 
                        value={adminConfig.password}
                        onChange={e => setAdminConfig({...adminConfig, password: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none" 
                        placeholder="••••••••" 
                      />
                    </div>
                    <button 
                      onClick={() => handleUpdateSettings('security')}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium text-white transition-colors"
                    >
                      Update Credentials
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
