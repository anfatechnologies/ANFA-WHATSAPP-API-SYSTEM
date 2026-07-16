'use client';

import { useSettings } from '@/hooks/use-settings';

// Minimal, real i18n implementation. `language` was previously stored on
// the backend and selectable in the UI but had zero effect anywhere - this
// wires it to actually translate a set of commonly-visible strings.
//
// Scope note: this covers the dashboard nav/header and settings page labels,
// not every string in the app. Extending TRANSLATIONS below covers more
// surface area over time without changing the hook's API.

export type SupportedLanguage = 'en' | 'ur';

const TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  dashboard: { en: 'Dashboard', ur: 'ڈیش بورڈ' },
  settings: { en: 'Settings', ur: 'ترتیبات' },
  chats: { en: 'Chats', ur: 'چیٹس' },
  contacts: { en: 'Contacts', ur: 'رابطے' },
  logout: { en: 'Log out', ur: 'لاگ آؤٹ' },
  save: { en: 'Save', ur: 'محفوظ کریں' },
  saving: { en: 'Saving…', ur: 'محفوظ ہو رہا ہے…' },
  saved: { en: 'Saved', ur: 'محفوظ ہو گیا' },
  api_config: { en: 'API Config', ur: 'اے پی آئی کنفیگ' },
  automation: { en: 'Automation', ur: 'آٹومیشن' },
  privacy: { en: 'Privacy', ur: 'رازداری' },
  appearance: { en: 'Appearance & UI', ur: 'ظاہری شکل اور یو آئی' },
  theme: { en: 'Theme', ur: 'تھیم' },
  language: { en: 'Language', ur: 'زبان' },
  notification_sound: { en: 'Notification Sound', ur: 'اطلاعی آواز' },
  send: { en: 'Send', ur: 'بھیجیں' },
  new_message: { en: 'New message', ur: 'نیا پیغام' },
  no_active_session: { en: 'No active session', ur: 'کوئی فعال سیشن نہیں' },
};

export type TranslationKey = keyof typeof TRANSLATIONS;

/**
 * Returns a `t(key)` translator function driven by the user's saved
 * `language` setting (falls back to English if unset, unrecognized, or
 * settings haven't loaded yet).
 */
export function useTranslation() {
  const { data: settingsData } = useSettings();
  const lang: SupportedLanguage = settingsData?.language === 'ur' ? 'ur' : 'en';

  const t = (key: TranslationKey | string): string => {
    const entry = TRANSLATIONS[key as TranslationKey];
    if (!entry) return key; // unknown key - fall back to the key itself
    return entry[lang] ?? entry.en;
  };

  return { t, lang };
}
