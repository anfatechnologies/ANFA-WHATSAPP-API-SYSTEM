// /frontend/src/hooks/useSettings.ts
// ANFA Settings Hook - System Configuration Management
// Provides CRUD operations for system settings and Meta credentials.

'use client';

import { useState, useCallback } from 'react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface SystemSettings {
  default_agent_role: 'admin' | 'supervisor' | 'agent';
  auto_assign_sessions: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  timezone: string;
  max_message_length: number;
  session_timeout_hours: number;
  enable_ml_features: boolean;
}

export interface MetaCredentials {
  phone_number_id: string;
  verify_token: string;
  app_secret: string;
  access_token?: string;
}

export interface PhoneNumberConfig {
  id: string;
  phone_number_id: string;
  display_name: string;
  business_account_id: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface UseSettingsReturn {
  // System settings
  systemSettings: ApiResponse<SystemSettings>;
  fetchSystemSettings: () => Promise<void>;
  updateSystemSettings: (settings: SystemSettings) => Promise<boolean>;
  
  // Meta credentials
  metaCredentials: ApiResponse<Record<string, unknown>>;
  storeMetaCredentials: (creds: MetaCredentials) => Promise<boolean>;
  fetchMetaCredentials: (phoneNumberId: string) => Promise<void>;
  deleteMetaCredentials: (phoneNumberId: string) => Promise<boolean>;
  
  // Phone number configs
  phoneConfigs: ApiResponse<PhoneNumberConfig[]>;
  fetchPhoneConfigs: () => Promise<void>;
  createPhoneConfig: (config: Omit<PhoneNumberConfig, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  
  // Loading state
  isLoading: boolean;
}

// =============================================================================
// API CLIENT
// =============================================================================

const API_BASE = '/api';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    // Some endpoints return plain text (e.g., webhook verification)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json() as T;
      return { data };
    }
    
    const text = await response.text();
    return { data: text as unknown as T };
    
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

// =============================================================================
// SETTINGS HOOK
// =============================================================================

/**
 * useSettings - React hook for managing ANFA system configuration
 * 
 * Provides methods to read and write system settings, Meta API credentials,
 * and phone number configurations. All operations are fully typed.
 * 
 * @example
 * const { systemSettings, fetchSystemSettings, updateSystemSettings } = useSettings();
 * 
 * // Load settings on mount
 * useEffect(() => { fetchSystemSettings(); }, []);
 * 
 * // Toggle auto-assignment
 * const handleToggle = async () => {
 *   await updateSystemSettings({
 *     ...systemSettings.data,
 *     auto_assign_sessions: !systemSettings.data.auto_assign_sessions,
 *   });
 * };
 */
export function useSettings(): UseSettingsReturn {
  const [systemSettings, setSystemSettings] = useState<ApiResponse<SystemSettings>>({
    data: null,
    error: null,
    loading: false,
  });
  
  const [metaCredentials, setMetaCredentials] = useState<ApiResponse<Record<string, unknown>>>({
    data: null,
    error: null,
    loading: false,
  });
  
  const [phoneConfigs, setPhoneConfigs] = useState<ApiResponse<PhoneNumberConfig[]>>({
    data: null,
    error: null,
    loading: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // ---------------------------------------------------------------------------
  // System Settings
  // ---------------------------------------------------------------------------
  
  const fetchSystemSettings = useCallback(async () => {
    setSystemSettings(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await apiRequest<SystemSettings>('/settings/system');
    setSystemSettings({
      data: data || null,
      error: error || null,
      loading: false,
    });
  }, []);
  
  const updateSystemSettings = useCallback(async (settings: SystemSettings): Promise<boolean> => {
    setIsLoading(true);
    const { data, error } = await apiRequest<SystemSettings>('/settings/system', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    setIsLoading(false);
    
    if (error) {
      setSystemSettings(prev => ({ ...prev, error }));
      return false;
    }
    
    setSystemSettings({ data: data || null, error: null, loading: false });
    return true;
  }, []);
  
  // ---------------------------------------------------------------------------
  // Meta Credentials
  // ---------------------------------------------------------------------------
  
  const storeMetaCredentials = useCallback(async (creds: MetaCredentials): Promise<boolean> => {
    setIsLoading(true);
    const { error } = await apiRequest('/settings/meta-credentials', {
      method: 'POST',
      body: JSON.stringify(creds),
    });
    setIsLoading(false);
    
    if (error) {
      setMetaCredentials(prev => ({ ...prev, error }));
      return false;
    }
    
    return true;
  }, []);
  
  const fetchMetaCredentials = useCallback(async (phoneNumberId: string) => {
    setMetaCredentials(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await apiRequest<Record<string, unknown>>(
      `/settings/meta-credentials/${phoneNumberId}`
    );
    setMetaCredentials({
      data: data || null,
      error: error || null,
      loading: false,
    });
  }, []);
  
  const deleteMetaCredentials = useCallback(async (phoneNumberId: string): Promise<boolean> => {
    setIsLoading(true);
    const { error } = await apiRequest(`/settings/meta-credentials/${phoneNumberId}`, {
      method: 'DELETE',
    });
    setIsLoading(false);
    
    if (error) {
      setMetaCredentials(prev => ({ ...prev, error }));
      return false;
    }
    
    return true;
  }, []);
  
  // ---------------------------------------------------------------------------
  // Phone Number Configs
  // ---------------------------------------------------------------------------
  
  const fetchPhoneConfigs = useCallback(async () => {
    setPhoneConfigs(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await apiRequest<PhoneNumberConfig[]>('/settings/phone-numbers');
    setPhoneConfigs({
      data: data || null,
      error: error || null,
      loading: false,
    });
  }, []);
  
  const createPhoneConfig = useCallback(async (
    config: Omit<PhoneNumberConfig, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    setIsLoading(true);
    const { error } = await apiRequest('/settings/phone-numbers', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    setIsLoading(false);
    
    if (error) {
      setPhoneConfigs(prev => ({ ...prev, error }));
      return false;
    }
    
    // Refresh the list
    await fetchPhoneConfigs();
    return true;
  }, [fetchPhoneConfigs]);
  
  return {
    systemSettings,
    fetchSystemSettings,
    updateSystemSettings,
    metaCredentials,
    storeMetaCredentials,
    fetchMetaCredentials,
    deleteMetaCredentials,
    phoneConfigs,
    fetchPhoneConfigs,
    createPhoneConfig,
    isLoading,
  };
}

export default useSettings;
