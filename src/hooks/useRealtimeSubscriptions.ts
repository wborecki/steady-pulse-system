import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that subscribes to Supabase Realtime changes on services, alerts, and health_checks
 * and automatically invalidates the relevant React Query caches.
 */
export function useRealtimeSubscriptions() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('realtime-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        qc.invalidateQueries({ queryKey: ['services'] });
        qc.invalidateQueries({ queryKey: ['service'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        qc.invalidateQueries({ queryKey: ['alerts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_checks' }, () => {
        qc.invalidateQueries({ queryKey: ['health_checks'] });
        qc.invalidateQueries({ queryKey: ['health_checks_recent'] });
        qc.invalidateQueries({ queryKey: ['health_checks_filtered'] });
        qc.invalidateQueries({ queryKey: ['health_checks_period'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
