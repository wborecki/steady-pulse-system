import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';
import { useAlerts, useAcknowledgeAlert } from '@/hooks/useAlerts';
import { useTriggerHealthCheck, useAllRecentHealthChecks } from '@/hooks/useHealthChecks';
import { StatsCard } from '@/components/monitoring/StatsCard';
import { ServiceRow } from '@/components/monitoring/ServiceRow';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const Index = () => {
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const { data: alerts = [] } = useAlerts();
  const { data: recentChecks = [] } = useAllRecentHealthChecks();
  const acknowledgeAlert = useAcknowledgeAlert();
  const triggerCheck = useTriggerHealthCheck();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const stats = useMemo(() => {
    const online = services.filter(s => s.status === 'online').length;
    const offline = services.filter(s => s.status === 'offline').length;
    const warning = services.filter(s => s.status === 'warning').length;
    const avgUptime = services.length > 0
      ? (services.reduce((a, s) => a + Number(s.uptime), 0) / services.length).toFixed(2)
      : '0';
    return { online, offline, warning, total: services.length, avgUptime };
  }, [services]);

  const responseTimeChartData = useMemo(() => {
    // Aggregate average response time by hour
    const byHour = new Map<string, { total: number; count: number }>();
    recentChecks.forEach(h => {
      const time = new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const entry = byHour.get(time) || { total: 0, count: 0 };
      entry.total += (h.response_time ?? 0);
      entry.count++;
      byHour.set(time, entry);
    });
    return Array.from(byHour.entries()).map(([time, { total, count }]) => ({
      time,
      value: Math.round(total / count),
    }));
  }, [recentChecks]);

  const availabilityChartData = useMemo(() => {
    const byHour = new Map<string, { online: number; total: number }>();
    recentChecks.forEach(h => {
      const time = new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const entry = byHour.get(time) || { online: 0, total: 0 };
      if (h.status === 'online') entry.online++;
      entry.total++;
      byHour.set(time, entry);
    });
    return Array.from(byHour.entries()).map(([time, { online, total }]) => ({
      time,
      value: Math.round((online / total) * 100),
    }));
  }, [recentChecks]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'all') return services;
    return services.filter(s => s.category === selectedCategory);
  }, [selectedCategory, services]);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const categories = ['all', 'aws', 'database', 'airflow', 'server', 'process', 'api'];

  const handleRunChecks = async () => {
    try {
      await triggerCheck.mutateAsync(undefined);
      toast.success('Health checks executados!');
    } catch {
      toast.error('Erro ao executar health checks');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Visão geral do sistema • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRunChecks} disabled={triggerCheck.isPending} className="gap-2 font-mono text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
            Verificar Agora
          </Button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${stats.offline > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
            <Activity className="h-3.5 w-3.5" />
            {stats.offline > 0 ? `${stats.offline} serviço(s) offline` : 'Todos os serviços online'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Serviços Online" value={stats.online} subtitle={`de ${stats.total} serviços`} icon={CheckCircle} variant="success" />
        <StatsCard title="Alertas Ativos" value={unacknowledgedAlerts.length} subtitle="não reconhecidos" icon={AlertTriangle} variant={unacknowledgedAlerts.length > 0 ? 'warning' : 'default'} />
        <StatsCard title="Serviços Offline" value={stats.offline} subtitle="requer atenção" icon={XCircle} variant={stats.offline > 0 ? 'destructive' : 'default'} />
        <StatsCard title="Uptime Médio" value={`${stats.avgUptime}%`} subtitle="últimas 24h" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Latência Média (ms)" data={responseTimeChartData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Disponibilidade (%)" data={availabilityChartData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-lg">Serviços</h2>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : categoryLabels[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredServices.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-mono text-sm">Nenhum serviço cadastrado. Adicione serviços na página de Serviços.</p>
            ) : (
              filteredServices.map(service => (
                <ServiceRow key={service.id} service={service} onClick={() => navigate(`/service/${service.id}`)} />
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Alertas Recentes</h2>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground font-mono text-xs">Nenhum alerta</p>
            ) : (
              alerts.slice(0, 5).map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={{
                    id: alert.id,
                    serviceId: alert.service_id,
                    serviceName: alert.services?.name || 'Serviço',
                    type: alert.type as 'critical' | 'warning' | 'info',
                    message: alert.message,
                    timestamp: alert.created_at,
                    acknowledged: alert.acknowledged,
                  }}
                  onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
