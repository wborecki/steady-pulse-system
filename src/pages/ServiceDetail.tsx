import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useService, useDeleteService } from '@/hooks/useServices';
import { useHealthCheckHistory, useFilteredHealthChecks, useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { AddServiceForm } from '@/components/monitoring/AddServiceForm';
import { ArrowLeft, Globe, MapPin, Clock, Activity, RefreshCw, Pencil, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

function MetricCard({ label, value, unit, color }: { label: string; value: number | string; unit: string; color: string }) {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return (
    <Card className="glass-card">
      <CardContent className="p-4 text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-heading font-bold ${color}`}>{typeof value === 'number' ? value : numVal.toFixed(1)}<span className="text-sm">{unit}</span></p>
        {!isNaN(numVal) && unit === '%' && (
          <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${numVal >= 85 ? 'bg-destructive' : numVal >= 70 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(numVal, 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const checkTypeLabels: Record<string, string> = {
  http: 'HTTP', tcp: 'TCP', process: 'Processo', sql_query: 'SQL Query',
  postgresql: 'PostgreSQL', mongodb: 'MongoDB', cloudwatch: 'CloudWatch', s3: 'S3', custom: 'Custom',
};

const periodOptions = [
  { value: '1', label: 'Última hora' },
  { value: '6', label: 'Últimas 6h' },
  { value: '24', label: 'Últimas 24h' },
  { value: '168', label: 'Últimos 7d' },
];

function isHttpType(checkType: string) {
  return ['http'].includes(checkType);
}
function isDbType(checkType: string) {
  return ['sql_query', 'postgresql', 'mongodb'].includes(checkType);
}
function isInfraType(checkType: string) {
  return ['tcp', 'process', 'cloudwatch'].includes(checkType);
}
function isAirflowType(checkType: string) {
  return checkType === 'airflow';
}

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: service, isLoading } = useService(id);
  const { data: history = [] } = useHealthCheckHistory(id, 200);
  const triggerCheck = useTriggerHealthCheck();
  const deleteService = useDeleteService();
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyPeriod, setHistoryPeriod] = useState('24');
  const [historyPage, setHistoryPage] = useState(0);

  const { data: filteredResult } = useFilteredHealthChecks(id, {
    statusFilter: historyStatus,
    periodHours: Number(historyPeriod),
    page: historyPage,
    perPage: 50,
  });
  const filteredHistory = filteredResult?.data ?? [];
  const totalChecks = filteredResult?.count ?? 0;
  const totalPages = Math.ceil(totalChecks / 50);

  // Charts based on full history
  const responseTimeData = useMemo(() => {
    return [...history].reverse().map(h => ({
      time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value: h.response_time ?? 0,
    }));
  }, [history]);

  const statusData = useMemo(() => {
    return [...history].reverse().map(h => ({
      time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value: h.status === 'online' ? 100 : h.status === 'warning' ? 50 : 0,
    }));
  }, [history]);

  // CPU/MEM/DISK historical charts
  const cpuHistory = useMemo(() => [...history].reverse().filter(h => h.cpu != null).map(h => ({
    time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    value: Number(h.cpu),
  })), [history]);

  const memHistory = useMemo(() => [...history].reverse().filter(h => h.memory != null).map(h => ({
    time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    value: Number(h.memory),
  })), [history]);

  const diskHistory = useMemo(() => [...history].reverse().filter(h => h.disk != null).map(h => ({
    time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    value: Number(h.disk),
  })), [history]);

  // HTTP-specific: status code distribution
  const statusCodeDist = useMemo(() => {
    const map = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, 'err': 0 };
    history.forEach(h => {
      if (!h.status_code) { map['err']++; return; }
      if (h.status_code < 300) map['2xx']++;
      else if (h.status_code < 400) map['3xx']++;
      else if (h.status_code < 500) map['4xx']++;
      else map['5xx']++;
    });
    return map;
  }, [history]);

  // Latency percentiles
  const latencyPercentiles = useMemo(() => {
    const sorted = history.map(h => h.response_time ?? 0).filter(Boolean).sort((a, b) => a - b);
    if (sorted.length === 0) return { p50: 0, p95: 0, p99: 0 };
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct / 100)] ?? 0;
    return { p50: p(50), p95: p(95), p99: p(99) };
  }, [history]);

  // Duration in current state
  const stateDuration = useMemo(() => {
    if (!service || history.length === 0) return '--';
    const currentStatus = service.status;
    let count = 0;
    for (const h of history) {
      if (h.status === currentStatus) count++;
      else break;
    }
    if (count === 0) return '--';
    const oldest = history[Math.min(count - 1, history.length - 1)];
    const diffMin = Math.round((Date.now() - new Date(oldest.checked_at).getTime()) / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ${diffMin % 60}min`;
    return `${Math.round(diffMin / 1440)}d`;
  }, [service, history]);

  const handleCheck = async () => {
    try {
      await triggerCheck.mutateAsync(id);
      toast.success('Health check executado!');
    } catch {
      toast.error('Erro ao executar check');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteService.mutateAsync(id!);
      toast.success('Serviço removido');
      navigate('/services');
    } catch {
      toast.error('Erro ao remover serviço');
    }
  };


  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-mono">Serviço não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const lastCheck = service.last_check ? new Date(service.last_check).toLocaleString('pt-BR') : 'Nunca';
  const checkType = service.check_type || 'http';
  const config = (service.check_config || {}) as Record<string, unknown>;

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">{service.name}</h1>
            <StatusIndicator status={service.status as any} size="lg" showLabel />
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {checkTypeLabels[checkType] || checkType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{service.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. Todos os health checks e alertas associados serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleCheck} disabled={triggerCheck.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
            Verificar Agora
          </Button>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground">
        {service.url && <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{service.url}</span>}
        {service.region && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{service.region}</span>}
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Último check: {lastCheck}</span>
        <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Uptime: {Number(service.uptime).toFixed(2)}%</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />No estado atual: {stateDuration}</span>
      </div>

      {/* Collapsible Config */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-xs font-mono text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" />
            Configuração do Serviço
            {configOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="glass-card mt-2">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div><span className="text-muted-foreground">Categoria:</span> <span className="text-foreground">{categoryLabels[service.category] || service.category}</span></div>
              <div><span className="text-muted-foreground">Tipo de Check:</span> <span className="text-foreground">{checkTypeLabels[checkType] || checkType}</span></div>
              <div><span className="text-muted-foreground">Intervalo:</span> <span className="text-foreground">{service.check_interval_seconds}s</span></div>
              <div><span className="text-muted-foreground">Habilitado:</span> <span className="text-foreground">{service.enabled ? 'Sim' : 'Não'}</span></div>
              {service.url && <div className="col-span-2"><span className="text-muted-foreground">URL:</span> <span className="text-foreground break-all">{service.url}</span></div>}
              {Object.entries(config).filter(([k]) => !['password', 'private_key', 'token'].includes(k)).map(([key, val]) => (
                <div key={key}><span className="text-muted-foreground">{key}:</span> <span className="text-foreground">{String(val)}</span></div>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Contextual Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAirflowType(checkType) ? (
          <>
            <MetricCard label="Pool Utilization" value={Number(service.cpu)} unit="%" color="text-primary" />
            <MetricCard label="DAG Success Rate" value={Number(service.memory)} unit="%" color="text-success" />
            <MetricCard label="Latência" value={service.response_time} unit="ms" color="text-warning" />
            <MetricCard label="Uptime" value={`${Number(service.uptime).toFixed(2)}`} unit="%" color="text-foreground" />
          </>
        ) : checkType === 'sql_query' ? (
          <>
            <MetricCard label="CPU" value={Number(service.cpu)} unit="%" color="text-primary" />
            <MetricCard label="Memória" value={Number(service.memory)} unit="%" color="text-success" />
            <MetricCard label="Storage" value={Number(service.disk)} unit="%" color="text-warning" />
            <MetricCard label="Conexões Ativas" value={(config._sql_details as any)?.active_connections ?? 0} unit="" color="text-foreground" />
          </>
        ) : checkType === 'postgresql' ? (
          <>
            <MetricCard label="Conexões %" value={Number(service.cpu)} unit="%" color="text-primary" />
            <MetricCard label="Cache Hit" value={Number(service.memory)} unit="%" color="text-success" />
            <MetricCard label="Latência" value={service.response_time} unit="ms" color="text-warning" />
            <MetricCard label="Uptime" value={`${Number(service.uptime).toFixed(2)}`} unit="%" color="text-foreground" />
          </>
        ) : checkType === 'mongodb' ? (
          <>
            <MetricCard label="Conexões %" value={Number(service.cpu)} unit="%" color="text-primary" />
            <MetricCard label="Memória %" value={Number(service.memory)} unit="%" color="text-success" />
            <MetricCard label="Disco %" value={Number(service.disk)} unit="%" color="text-warning" />
            <MetricCard label="Ops Ativas" value={(config._mongo_details as any)?.active_operations ?? 0} unit="" color="text-foreground" />
          </>
        ) : isHttpType(checkType) ? (
          <>
            <MetricCard label="Latência (p50)" value={latencyPercentiles.p50} unit="ms" color="text-primary" />
            <MetricCard label="Latência (p95)" value={latencyPercentiles.p95} unit="ms" color="text-warning" />
            <MetricCard label="Latência (p99)" value={latencyPercentiles.p99} unit="ms" color="text-destructive" />
            <MetricCard label="Uptime" value={`${Number(service.uptime).toFixed(2)}`} unit="%" color="text-success" />
          </>
        ) : isInfraType(checkType) ? (
          <>
            <MetricCard label="CPU" value={Number(service.cpu)} unit="%" color="text-primary" />
            <MetricCard label="Memória" value={Number(service.memory)} unit="%" color="text-success" />
            <MetricCard label="Disco" value={Number(service.disk)} unit="%" color="text-warning" />
            <MetricCard label="Latência" value={service.response_time} unit="ms" color="text-foreground" />
          </>
        ) : (
          <>
            <MetricCard label="Latência" value={service.response_time} unit="ms" color="text-primary" />
            <MetricCard label="Uptime" value={`${Number(service.uptime).toFixed(2)}`} unit="%" color="text-success" />
            <MetricCard label="CPU" value={Number(service.cpu)} unit="%" color="text-warning" />
            <MetricCard label="Memória" value={Number(service.memory)} unit="%" color="text-foreground" />
          </>
        )}
      </div>

      {/* Airflow-specific Details */}
      {isAirflowType(checkType) && (() => {
        const details = (config as any)?._airflow_details;
        if (!details) return null;
        const dags = details.dags || {};
        const runs = details.recent_runs || {};
        const scheduler = details.scheduler;
        const metadb = details.metadatabase;
        const triggerer = details.triggerer;
        return (
          <div className="space-y-4">
            {/* Scheduler / Metadatabase / Triggerer status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Scheduler', data: scheduler },
                { label: 'Metadatabase', data: metadb },
                { label: 'Triggerer', data: triggerer },
              ].map(({ label, data }) => (
                <Card key={label} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
                      {data ? (
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${data.status === 'healthy' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                          {data.status || 'unknown'}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">N/A</span>
                      )}
                    </div>
                    {data?.latest_heartbeat_received_at && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Heartbeat: {new Date(data.latest_heartbeat_received_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* DAGs summary */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">DAGs</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{dags.total ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-success">{dags.active ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Ativas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-muted-foreground">{dags.paused ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Pausadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent DAG Runs */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">DAG Runs Recentes</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-heading font-bold text-foreground">{runs.total ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-success">{runs.success ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Sucesso</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-destructive">{runs.failed ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Falhas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-primary">{runs.running ?? 0}</p>
                    <p className="text-xs font-mono text-muted-foreground">Executando</p>
                  </div>
                  <div>
                    <p className="text-2xl font-heading font-bold text-warning">{runs.success_rate ?? 0}%</p>
                    <p className="text-xs font-mono text-muted-foreground">Taxa Sucesso</p>
                  </div>
                </div>
                {/* Visual bar for success rate */}
                <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(runs.success_rate ?? 100) >= 90 ? 'bg-success' : (runs.success_rate ?? 100) >= 70 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${runs.success_rate ?? 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Import Errors & Pool */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Import Errors</p>
                  <p className={`text-3xl font-heading font-bold ${(details.import_errors ?? 0) > 0 ? 'text-destructive' : 'text-success'}`}>
                    {details.import_errors ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">API Version</p>
                  <p className="text-3xl font-heading font-bold text-primary">{details.api_version || 'N/A'}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Azure SQL Details */}
      {checkType === 'sql_query' && (() => {
        const details = (config as any)?._sql_details;
        if (!details) return null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="IO Data" value={details.avg_data_io_percent ?? 0} unit="%" color="text-primary" />
              <MetricCard label="Log Write" value={details.avg_log_write_percent ?? 0} unit="%" color="text-warning" />
              <MetricCard label="Workers" value={details.max_worker_percent ?? 0} unit="%" color="text-success" />
              <MetricCard label="Sessions" value={details.max_session_percent ?? 0} unit="%" color="text-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Conexões</h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-heading font-bold text-primary">{details.active_connections ?? 0}</p>
                      <p className="text-xs font-mono text-muted-foreground">Ativas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-bold text-foreground">{details.total_sessions ?? 0}</p>
                      <p className="text-xs font-mono text-muted-foreground">Total Sessões</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Storage</h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-heading font-bold text-warning">{details.used_mb ?? 0}</p>
                      <p className="text-xs font-mono text-muted-foreground">Usado (MB)</p>
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-bold text-foreground">{details.allocated_mb ?? 0}</p>
                      <p className="text-xs font-mono text-muted-foreground">Alocado (MB)</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-warning" style={{ width: `${details.allocated_mb ? Math.round((details.used_mb / details.allocated_mb) * 100) : 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            </div>
            {details.top_waits?.length > 0 && (
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Top 5 Waits</h3>
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="p-2 text-left">Wait Type</th>
                        <th className="p-2 text-right">Count</th>
                        <th className="p-2 text-right">Time (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.top_waits.map((w: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2 text-xs">{w.wait_type}</td>
                          <td className="p-2 text-right">{w.waiting_tasks_count?.toLocaleString()}</td>
                          <td className="p-2 text-right">{w.wait_time_ms?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* PostgreSQL Details */}
      {checkType === 'postgresql' && (() => {
        const details = (config as any)?._pg_details;
        if (!details) return null;
        const conns = details.connections || {};
        const tx = details.transactions || {};
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Cache Hit Ratio" value={details.cache_hit_ratio ?? 0} unit="%" color="text-success" />
              <MetricCard label="Repl. Lag" value={details.replication_lag_seconds ?? 0} unit="s" color="text-warning" />
              <MetricCard label="Conexões Ativas" value={conns.active ?? 0} unit="" color="text-primary" />
              <MetricCard label="DB Size" value={details.db_size || '0'} unit="" color="text-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Conexões</h3>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Total', value: conns.total, color: 'text-foreground' },
                      { label: 'Ativas', value: conns.active, color: 'text-primary' },
                      { label: 'Idle', value: conns.idle, color: 'text-muted-foreground' },
                      { label: 'Waiting', value: conns.waiting, color: 'text-warning' },
                    ].map(c => (
                      <div key={c.label}>
                        <p className={`text-xl font-heading font-bold ${c.color}`}>{c.value ?? 0}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{c.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Transações</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-heading font-bold text-success">{Number(tx.xact_commit ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Commits</p>
                    </div>
                    <div>
                      <p className="text-xl font-heading font-bold text-destructive">{Number(tx.xact_rollback ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Rollbacks</p>
                    </div>
                    <div>
                      <p className="text-xl font-heading font-bold text-warning">{Number(tx.deadlocks ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Deadlocks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {details.top_tables?.length > 0 && (
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Top Tables</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs">
                          <th className="p-2 text-left">Tabela</th>
                          <th className="p-2 text-right">Tamanho</th>
                          <th className="p-2 text-right">Rows</th>
                          <th className="p-2 text-right">Dead Tuples</th>
                          <th className="p-2 text-right">Bloat %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.top_tables.map((t: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="p-2 text-xs">{t.schemaname}.{t.relname}</td>
                            <td className="p-2 text-right text-xs">{t.total_size}</td>
                            <td className="p-2 text-right">{Number(t.row_count ?? 0).toLocaleString()}</td>
                            <td className="p-2 text-right">{Number(t.dead_tuples ?? 0).toLocaleString()}</td>
                            <td className="p-2 text-right">{t.bloat_percent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">Tuplas</h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: 'Returned', value: tx.tup_returned },
                    { label: 'Fetched', value: tx.tup_fetched },
                    { label: 'Inserted', value: tx.tup_inserted },
                    { label: 'Updated', value: tx.tup_updated },
                    { label: 'Deleted', value: tx.tup_deleted },
                  ].map(t => (
                    <div key={t.label}>
                      <p className="text-lg font-heading font-bold text-foreground">{Number(t.value ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{t.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* MongoDB Details */}
      {checkType === 'mongodb' && (() => {
        const details = (config as any)?._mongo_details;
        if (!details) return null;
        const conns = details.connections || {};
        const mem = details.memory || {};
        const ops = details.opcounters || {};
        const net = details.network || {};
        const dbStats = details.db_stats || {};
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Conexões</h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-heading font-bold text-primary">{conns.current ?? 0}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Current</p>
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-bold text-foreground">{conns.available ?? 0}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Memória</h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-heading font-bold text-success">{mem.resident_mb ?? 0}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Resident MB</p>
                    </div>
                    <div>
                      <p className="text-2xl font-heading font-bold text-foreground">{mem.virtual_mb ?? 0}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Virtual MB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Ops Ativas</p>
                  <p className="text-3xl font-heading font-bold text-warning">{details.active_operations ?? 0}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Uptime: {details.uptime_seconds ? `${Math.round(details.uptime_seconds / 3600)}h` : 'N/A'}</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">DB Stats ({dbStats.db || 'N/A'})</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Collections', value: dbStats.collections },
                      { label: 'Objects', value: dbStats.objects },
                      { label: 'Indexes', value: dbStats.indexes },
                      { label: 'Data (MB)', value: dbStats.data_size_mb },
                      { label: 'Storage (MB)', value: dbStats.storage_size_mb },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-xl font-heading font-bold text-foreground">{Number(s.value ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold text-sm mb-3">Opcounters</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Insert', value: ops.insert },
                      { label: 'Query', value: ops.query },
                      { label: 'Update', value: ops.update },
                      { label: 'Delete', value: ops.delete },
                      { label: 'Getmore', value: ops.getmore },
                      { label: 'Command', value: ops.command },
                    ].map(o => (
                      <div key={o.label}>
                        <p className="text-lg font-heading font-bold text-foreground">{Number(o.value ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{o.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">Network</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xl font-heading font-bold text-primary">{net.bytes_in ? `${(net.bytes_in / 1024 / 1024).toFixed(1)}` : '0'}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Bytes In (MB)</p>
                  </div>
                  <div>
                    <p className="text-xl font-heading font-bold text-success">{net.bytes_out ? `${(net.bytes_out / 1024 / 1024).toFixed(1)}` : '0'}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Bytes Out (MB)</p>
                  </div>
                  <div>
                    <p className="text-xl font-heading font-bold text-foreground">{Number(net.num_requests ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* HTTP-specific: Status Code Distribution */}
      {isHttpType(checkType) && history.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Distribuição de Status Codes</h3>
            <div className="flex items-end gap-3 h-24">
              {Object.entries(statusCodeDist).map(([code, count]) => {
                const max = Math.max(...Object.values(statusCodeDist), 1);
                const pct = (count / max) * 100;
                const colors: Record<string, string> = {
                  '2xx': 'bg-success', '3xx': 'bg-primary', '4xx': 'bg-warning', '5xx': 'bg-destructive', 'err': 'bg-muted-foreground',
                };
                return (
                  <div key={code} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-mono text-muted-foreground">{count}</span>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(pct, 4)}%` }}>
                      <div className={`w-full h-full rounded-t ${colors[code] || 'bg-secondary'}`} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{code}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Latência (ms)" data={responseTimeData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Disponibilidade (%)" data={statusData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
      </div>

      {/* Resource History Charts */}
      {(isInfraType(checkType) || isAirflowType(checkType) || cpuHistory.length > 0) && (
        <div className={`grid grid-cols-1 gap-4 ${isAirflowType(checkType) ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {cpuHistory.length > 0 && (
            <div className="glass-card rounded-lg p-4">
              <MetricsChart title={isAirflowType(checkType) ? "Pool Utilization (%)" : checkType === 'postgresql' ? "Conexões (%)" : checkType === 'mongodb' ? "Conexões (%)" : "CPU (%)"} data={cpuHistory} color="hsl(175, 80%, 50%)" unit="%" />
            </div>
          )}
          {memHistory.length > 0 && (
            <div className="glass-card rounded-lg p-4">
              <MetricsChart title={isAirflowType(checkType) ? "DAG Success Rate (%)" : checkType === 'postgresql' ? "Cache Hit Ratio (%)" : checkType === 'mongodb' ? "Memória (%)" : "Memória (%)"} data={memHistory} color="hsl(145, 65%, 45%)" unit="%" />
            </div>
          )}
          {diskHistory.length > 0 && !isAirflowType(checkType) && (
            <div className="glass-card rounded-lg p-4">
              <MetricsChart title={checkType === 'sql_query' ? "Storage (%)" : checkType === 'mongodb' ? "Disco (%)" : "Disco (%)"} data={diskHistory} color="hsl(38, 92%, 55%)" unit="%" />
            </div>
          )}
        </div>
      )}

      {/* Health Check History with Filters & Pagination */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-heading font-semibold text-lg">Histórico de Checks</h2>
          <div className="flex items-center gap-2">
            <Select value={historyStatus} onValueChange={v => { setHistoryStatus(v); setHistoryPage(0); }}>
              <SelectTrigger className="w-32 h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyPeriod} onValueChange={v => { setHistoryPeriod(v); setHistoryPage(0); }}>
              <SelectTrigger className="w-32 h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-mono text-muted-foreground">{totalChecks} registros</span>
          </div>
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="p-3 text-left">Horário</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Latência</th>
                {isHttpType(checkType) && <th className="p-3 text-left">HTTP</th>}
                {(isInfraType(checkType) || isDbType(checkType)) && <>
                  <th className="p-3 text-left">{isDbType(checkType) ? 'CPU/Conn' : 'CPU'}</th>
                  <th className="p-3 text-left">{isDbType(checkType) ? 'Cache/Mem' : 'MEM'}</th>
                </>}
                {isAirflowType(checkType) && <>
                  <th className="p-3 text-left">Pool</th>
                  <th className="p-3 text-left">Success</th>
                </>}
                <th className="p-3 text-left">Erro</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((h, i) => {
                const isError = h.status === 'offline';
                return (
                  <tr key={h.id} className={`border-b border-border/50 ${isError ? 'bg-destructive/5' : ''}`}>
                    <td className="p-3 text-xs">{new Date(h.checked_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><StatusIndicator status={h.status as any} size="sm" showLabel /></td>
                    <td className="p-3">{h.response_time}ms</td>
                    {isHttpType(checkType) && <td className="p-3">{h.status_code || '-'}</td>}
                    {(isInfraType(checkType) || isDbType(checkType)) && <>
                      <td className="p-3">{h.cpu != null ? `${Number(h.cpu).toFixed(1)}%` : '-'}</td>
                      <td className="p-3">{h.memory != null ? `${Number(h.memory).toFixed(1)}%` : '-'}</td>
                    </>}
                    {isAirflowType(checkType) && <>
                      <td className="p-3">{h.cpu != null ? `${Number(h.cpu).toFixed(1)}%` : '-'}</td>
                      <td className="p-3">{h.memory != null ? `${Number(h.memory).toFixed(1)}%` : '-'}</td>
                    </>}
                    <td className="p-3 text-xs text-destructive truncate max-w-[200px]">{h.error_message || '-'}</td>
                  </tr>
                );
              })}
              {filteredHistory.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={historyPage === 0} onClick={() => setHistoryPage(p => p - 1)} className="text-xs">
              Anterior
            </Button>
            <span className="text-xs font-mono text-muted-foreground">
              Página {historyPage + 1} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={historyPage >= totalPages - 1} onClick={() => setHistoryPage(p => p + 1)} className="text-xs">
              Próxima
            </Button>
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">Editar Serviço</SheetTitle>
          </SheetHeader>
          <AddServiceForm
            mode="edit"
            initialData={{
              id: service.id,
              name: service.name,
              category: service.category,
              check_type: service.check_type,
              url: service.url,
              description: service.description,
              check_config: service.check_config as Record<string, unknown>,
              check_interval_seconds: service.check_interval_seconds,
            }}
            onSuccess={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ServiceDetail;
