import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationSettings {
  id: string;
  user_id: string;
  alert_email: string | null;
  slack_webhook_url: string | null;
  generic_webhook_url: string | null;
  notify_critical_only: boolean;
  sound_alerts: boolean;
  auto_refresh: boolean;
  check_interval_seconds: number;
  created_at: string;
  updated_at: string;
}

export function useNotificationSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationSettings | null;
    },
    enabled: !!user,
  });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (settings: Partial<NotificationSettings>) => {
      if (!user) throw new Error('Not authenticated');
      const payload = { ...settings, user_id: user.id };
      const { data, error } = await supabase
        .from('notification_settings')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(payload as any, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  });
}
