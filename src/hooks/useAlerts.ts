import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export interface DbAlert {
  id: string;
  service_id: string;
  type: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
  services?: { name: string };
}

export interface AlertFilters {
  type: string;
  serviceId: string;
  period: string;
  status: string;
}

export function useAlerts(filters?: AlertFilters, page = 0, perPage = 30) {
  return useQuery({
    queryKey: ['alerts', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*, services(name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type as 'critical' | 'warning' | 'info');
      }
      if (filters?.serviceId && filters.serviceId !== 'all') {
        query = query.eq('service_id', filters.serviceId);
      }
      if (filters?.status === 'pending') {
        query = query.eq('acknowledged', false);
      } else if (filters?.status === 'acknowledged') {
        query = query.eq('acknowledged', true);
      }
      if (filters?.period && filters.period !== 'all') {
        const hours = Number(filters.period);
        const since = new Date(Date.now() - hours * 3600000).toISOString();
        query = query.gte('created_at', since);
      }

      query = query.range(page * perPage, (page + 1) * perPage - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as DbAlert[], count: count ?? 0 };
    },
    refetchInterval: 15000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useAcknowledgeAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('acknowledged', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
