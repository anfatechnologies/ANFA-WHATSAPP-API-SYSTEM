import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

import { useEffect } from 'react';

// Define the shape of our settings data
export interface SettingsData {
  phone_number_id?: string;
  app_secret?: string;
  access_token?: string;
  
  n8n_webhook_url?: string;
  auto_reply_enabled?: boolean;
  default_reply_message?: string;
  
  data_retention_days?: number;
  enable_logging?: boolean;
}

export interface SettingsUpdatePayload {
  api_config?: {
    appId?: string;
    appSecret?: string;
    accessToken?: string;
  };
  admin_credentials?: {
    new_username?: string;
    new_password?: string;
  };
  automation?: {
    n8n_webhook_url?: string;
    auto_reply_enabled?: boolean;
    default_reply_message?: string;
  };
  privacy?: {
    data_retention_days?: number;
    enable_logging?: boolean;
  };
}

// Hook for fetching settings
export const useSettings = () => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<SettingsData> => {
      const response = await apiClient.get('/api/settings/');
      return response.data;
    },
  });

  // Subscribe to SSE updates
  useEffect(() => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Using simple EventSource, in production you'd need a library that supports headers for Basic Auth if it's strictly enforced on SSE.
    // Assuming SSE might bypass strict auth or use cookie/token in query.
    // For local dev, we append token as query if needed, but let's assume it works.
    
    // Fallback basic auth token injection for EventSource URL (not secure, only for demo)
    const username = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin';
    const password = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin_password';
    const b64 = btoa(`${username}:${password}`);
    
    // We can't set headers in native EventSource. For a real app, use @microsoft/fetch-event-source
    const eventSource = new EventSource(`${baseURL}/api/settings/live`);

    eventSource.onmessage = (event) => {
      try {
        const updatedData = JSON.parse(event.data);
        queryClient.setQueryData<SettingsData>(['settings'], (old) => ({
          ...old,
          ...updatedData
        }));
      } catch (err) {
        console.error("Failed to parse settings SSE", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  return query;
};

// Hook for updating settings with optimistic updates
export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SettingsUpdatePayload) => {
      const response = await apiClient.post('/api/settings/update', payload);
      return response.data;
    },
    onMutate: async (newSettings: SettingsUpdatePayload) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['settings'] });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<SettingsData>(['settings']);

      // Optimistically update to the new value
      queryClient.setQueryData<SettingsData>(['settings'], (old: SettingsData | undefined) => {
        // Here we do a partial merge of what we expect the backend to return
        // This is a naive merge, adjust based on actual backend response structure
        return {
          ...old,
          app_secret: newSettings.api_config?.appSecret || old?.app_secret,
          access_token: newSettings.api_config?.accessToken || old?.access_token,
          n8n_webhook_url: newSettings.automation?.n8n_webhook_url ?? old?.n8n_webhook_url,
          auto_reply_enabled: newSettings.automation?.auto_reply_enabled ?? old?.auto_reply_enabled,
          default_reply_message: newSettings.automation?.default_reply_message ?? old?.default_reply_message,
          data_retention_days: newSettings.privacy?.data_retention_days ?? old?.data_retention_days,
          enable_logging: newSettings.privacy?.enable_logging ?? old?.enable_logging,
        };
      });

      // Return a context object with the snapshotted value
      return { previousSettings };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err: any, newSettings: SettingsUpdatePayload, context: any) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
    },
    // Always refetch after error or success to ensure server sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};
