import { useMemo, useState } from 'react';
import { useServices } from '@/hooks/useServices';
import { useHealthChecksForPeriod } from '@/hooks/useHealthChecks';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Timer, ShieldCheck } from 'lucide-react';

const Reports = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(7);
  const { data: services = [] } = useServices();
  const { data: checks = [], isLoading } = useHealthChecksForPeriod(period);

  // Uptime ranking per service
  const uptimeRanking = useMemo(() => {
    const map = new Map<string, { online: number; total: number }>();
    checks.forEach(c => {
      const entry = map.get(c.service_id) || { online: 0, total: 0 };
      if (c.status === 'online') entry.online++;
      entry.total++;
      map.set(c.service_id, entry);
    });
    return services
      .map(s => {
        const stats = map.get(s.id);
        const uptime = stats && stats.total > 0 ? (stats.online / stats.total) * 100 : 0;
        return { ...s, calculatedUptime: uptime, totalChecks: stats?.total || 0 };
      })
      .sort((a, b) => a.calculatedUptime - b.calculatedUptime);
  }, [checks, services]);

  // MTTR & MTBF per service
  const reliabilityMetrics = useMemo(() => {
    const result: Record<string, { mttr: number; mtbf: number; incidents: number }> = {};
    
    services.forEach(s => {
      const svcChecks = checks.filter(c => c.service_id === s.id).sort((a, b) => 
        new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
      );
      
      if (svcChecks.length < 2) {
        result[s.id] = { mttr: 0, mtbf: 0, incidents: 0 };
        return;
      }

      let incidents = 0;
      let totalDowntime = 0;
      let totalUptime = 0;
      let downStart: number | null = null;
      let upStart: number | null = null;

      svcChecks.forEach((c, i) => {
        const t = new Date(c.checked_at).getTime();
        if (c.status !== 'online') {
          if (downStart === null) {
            downStart = t;
            incidents++;
            if (upStart !== null) {
              totalUptime += t - upStart;
              upStart = null;
            }
          }
        } else {
          if (downStart !== null) {
            totalDowntime += t - downStart;
            downStart = null;
          }
          if (upStart === null) upStart = t;
        }
      });

      const mttr = incidents > 0 ? totalDowntime / incidents / 60000 : 0; // minutes
      const mtbf = incidents > 1 ? totalUptime / (incidents - 1) / 3600000 : 0; // hours

      result[s.id] = { mttr: Math.round(mttr), mtbf: Math.round(mtbf * 10) / 10, incidents };
    });

    return result;
  }, [checks, services]);

  // Latency trend per service (avg first half vs second half)
  const latencyTrends = useMemo(() => {
    return services.map(s => {
      const svcChecks = checks.filter(c => c.service_id === s.id);
      if (svcChecks.length < 4) return { ...s, trend: 0, avgLatency: s.response_time };
      const mid = Math.floor(svcChecks.length / 2);
      const firstHalf = svcChecks.slice(0, mid);
      const secondHalf = svcChecks.slice(mid);
      const avgFirst = firstHalf.reduce((a, c) => a + (c.response_time ?? 0), 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, c) => a + (c.response_time ?? 0), 0) / secondHalf.length;
      const trend = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
      return { ...s, trend: Math.round(trend), avgLatency: Math.round(avgSecond) };
    }).sort((a, b) => b.trend - a.trend);
  }, [checks, services]);

  // Uptime heatmap data: per service per day
  const heatmapData = useMemo(() => {
    const days: string[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }

    return services.map(s => {
      const svcChecks = checks.filter(c => c.service_id === s.id);
      const dayMap = new Map<string, { online: number; total: number }>();
      svcChecks.forEach(c => {
        const day = new Date(c.checked_at).toISOString().slice(0, 10);
        const entry = dayMap.get(day) || { online: 0, total: 0 };
        if (c.status === 'online') entry.online++;
        entry.total++;
        dayMap.set(day, entry);
      });

      return {
        service: s,
        days: days.map(day => {
          const entry = dayMap.get(day);
          if (!entry || entry.total === 0) return { day, uptime: -1 }; // no data
          return { day, uptime: (entry.online / entry.total) * 100 };
        }),
      };
    });
  }, [checks, services, period]);

  function uptimeColor(pct: number): string {
    if (pct < 0) return 'bg-muted';
    if (pct >= 99.5) return 'bg-success';
    if (pct >= 95) return 'bg-success/60';
    if (pct >= 90) return 'bg-warning';
    if (pct >= 80) return 'bg-warning/60';
    return 'bg-destructive';
  }

  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground font-mono">Análise de confiabilidade e tendências</p>
        </div>
        <Select value={String(period)} onValueChange={v => setPeriod(Number(v))}>
          <SelectTrigger className="w-40 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Uptime Heatmap */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Heatmap de Disponibilidade</h2>
        </div>
        <Card className="glass-card overflow-x-auto">
          <CardContent className="p-4">
            {heatmapData.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground font-mono text-xs">Nenhum serviço cadastrado</p>
            ) : (
              <div className="min-w-[600px]">
                {/* Day headers */}
                <div className="flex items-center gap-0.5 mb-1 ml-40">
                  {heatmapData[0]?.days.map(d => (
                    <div key={d.day} className="flex-1 text-[8px] font-mono text-muted-foreground text-center">
                      {new Date(d.day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {heatmapData.map(row => (
                  <div key={row.service.id} className="flex items-center gap-0.5 mb-0.5">
                    <div
                      className="w-40 text-xs font-mono text-muted-foreground truncate pr-2 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => navigate(`/service/${row.service.id}`)}
                    >
                      {row.service.name}
                    </div>
                    {row.days.map(d => (
                      <div
                        key={d.day}
                        className={`flex-1 h-5 rounded-sm ${uptimeColor(d.uptime)} transition-all`}
                        title={`${row.service.name} - ${new Date(d.day + 'T12:00:00').toLocaleDateString('pt-BR')}: ${d.uptime >= 0 ? d.uptime.toFixed(1) + '%' : 'Sem dados'}`}
                      />
                    ))}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-muted-foreground">
                  <span>Legenda:</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-success" /> ≥99.5%</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-success/60" /> ≥95%</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-warning" /> ≥90%</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-warning/60" /> ≥80%</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-destructive" /> {'<80%'}</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted" /> Sem dados</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MTTR / MTBF / Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Reliability Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">MTTR & MTBF</h2>
          </div>
          <Card className="glass-card">
            <CardContent className="p-0">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-left">Serviço</th>
                    <th className="px-4 py-3 text-right w-24">Incidentes</th>
                    <th className="px-4 py-3 text-right w-20" title="Tempo Médio de Recuperação">MTTR</th>
                    <th className="px-4 py-3 text-right w-20" title="Tempo Médio Entre Falhas">MTBF</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => {
                    const m = reliabilityMetrics[s.id] || { mttr: 0, mtbf: 0, incidents: 0 };
                    return (
                      <tr key={s.id} className="border-b border-border/50 cursor-pointer hover:bg-secondary/50" onClick={() => navigate(`/service/${s.id}`)}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <StatusIndicator status={s.status as any} size="sm" />
                            <span className="truncate">{s.name}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-2.5 text-right ${m.incidents > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{m.incidents}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{m.mttr > 0 ? `${m.mttr}min` : '--'}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{m.mtbf > 0 ? `${m.mtbf}h` : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Uptime Ranking */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">Ranking de Disponibilidade</h2>
          </div>
          <Card className="glass-card">
            <CardContent className="p-0">
              {uptimeRanking.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground font-mono text-xs">Sem dados</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {uptimeRanking.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/service/${s.id}`)}
                    >
                      <span className={`text-xs font-mono w-8 text-right shrink-0 ${i < 3 && uptimeRanking.length > 3 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        #{uptimeRanking.length - i}
                      </span>
                      <StatusIndicator status={s.status as any} size="sm" />
                      <span className="text-xs font-mono flex-1 truncate min-w-0">{s.name}</span>
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${s.calculatedUptime >= 99 ? 'bg-success' : s.calculatedUptime >= 95 ? 'bg-warning' : 'bg-destructive'}`}
                          style={{ width: `${s.calculatedUptime}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-16 text-right font-bold shrink-0 ${s.calculatedUptime >= 99 ? 'text-success' : s.calculatedUptime >= 95 ? 'text-warning' : 'text-destructive'}`}>
                        {s.calculatedUptime.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Latency Trends */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Tendência de Latência</h2>
        </div>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {latencyTrends.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/60 transition-all"
                  onClick={() => navigate(`/service/${s.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono truncate">{s.name}</p>
                    <p className="text-lg font-heading font-bold">{s.avgLatency}ms</p>
                  </div>
                  <div className={`text-sm font-heading font-bold ${s.trend > 10 ? 'text-destructive' : s.trend < -10 ? 'text-success' : 'text-muted-foreground'}`}>
                    {s.trend > 0 ? '+' : ''}{s.trend}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
