import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';
import { useAlerts } from '@/hooks/useAlerts';
import { useTriggerHealthCheck, useAllRecentHealthChecks } from '@/hooks/useHealthChecks';
import { StatsCard } from '@/components/monitoring/StatsCard';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, TrendingUp, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const Index = () => {
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const { data: alertResult } = useAlerts();
  const alerts = alertResult?.data ?? [];
  const { data: recentChecks = [] } = useAllRecentHealthChecks();
  const triggerCheck = useTriggerHealthCheck();

  const stats = useMemo(() => {
    const online = services.filter(s => s.status === 'online').length;
    const offline = services.filter(s => s.status === 'offline').length;
    const warning = services.filter(s => s.status === 'warning').length;
    const avgUptime = services.length > 0
      ? (services.reduce((a, s) => a + Number(s.uptime), 0) / services.length).toFixed(2)
      : '0';
    return { online, offline, warning, total: services.length, avgUptime };
  }, [services]);

  const slaStats = useMemo(() => {
    if (recentChecks.length === 0) return { sla24h: '0' };
    const now = Date.now();
    const checks24h = recentChecks.filter(c => new Date(c.checked_at).getTime() > now - 24 * 3600000);
    const online24h = checks24h.filter(c => c.status === 'online').length;
    const sla24h = checks24h.length > 0 ? ((online24h / checks24h.length) * 100).toFixed(2) : '0';
    return { sla24h };
  }, [recentChecks]);

  const criticalServices = useMemo(() => {
    return services
      .filter(s => s.status === 'offline' || s.status === 'warning')
      .sort((a, b) => (a.status === 'offline' ? -1 : 1));
  }, [services]);

  const incidentsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    recentChecks.forEach(c => {
      if (c.status !== 'online') {
        const svc = services.find(s => s.id === c.service_id);
        if (svc) {
          const cat = svc.category;
          map.set(cat, (map.get(cat) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ time: categoryLabels[cat] || cat, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [recentChecks, services]);

  const incidentTimeline = useMemo(() => {
    const byHour = new Map<string, number>();
    recentChecks.forEach(c => {
      if (c.status !== 'online') {
        const hour = new Date(c.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        byHour.set(hour, (byHour.get(hour) || 0) + 1);
      }
    });
    return Array.from(byHour.entries()).map(([time, value]) => ({ time, value }));
  }, [recentChecks]);

  const responseTimeChartData = useMemo(() => {
    const byHour = new Map<string, { total: number; count: number }>();
    recentChecks.forEach(h => {
      const time = new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const entry = byHour.get(time) || { total: 0, count: 0 };
      entry.total += (h.response_time ?? 0);
      entry.count++;
      byHour.set(time, entry);
    });
    return Array.from(byHour.entries()).map(([time, { total, count }]) => ({
      time, value: Math.round(total / count),
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
      time, value: Math.round((online / total) * 100),
    }));
  }, [recentChecks]);

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
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      {/* Header */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Serviços Online" value={stats.online} subtitle={`de ${stats.total} serviços`} icon={CheckCircle} variant="success" />
        <StatsCard title="Alertas Ativos" value={unacknowledgedAlerts.length} subtitle="não reconhecidos" icon={AlertTriangle} variant={unacknowledgedAlerts.length > 0 ? 'warning' : 'default'} />
        <StatsCard title="Serviços Offline" value={stats.offline} subtitle="requer atenção" icon={XCircle} variant={stats.offline > 0 ? 'destructive' : 'default'} />
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
                    <StatusIndicator status={s.status as any} size="sm" />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Latência Média (ms)" data={responseTimeChartData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Disponibilidade (%)" data={availabilityChartData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Incidentes por Categoria" data={incidentsByCategory} color="hsl(0, 72%, 55%)" unit="" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Timeline de Incidentes (24h)" data={incidentTimeline} color="hsl(38, 92%, 55%)" unit="" />
        </div>
      </div>
    </div>
  );
};

export default Index;
