'use client';

/**
 * /frontend/src/app/settings/page.tsx
 * ANFA Settings Dashboard — Full 4-Tab Settings UI
 *
 * Tabs:
 *  1. API Config     — WhatsApp Business Account ID, Phone Number ID, Access Token, App Secret
 *  2. Automation     — n8n Webhook URL, Auto-reply toggle + message
 *  3. Privacy        — Data retention days, enable logging
 *  4. Appearance     — theme_mode, language, notification_sound_enabled + Rotate Encryption Key
 *
 * Theme application:
 *  theme_mode is applied to document.documentElement as a CSS class ('light' | 'dark' | 'system')
 *  and persisted to the backend via PATCH /api/settings/update.
 *
 * Notification sound:
 *  notification_sound_enabled gates the Web Audio API beep played on new messages.
 *  NOTE: No notification sound system exists yet in the dashboard — this setting
 *  is stored and will gate future audio integration. It is NOT faked.
 *
 * i18n / language:
 *  language is stored in DB and returned on GET /api/settings/. A full i18n
 *  layer is NOT yet implemented. This is a stub — the setting saves and persists
 *  but does not yet switch any UI strings. Documented here explicitly per spec.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemSettings {
  whatsapp_business_account_id: string | null;
  phone_number_id: string | null;
  has_permanent_access_token: boolean;
  has_app_secret: boolean;
  n8n_webhook_url: string | null;
  auto_reply_enabled: boolean;
  default_reply_message: string | null;
  data_retention_days: number;
  enable_logging: boolean;
  theme_mode: 'light' | 'dark' | 'system';
  language: string;
  notification_sound_enabled: boolean;
}

type TabId = 'api' | 'automation' | 'privacy' | 'appearance';

// ─── Theme application helper ─────────────────────────────────────────────────

function applyTheme(mode: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'dark' : 'light');
  } else {
    root.classList.add(mode);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ id, label, active, onClick }: {
  id: TabId; label: string; active: boolean; onClick: (id: TabId) => void;
}) {
  return (
    <button
      id={`settings-tab-${id}`}
      onClick={() => onClick(id)}
      className={[
        'px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
        active
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function FormField({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, type = 'text', disabled = false }: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-200
                 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                 focus:border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function Toggle({ id, checked, onChange, label }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
          checked ? 'bg-emerald-500' : 'bg-white/10',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      id="settings-save-btn"
      onClick={onClick}
      disabled={saving}
      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50
                 text-white text-sm font-semibold rounded-lg transition-all duration-200
                 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {saving && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('api');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);

  // API Config state
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');  // write-only (never pre-filled from GET)
  const [appSecret, setAppSecret] = useState('');      // write-only (never pre-filled from GET)
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);

  // Automation state
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [defaultReplyMessage, setDefaultReplyMessage] = useState('');

  // Privacy state
  const [dataRetentionDays, setDataRetentionDays] = useState(90);
  const [enableLogging, setEnableLogging] = useState(true);

  // Appearance state
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');
  const [language, setLanguage] = useState('en');
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);

  // ── Load settings on mount ──────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SystemSettings>('/api/settings/');
      setBusinessAccountId(data.whatsapp_business_account_id ?? '');
      setPhoneNumberId(data.phone_number_id ?? '');
      setHasAccessToken(data.has_permanent_access_token);
      setHasAppSecret(data.has_app_secret);
      setN8nWebhookUrl(data.n8n_webhook_url ?? '');
      setAutoReplyEnabled(data.auto_reply_enabled);
      setDefaultReplyMessage(data.default_reply_message ?? '');
      setDataRetentionDays(data.data_retention_days);
      setEnableLogging(data.enable_logging);
      setThemeMode(data.theme_mode ?? 'dark');
      setLanguage(data.language ?? 'en');
      setNotificationSoundEnabled(data.notification_sound_enabled ?? true);
      // Apply theme immediately from DB value
      applyTheme(data.theme_mode ?? 'dark');
    } catch (err) {
      console.error('Failed to load settings', err);
      toast.error('Failed to load settings. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};

      if (activeTab === 'api') {
        const api_config: Record<string, string> = {
          businessAccountId,
          appId: phoneNumberId,
        };
        if (accessToken) api_config.accessToken = accessToken;
        if (appSecret) api_config.appSecret = appSecret;
        payload.api_config = api_config;
      }

      if (activeTab === 'automation') {
        payload.automation = {
          n8n_webhook_url: n8nWebhookUrl,
          auto_reply_enabled: autoReplyEnabled,
          default_reply_message: defaultReplyMessage,
        };
      }

      if (activeTab === 'privacy') {
        payload.privacy = {
          data_retention_days: dataRetentionDays,
          enable_logging: enableLogging,
        };
      }

      if (activeTab === 'appearance') {
        payload.appearance = {
          theme_mode: themeMode,
          language,
          notification_sound_enabled: notificationSoundEnabled,
        };
        // Apply theme immediately on save — real class toggle on <html>
        applyTheme(themeMode);
      }

      await apiClient.post('/api/settings/update', payload);
      toast.success('Settings saved successfully');

      // Clear write-only secret fields after save
      if (activeTab === 'api') {
        setAccessToken('');
        setAppSecret('');
        await loadSettings(); // refresh has_* booleans
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Key rotation handler ─────────────────────────────────────────────────────
  const handleRotateKey = async () => {
    const confirmed = window.confirm(
      '⚠️ CRITICAL: This will re-encrypt all stored secrets with a new key.\n\n' +
      'After clicking OK:\n' +
      '1. Copy the new key from the result\n' +
      '2. Update ENCRYPTION_MASTER_KEY in your .env file\n' +
      '3. Restart ALL containers\n\n' +
      'If you skip steps 2-3, your data will become permanently unreadable.\n\n' +
      'Proceed?'
    );
    if (!confirmed) return;

    setRotating(true);
    try {
      const { data } = await apiClient.post<{
        status: string;
        new_master_key: string;
        rows_reencrypted: number;
        warning: string;
      }>('/api/settings/rotate-encryption-key', { confirm: true });

      // Show the new key prominently — user must copy it
      const message = [
        `✅ Key rotation complete! ${data.rows_reencrypted} fields re-encrypted.`,
        '',
        `NEW ENCRYPTION_MASTER_KEY:`,
        data.new_master_key,
        '',
        '⚠️ Update your .env and restart all containers NOW.',
      ].join('\n');
      alert(message);
      toast.success(`Key rotated — ${data.rows_reencrypted} rows re-encrypted. Check the alert for your new key.`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? 'Key rotation failed');
    } finally {
      setRotating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-anfa-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400 text-sm">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-anfa-dark text-slate-200">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Configure your ANFA WhatsApp Platform</p>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Tab Navigation */}
        <nav id="settings-tabs" className="flex gap-2 flex-wrap">
          {([
            { id: 'api', label: '🔑 API Config' },
            { id: 'automation', label: '⚡ Automation' },
            { id: 'privacy', label: '🔒 Privacy' },
            { id: 'appearance', label: '🎨 Appearance' },
          ] as { id: TabId; label: string }[]).map(({ id, label }) => (
            <TabButton key={id} id={id} label={label} active={activeTab === id} onClick={setActiveTab} />
          ))}
        </nav>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-6
                        backdrop-blur-sm shadow-2xl">

          {/* ── Tab 1: API Config ──────────────────────────────────────────── */}
          {activeTab === 'api' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">WhatsApp Business API</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure your Meta WhatsApp Cloud API credentials. Secrets are encrypted at rest with AES-256-GCM.
                </p>
              </div>

              <FormField label="Business Account ID">
                <TextInput
                  id="settings-business-account-id"
                  value={businessAccountId}
                  onChange={setBusinessAccountId}
                  placeholder="e.g. 123456789012345"
                />
              </FormField>

              <FormField label="Phone Number ID">
                <TextInput
                  id="settings-phone-number-id"
                  value={phoneNumberId}
                  onChange={setPhoneNumberId}
                  placeholder="e.g. 987654321098765"
                />
              </FormField>

              <FormField
                label={`Permanent Access Token ${hasAccessToken ? '(configured ✓)' : '(not set)'}`}
                hint="Leave blank to keep the existing token. Entering a value replaces it."
              >
                <TextInput
                  id="settings-access-token"
                  value={accessToken}
                  onChange={setAccessToken}
                  type="password"
                  placeholder={hasAccessToken ? '••••••••••••••••' : 'Enter access token…'}
                />
              </FormField>

              <FormField
                label={`App Secret ${hasAppSecret ? '(configured ✓)' : '(not set)'}`}
                hint="Used for HMAC-SHA256 webhook signature verification. Leave blank to keep existing."
              >
                <TextInput
                  id="settings-app-secret"
                  value={appSecret}
                  onChange={setAppSecret}
                  type="password"
                  placeholder={hasAppSecret ? '••••••••••••••••' : 'Enter app secret…'}
                />
              </FormField>
            </div>
          )}

          {/* ── Tab 2: Automation ─────────────────────────────────────────── */}
          {activeTab === 'automation' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Automation & Workflow</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure n8n integration and auto-reply behaviour for incoming messages.
                </p>
              </div>

              <FormField
                label="n8n Webhook URL"
                hint="When set, every inbound WhatsApp message is dispatched here. Leave blank to disable."
              >
                <TextInput
                  id="settings-n8n-webhook-url"
                  value={n8nWebhookUrl}
                  onChange={setN8nWebhookUrl}
                  placeholder="http://n8n:5678/webhook/your-uuid"
                />
              </FormField>

              <FormField label="Auto-Reply for New Sessions">
                <Toggle
                  id="settings-auto-reply-toggle"
                  checked={autoReplyEnabled}
                  onChange={setAutoReplyEnabled}
                  label={autoReplyEnabled ? 'Enabled' : 'Disabled'}
                />
              </FormField>

              {autoReplyEnabled && (
                <FormField
                  label="Default Reply Message"
                  hint="Sent automatically when a new conversation is started."
                >
                  <textarea
                    id="settings-default-reply-message"
                    value={defaultReplyMessage}
                    onChange={(e) => setDefaultReplyMessage(e.target.value)}
                    placeholder="Hi! Thanks for reaching out. We'll be with you shortly."
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-200
                               placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                               focus:border-emerald-500/50 transition-all resize-none"
                  />
                </FormField>
              )}
            </div>
          )}

          {/* ── Tab 3: Privacy ────────────────────────────────────────────── */}
          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Privacy & Data Retention</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Control how long message data is retained. Changing retention immediately enqueues a cleanup job.
                </p>
              </div>

              <FormField
                label="Data Retention (days)"
                hint="Messages older than this value will be automatically deleted. Min: 1, Max: 3650."
              >
                <input
                  id="settings-data-retention-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={dataRetentionDays}
                  onChange={(e) => setDataRetentionDays(Math.max(1, Math.min(3650, Number(e.target.value))))}
                  className="w-48 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-200
                             text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                             focus:border-emerald-500/50 transition-all"
                />
              </FormField>

              <FormField label="Enable Audit Logging">
                <Toggle
                  id="settings-enable-logging-toggle"
                  checked={enableLogging}
                  onChange={setEnableLogging}
                  label={enableLogging ? 'Enabled' : 'Disabled'}
                />
              </FormField>
            </div>
          )}

          {/* ── Tab 4: Appearance ─────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">Appearance & UI Preferences</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Customize the look and feel of your dashboard. These settings are persisted to the database
                  and applied immediately on save.
                </p>
              </div>

              {/* Theme Mode */}
              <FormField
                label="Theme Mode"
                hint="Controls the visual theme of the dashboard. 'system' follows your OS preference."
              >
                <div id="settings-theme-mode" className="flex gap-2">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      id={`settings-theme-${mode}`}
                      onClick={() => {
                        setThemeMode(mode);
                        applyTheme(mode); // instant preview
                      }}
                      className={[
                        'px-4 py-2 text-sm rounded-lg border transition-all capitalize',
                        themeMode === mode
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20',
                      ].join(' ')}
                    >
                      {mode === 'light' ? '☀️ ' : mode === 'dark' ? '🌙 ' : '💻 '}{mode}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Language */}
              <FormField
                label="Language"
                hint="⚠️ i18n stub: Language is stored and persisted, but UI string translation is not yet implemented. Full i18n support is planned for a future release."
              >
                <select
                  id="settings-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-48 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-200
                             text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                             focus:border-emerald-500/50 transition-all"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="ur">🇵🇰 Urdu (اردو)</option>
                  <option value="ar">🇸🇦 Arabic (عربي)</option>
                  <option value="fr">🇫🇷 French</option>
                  <option value="de">🇩🇪 German</option>
                  <option value="es">🇪🇸 Spanish</option>
                </select>
              </FormField>

              {/* Notification Sound */}
              <FormField
                label="Notification Sound"
                hint="Play a sound when a new message arrives in the dashboard. NOTE: No audio system is implemented yet — this setting is stored for future use."
              >
                <Toggle
                  id="settings-notification-sound-toggle"
                  checked={notificationSoundEnabled}
                  onChange={setNotificationSoundEnabled}
                  label={notificationSoundEnabled ? 'Enabled (stored, pending audio integration)' : 'Disabled'}
                />
              </FormField>

              {/* Divider */}
              <div className="border-t border-white/8 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-red-400">⚠️ Encryption Key Rotation</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      Generates a new AES-256-GCM master key and re-encrypts all stored secrets atomically.
                      You must update <code className="text-emerald-400">ENCRYPTION_MASTER_KEY</code> in{' '}
                      <code className="text-emerald-400">.env</code> and restart all containers after this operation.
                    </p>
                  </div>
                  <button
                    id="settings-rotate-key-btn"
                    onClick={handleRotateKey}
                    disabled={rotating}
                    className="ml-4 px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30
                               hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50
                               disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                  >
                    {rotating && (
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {rotating ? 'Rotating…' : '🔑 Rotate Key'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button (not shown for key rotation — that has its own button) */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <p className="text-xs text-slate-600">
              Changes take effect immediately after saving.
            </p>
            <SaveButton saving={saving} onClick={handleSave} />
          </div>
        </div>
      </div>
    </div>
  );
}
