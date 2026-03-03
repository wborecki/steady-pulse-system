import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeConnectedContext } from './useRealtimeStatus';

/**
 * Component that subscribes to Supabase Realtime changes on services, alerts, and health_checks
 * and automatically invalidates the relevant React Query caches.
 * Provides RealtimeConnectedContext so hooks can disable polling when Realtime is active.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

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
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [qc]);

  return (
    <RealtimeConnectedContext.Provider value={connected}>
      {children}
    </RealtimeConnectedContext.Provider>
  );
}
