import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRefreshInterval } from './useRefreshInterval';

export interface DashboardTimelineEntry {
  bucket: string;
  avg_response_time: number;
  total: number;
  available: number;
  incidents: number;
  availability_pct: number;
}

export interface IncidentsByCategory {
  category: string;
  incident_count: number;
}

export interface DashboardStats {
  total_checks: number;
  online_checks: number;
  offline_checks: number;
  warning_checks: number;
  avg_response_time: number;
  sla_percentage: number;
  timeline: DashboardTimelineEntry[];
  incidents_by_category: IncidentsByCategory[];
}

const emptyStats: DashboardStats = {
  total_checks: 0,
  online_checks: 0,
  offline_checks: 0,
  warning_checks: 0,
  avg_response_time: 0,
  sla_percentage: 0,
  timeline: [],
  incidents_by_category: [],
};

export function useDashboardStats(hours = 24) {
  const refetchInterval = useRefreshInterval(30000);
  return useQuery({
    queryKey: ['dashboard_stats', hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_health_stats', {
        p_hours: hours,
      });
      if (error) throw error;
      return (data as unknown as DashboardStats) ?? emptyStats;
    },
    refetchInterval,
  });
}
