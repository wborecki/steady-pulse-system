import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';
import { useAlerts } from '@/hooks/useAlerts';
import { useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { StatsCard } from '@/components/monitoring/StatsCard';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { CategoryBarChart } from '@/components/monitoring/CategoryBarChart';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { type ServiceStatus } from '@/data/mockData';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, TrendingUp, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { DashboardSkeleton } from '@/components/monitoring/DashboardSkeleton';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
  container: 'Containers', infra: 'Infraestrutura',
};

const Index = () => {
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const { data: alertResult } = useAlerts();
  const alerts = alertResult?.data ?? [];
  const { data: dashStats } = useDashboardStats(24);
  const triggerCheck = useTriggerHealthCheck();

  const stats = useMemo(() => {
    const warning = services.filter(s => s.status === 'warning').length;
    const offline = services.filter(s => s.status === 'offline').length;
    const online = services.filter(s => s.status === 'online' || s.status === 'warning').length;
    const avgUptime = services.length > 0
      ? (services.reduce((a, s) => a + Number(s.uptime), 0) / services.length).toFixed(2)
      : '0';
    return { online, offline, warning, total: services.length, avgUptime };
  }, [services]);

  const slaStats = useMemo(() => {
    if (!dashStats) return { sla24h: '0' };
    return { sla24h: String(dashStats.sla_percentage) };
  }, [dashStats]);

  const criticalServices = useMemo(() => {
    return services
      .filter(s => s.status === 'offline' || s.status === 'warning')
      .sort((a, b) => (a.status === 'offline' ? -1 : 1));
  }, [services]);

  const incidentsByCategory = useMemo(() => {
    if (!dashStats) return [];
    return dashStats.incidents_by_category.map(c => ({
      time: categoryLabels[c.category] || c.category,
      value: c.incident_count,
    }));
  }, [dashStats]);

  const incidentTimeline = useMemo(() => {
    if (!dashStats) return [];
    return dashStats.timeline
      .filter(t => t.incidents > 0)
      .map(t => ({ time: t.bucket, value: t.incidents }));
  }, [dashStats]);

  const responseTimeChartData = useMemo(() => {
    if (!dashStats) return [];
    return dashStats.timeline.map(t => ({
      time: t.bucket,
      value: t.avg_response_time,
    }));
  }, [dashStats]);

  const availabilityChartData = useMemo(() => {
    if (!dashStats) return [];
    return dashStats.timeline.map(t => ({
      time: t.bucket,
      value: t.availability_pct,
    }));
  }, [dashStats]);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

  const handleRunChecks = async () => {
    try {
      await triggerCheck.mutateAsync(undefined);
      toast.success('Health checks executados!');
    } catch {
      toast.error('Erro ao executar health checks');
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono truncate">
            Visão geral • {new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
            {(() => {
              const lastChecks = services.filter(s => s.last_check).map(s => new Date(s.last_check!).getTime());
              if (lastChecks.length === 0) return null;
              const mostRecent = Math.max(...lastChecks);
              const minutesAgo = Math.round((Date.now() - mostRecent) / 60000);
              return ` • ${minutesAgo < 1 ? 'agora' : `${minutesAgo}min atrás`}`;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={handleRunChecks} disabled={triggerCheck.isPending} className="gap-1.5 font-mono text-xs h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Verificar Agora</span>
            <span className="sm:hidden">Verificar</span>
          </Button>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono whitespace-nowrap ${stats.offline > 0 ? 'bg-destructive/10 text-destructive' : stats.warning > 0 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-success/10 text-success'}`}>
            <Activity className="h-3 w-3" />
            {stats.offline > 0 ? `${stats.offline} offline` : stats.warning > 0 ? `${stats.warning} atenção` : 'Tudo OK'}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
        <StatsCard title="Serviços Ativos" value={stats.online} subtitle={`de ${stats.total}${stats.warning > 0 ? ` (${stats.warning} atenção)` : ''}`} icon={CheckCircle} variant="success" />
        <StatsCard title="Alertas Ativos" value={unacknowledgedAlerts.length} subtitle="não reconhecidos" icon={AlertTriangle} variant={unacknowledgedAlerts.length > 0 ? 'warning' : 'default'} />
        <StatsCard title="Offline" value={stats.offline} subtitle="requer atenção" icon={XCircle} variant={stats.offline > 0 ? 'destructive' : 'default'} />
        <StatsCard title="SLA 24h" value={`${slaStats.sla24h}%`} subtitle="disponibilidade" icon={TrendingUp} />
        <StatsCard title="Uptime Médio" value={`${stats.avgUptime}%`} subtitle="últimas 24h" icon={Clock} />
      </div>

      {/* Critical Services Banner */}
      {criticalServices.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <h3 className="font-heading font-semibold text-sm text-destructive">Serviços em Estado Crítico</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {criticalServices.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/service/${s.id}`)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border cursor-pointer hover:border-destructive/40 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIndicator status={s.status as ServiceStatus} size="sm" />
                    <span className="font-mono text-xs truncate">{s.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {s.last_check ? `${Math.round((Date.now() - new Date(s.last_check).getTime()) / 60000)}min atrás` : '--'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="glass-card rounded-lg p-4 flex flex-col">
          <MetricsChart title="Latência Média (ms)" data={responseTimeChartData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4 flex flex-col">
          <MetricsChart title="Disponibilidade (%)" data={availabilityChartData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="glass-card rounded-lg p-4 flex flex-col">
          <CategoryBarChart title="Incidentes por Categoria" data={incidentsByCategory} />
        </div>
        <div className="glass-card rounded-lg p-4 flex flex-col">
          <MetricsChart title="Timeline de Incidentes (24h)" data={incidentTimeline} color="hsl(38, 92%, 55%)" unit="" />
        </div>
      </div>
    </div>
  );
};

export default Index;
