import { useMemo, useState, useCallback } from 'react';
import { useServices } from '@/hooks/useServices';
import { PageLoader } from '@/components/PageLoader';
import { useHealthChecksForPeriod, type ReportHealthCheck } from '@/hooks/useHealthChecks';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { type ServiceStatus } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Timer, ShieldCheck, Download } from 'lucide-react';
import { toast } from 'sonner';

const Reports = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(7);
  const { data: services = [] } = useServices();
  const { data: checks = [], isLoading } = useHealthChecksForPeriod(period);

  // Group checks by service_id once, then compute all metrics in a single pass
  const { uptimeRanking, reliabilityMetrics, latencyTrends } = useMemo(() => {
    // 1) Group checks by service_id (already sorted by checked_at from query)
    const grouped = new Map<string, ReportHealthCheck[]>();
    for (const c of checks) {
      let arr = grouped.get(c.service_id);
      if (!arr) { arr = []; grouped.set(c.service_id, arr); }
      arr.push(c);
    }

    // 2) Uptime ranking
    const ranking = services.map(s => {
      const svcChecks = grouped.get(s.id);
      if (!svcChecks || svcChecks.length === 0) return { ...s, calculatedUptime: 0, totalChecks: 0 };
      let online = 0;
      for (const c of svcChecks) { if (c.status === 'online' || c.status === 'warning') online++; }
      return { ...s, calculatedUptime: (online / svcChecks.length) * 100, totalChecks: svcChecks.length };
    }).sort((a, b) => a.calculatedUptime - b.calculatedUptime);

    // 3) MTTR & MTBF
    const reliability: Record<string, { mttr: number; mtbf: number; incidents: number }> = {};
    for (const s of services) {
      const svcChecks = grouped.get(s.id);
      if (!svcChecks || svcChecks.length < 2) {
        reliability[s.id] = { mttr: 0, mtbf: 0, incidents: 0 };
        continue;
      }
      let incidents = 0, totalDowntime = 0, totalUptime = 0;
      let downStart: number | null = null, upStart: number | null = null;
      for (const c of svcChecks) {
        const t = new Date(c.checked_at).getTime();
        if (c.status !== 'online' && c.status !== 'warning') {
          if (downStart === null) {
            downStart = t;
            incidents++;
            if (upStart !== null) { totalUptime += t - upStart; upStart = null; }
          }
        } else {
          if (downStart !== null) { totalDowntime += t - downStart; downStart = null; }
          if (upStart === null) upStart = t;
        }
      }
      const mttr = incidents > 0 ? totalDowntime / incidents / 60000 : 0;
      const mtbf = incidents > 1 ? totalUptime / (incidents - 1) / 3600000 : 0;
      reliability[s.id] = { mttr: Math.round(mttr), mtbf: Math.round(mtbf * 10) / 10, incidents };
    }

    // 4) Latency trends
    const trends = services.map(s => {
      const svcChecks = grouped.get(s.id);
      if (!svcChecks || svcChecks.length < 4) return { ...s, trend: 0, avgLatency: s.response_time };
      const mid = svcChecks.length >> 1;
      let sumFirst = 0, sumSecond = 0;
      for (let i = 0; i < mid; i++) sumFirst += svcChecks[i].response_time ?? 0;
      for (let i = mid; i < svcChecks.length; i++) sumSecond += svcChecks[i].response_time ?? 0;
      const avgFirst = sumFirst / mid;
      const avgSecond = sumSecond / (svcChecks.length - mid);
      const trend = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
      return { ...s, trend: Math.round(trend), avgLatency: Math.round(avgSecond) };
    }).sort((a, b) => b.trend - a.trend);

    return { uptimeRanking: ranking, reliabilityMetrics: reliability, latencyTrends: trends };
  }, [checks, services]);

  // Format date as YYYY-MM-DD in local timezone
  const toLocalDay = useCallback((date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Uptime heatmap data: per service per day
  const heatmapData = useMemo(() => {
    const days: string[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(toLocalDay(d));
    }

    // Pre-build day map for all checks grouped by service+day in a single pass
    const svcDayMap = new Map<string, Map<string, { online: number; total: number }>>();
    for (const c of checks) {
      let dayMap = svcDayMap.get(c.service_id);
      if (!dayMap) { dayMap = new Map(); svcDayMap.set(c.service_id, dayMap); }
      const day = toLocalDay(new Date(c.checked_at));
      let entry = dayMap.get(day);
      if (!entry) { entry = { online: 0, total: 0 }; dayMap.set(day, entry); }
      if (c.status === 'online' || c.status === 'warning') entry.online++;
      entry.total++;
    }

    return services.map(s => {
      const dayMap = svcDayMap.get(s.id);
      return {
        service: s,
        days: days.map(day => {
          const entry = dayMap?.get(day);
          if (!entry || entry.total === 0) return { day, uptime: -1 };
          return { day, uptime: (entry.online / entry.total) * 100 };
        }),
      };
    });
  }, [checks, services, period, toLocalDay]);

  function uptimeColor(pct: number): string {
    if (pct < 0) return 'bg-muted';
    if (pct >= 99.5) return 'bg-success';
    if (pct >= 95) return 'bg-success/60';
    if (pct >= 90) return 'bg-warning';
    if (pct >= 80) return 'bg-warning/60';
    return 'bg-destructive';
  }

  const exportCsv = useCallback(() => {
    const rows = [['Serviço', 'Status', 'Uptime %', 'Incidentes', 'MTTR (min)', 'MTBF (h)', 'Latência Média (ms)', 'Tendência %']];
    services.forEach(s => {
      const m = reliabilityMetrics[s.id] || { mttr: 0, mtbf: 0, incidents: 0 };
      const lt = latencyTrends.find(l => l.id === s.id);
      const ur = uptimeRanking.find(u => u.id === s.id);
      rows.push([
        s.name, s.status, (ur?.calculatedUptime ?? 0).toFixed(2),
        String(m.incidents), String(m.mttr), String(m.mtbf),
        String(lt?.avgLatency ?? s.response_time), String(lt?.trend ?? 0),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-monitorhub-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  }, [services, reliabilityMetrics, latencyTrends, uptimeRanking]);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground font-mono">Análise de confiabilidade e tendências</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
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
                <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] font-mono text-muted-foreground">
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* Reliability Metrics */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">MTTR & MTBF</h2>
          </div>
          <Card className="glass-card flex-1">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs font-mono table-fixed min-w-[360px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-3 text-left">Serviço</th>
                    <th className="px-2 py-3 text-right w-20">Incidentes</th>
                    <th className="px-2 py-3 text-right w-16" title="Tempo Médio de Recuperação">MTTR</th>
                    <th className="px-2 py-3 text-right w-16" title="Tempo Médio Entre Falhas">MTBF</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => {
                    const m = reliabilityMetrics[s.id] || { mttr: 0, mtbf: 0, incidents: 0 };
                    return (
                      <tr key={s.id} className="border-b border-border/50 cursor-pointer hover:bg-secondary/50" onClick={() => navigate(`/service/${s.id}`)}>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusIndicator status={s.status as ServiceStatus} size="sm" />
                            <span className="truncate block">{s.name}</span>
                          </div>
                        </td>
                        <td className={`px-2 py-2.5 text-right w-20 ${m.incidents > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{m.incidents}</td>
                        <td className="px-2 py-2.5 text-right w-16 text-muted-foreground">{m.mttr > 0 ? `${m.mttr}min` : '--'}</td>
                        <td className="px-2 py-2.5 text-right w-16 text-muted-foreground">{m.mtbf > 0 ? `${m.mtbf}h` : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Uptime Ranking */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">Ranking de Disponibilidade</h2>
          </div>
          <Card className="glass-card flex-1">
            <CardContent className="p-0">
              {uptimeRanking.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground font-mono text-xs">Sem dados</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {uptimeRanking.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/service/${s.id}`)}
                    >
                      <span className={`text-xs font-mono w-6 text-right shrink-0 ${i < 3 && uptimeRanking.length > 3 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        #{uptimeRanking.length - i}
                      </span>
                      <StatusIndicator status={s.status as ServiceStatus} size="sm" />
                      <span className="text-xs font-mono flex-1 truncate min-w-0">{s.name}</span>
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${s.calculatedUptime >= 99 ? 'bg-success' : s.calculatedUptime >= 95 ? 'bg-warning' : 'bg-destructive'}`}
                          style={{ width: `${s.calculatedUptime}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-14 text-right font-bold shrink-0 ${s.calculatedUptime >= 99 ? 'text-success' : s.calculatedUptime >= 95 ? 'text-warning' : 'text-destructive'}`}>
                        {s.calculatedUptime.toFixed(1)}%
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
