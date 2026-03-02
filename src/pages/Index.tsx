import { useMemo, useState } from 'react';
import { useServices } from '@/hooks/useServices';
import { useAlerts, useAcknowledgeAlert } from '@/hooks/useAlerts';
import { useTriggerHealthCheck, useAllRecentHealthChecks } from '@/hooks/useHealthChecks';
import { StatsCard } from '@/components/monitoring/StatsCard';
import { ServiceRow } from '@/components/monitoring/ServiceRow';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, TrendingUp, Zap, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';

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

  // SLA calculations from health checks
  const slaStats = useMemo(() => {
    if (recentChecks.length === 0) return { sla24h: '0', sla7d: '--', sla30d: '--' };
    const now = Date.now();
    const checks24h = recentChecks.filter(c => new Date(c.checked_at).getTime() > now - 24 * 3600000);
    const online24h = checks24h.filter(c => c.status === 'online').length;
    const sla24h = checks24h.length > 0 ? ((online24h / checks24h.length) * 100).toFixed(2) : '0';
    return { sla24h, sla7d: '--', sla30d: '--' };
  }, [recentChecks]);

  // Critical services (offline or warning)
  const criticalServices = useMemo(() => {
    return services
      .filter(s => s.status === 'offline' || s.status === 'warning')
      .sort((a, b) => (a.status === 'offline' ? -1 : 1));
  }, [services]);

  // Top 5 latency
  const topLatency = useMemo(() => {
    return [...services].sort((a, b) => b.response_time - a.response_time).slice(0, 5);
  }, [services]);

  // Incidents by category
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

  // Incident timeline (last 24h grouped by hour)
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

      {/* Stats Cards with SLA */}
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

      {/* Charts Row 1: Latency + Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Latência Média (ms)" data={responseTimeChartData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Disponibilidade (%)" data={availabilityChartData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
      </div>

      {/* Charts Row 2: Incidents by Category + Incident Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Incidentes por Categoria" data={incidentsByCategory} color="hsl(0, 72%, 55%)" unit="" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Timeline de Incidentes (24h)" data={incidentTimeline} color="hsl(38, 92%, 55%)" unit="" />
        </div>
      </div>

      {/* Top 5 Latency + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Latency */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <h2 className="font-heading font-semibold text-lg">Top 5 Latência</h2>
          </div>
          <div className="space-y-2">
            {topLatency.map((s, i) => (
              <Card
                key={s.id}
                className="glass-card p-3 cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => navigate(`/service/${s.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                    <StatusIndicator status={s.status as any} size="sm" />
                    <span className="text-sm font-mono truncate">{s.name}</span>
                  </div>
                  <span className={`text-sm font-heading font-bold ${s.response_time > 1000 ? 'text-destructive' : s.response_time > 500 ? 'text-warning' : 'text-foreground'}`}>
                    {s.response_time}ms
                  </span>
                </div>
              </Card>
            ))}
            {topLatency.length === 0 && (
              <p className="text-center py-4 text-muted-foreground font-mono text-xs">Nenhum serviço</p>
            )}
          </div>
        </div>

        {/* Services List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-lg">Serviços</h2>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono transition-all ${
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
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredServices.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-mono text-sm">Nenhum serviço cadastrado.</p>
            ) : (
              filteredServices.map(service => (
                <ServiceRow key={service.id} service={service} onClick={() => navigate(`/service/${service.id}`)} />
              ))
            )}
          </div>
        </div>

        {/* Alerts */}
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
