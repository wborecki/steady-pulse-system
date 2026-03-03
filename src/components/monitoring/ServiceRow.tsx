import { StatusIndicator } from './StatusIndicator';
import { type ServiceStatus } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Cloud, Database, Wind, Server, Cog, Globe, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

const categoryIconMap: Record<string, React.ElementType> = {
  aws: Cloud, database: Database, airflow: Wind,
  server: Server, process: Cog, api: Globe,
};

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const statusLabels: Record<string, string> = {
  online: 'Online', offline: 'Offline', warning: 'Atenção', maintenance: 'Manutenção',
};

const checkTypeLabels: Record<string, string> = {
  http: 'HTTP', tcp: 'TCP', process: 'Processo', sql_query: 'SQL',
  postgresql: 'PostgreSQL', mongodb: 'MongoDB', cloudwatch: 'CloudWatch', s3: 'S3',
  custom: 'Custom', server: 'Servidor', systemctl: 'Systemctl', container: 'Container',
  airflow: 'Airflow', lambda: 'Lambda', ecs: 'ECS', cloudwatch_alarms: 'CW Alarms',
};

interface ServiceLike {
  id: string;
  name: string;
  category: string;
  status: string;
  uptime: number;
  cpu: number;
  memory: number;
  disk: number;
  response_time: number;
  last_check: string | null;
  description: string;
  check_type?: string;
}

interface ServiceRowProps {
  service: ServiceLike;
  onClick?: (service: ServiceLike) => void;
}

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span>{Number(value).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(Number(value), 100)}%` }} />
      </div>
    </div>
  );
}

function getBarColor(value: number) {
  if (value >= 85) return 'bg-destructive';
  if (value >= 70) return 'bg-warning';
  return 'bg-primary';
}

// For metrics where high = good (DAG success rate, Cache Hit, OK alarms)
function getBarColorInverted(value: number) {
  if (value >= 80) return 'bg-success';
  if (value >= 60) return 'bg-warning';
  return 'bg-destructive';
}

function getTimeSinceCheck(lastCheck: string | null): { text: string; color: string } {
  if (!lastCheck) return { text: 'Nunca', color: 'text-muted-foreground' };
  const diffMin = Math.round((Date.now() - new Date(lastCheck).getTime()) / 60000);
  if (diffMin < 2) return { text: `${diffMin}min`, color: 'text-success' };
  if (diffMin < 5) return { text: `${diffMin}min`, color: 'text-warning' };
  if (diffMin < 60) return { text: `${diffMin}min`, color: 'text-destructive' };
  return { text: `${Math.round(diffMin / 60)}h`, color: 'text-destructive' };
}

// Map of which resource metrics each check_type actually collects
const collectsMetric: Record<string, { cpu: boolean; memory: boolean; disk: boolean }> = {
  http: { cpu: false, memory: false, disk: false },
  tcp: { cpu: false, memory: false, disk: false },
  process: { cpu: false, memory: false, disk: false },
  s3: { cpu: false, memory: false, disk: false },
  sql_query: { cpu: true, memory: true, disk: true },
  postgresql: { cpu: true, memory: true, disk: false },
  mongodb: { cpu: true, memory: true, disk: true },
  cloudwatch: { cpu: true, memory: true, disk: true },
  airflow: { cpu: true, memory: true, disk: false },
  lambda: { cpu: true, memory: true, disk: true },
  ecs: { cpu: true, memory: true, disk: false },
  cloudwatch_alarms: { cpu: true, memory: true, disk: true },
  systemctl: { cpu: true, memory: true, disk: true },
  container: { cpu: true, memory: true, disk: true },
  server: { cpu: true, memory: true, disk: true },
};

// Contextual labels per check_type
const metricLabels: Record<string, { cpu: string; memory: string; disk: string }> = {
  airflow: { cpu: 'Pool', memory: 'DAG', disk: 'Disco' },
  postgresql: { cpu: 'Conn', memory: 'Cache', disk: 'Disco' },
  mongodb: { cpu: 'Conn', memory: 'MEM', disk: 'Disco' },
  lambda: { cpu: 'Erros', memory: 'Duração', disk: 'Throttle' },
  ecs: { cpu: 'CPU', memory: 'MEM', disk: 'Disco' },
  cloudwatch_alarms: { cpu: 'Alarme', memory: 'OK', disk: 'Insuf.' },
  server: { cpu: 'CPU', memory: 'RAM', disk: 'Disco' },
};

// Metrics where high value = good (inverted color logic)
const invertedMetrics: Record<string, { cpu: boolean; memory: boolean; disk: boolean }> = {
  airflow: { cpu: false, memory: true, disk: false },     // DAG success rate
  postgresql: { cpu: false, memory: true, disk: false },   // Cache Hit
  cloudwatch_alarms: { cpu: false, memory: true, disk: false }, // OK count
};

const defaultLabels = { cpu: 'CPU', memory: 'MEM', disk: 'Disco' };

function getMetricLabels(checkType: string | undefined) {
  return metricLabels[checkType || ''] || defaultLabels;
}

function getCollectedMetrics(service: ServiceLike) {
  const map = collectsMetric[service.check_type || ''] || { cpu: false, memory: false, disk: false };
  return {
    cpu: map.cpu && Number(service.cpu) > 0,
    memory: map.memory && Number(service.memory) > 0,
    disk: map.disk && Number(service.disk) > 0,
  };
}

function showsResourceMetrics(service: ServiceLike): boolean {
  const m = getCollectedMetrics(service);
  return m.cpu || m.memory || m.disk;
}

export function ServiceRow({ service, onClick }: ServiceRowProps) {
  const Icon = categoryIconMap[service.category] || Server;
  const timeSince = getTimeSinceCheck(service.last_check);
  const hasResources = showsResourceMetrics(service);

  return (
    <Card
      className="glass-card p-4 cursor-pointer hover:border-primary/40 transition-all hover:bg-card/90"
      onClick={() => onClick?.(service)}
    >
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-semibold text-sm truncate">{service.name}</h3>
            <StatusIndicator status={service.status as ServiceStatus} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {categoryLabels[service.category] || service.category}
            {service.check_type && ` • ${checkTypeLabels[service.check_type] || service.check_type}`}
            {' • '}{statusLabels[service.status] || service.status}
            {' • Uptime '}{Number(service.uptime).toFixed(2)}%
          </p>
        </div>

        {/* Contextual metrics */}
        <div className="hidden md:flex items-center gap-4 w-80">
          {hasResources ? (
            (() => {
              const m = getCollectedMetrics(service);
              const labels = getMetricLabels(service.check_type);
              const inv = invertedMetrics[service.check_type || ''] || { cpu: false, memory: false, disk: false };
              return (
                <>
                  {m.cpu && <MetricBar value={Number(service.cpu)} label={labels.cpu} color={inv.cpu ? getBarColorInverted(Number(service.cpu)) : getBarColor(Number(service.cpu))} />}
                  {m.memory && <MetricBar value={Number(service.memory)} label={labels.memory} color={inv.memory ? getBarColorInverted(Number(service.memory)) : getBarColor(Number(service.memory))} />}
                  {m.disk && <MetricBar value={Number(service.disk)} label={labels.disk} color={inv.disk ? getBarColorInverted(Number(service.disk)) : getBarColor(Number(service.disk))} />}
                </>
              );
            })()
          ) : (
            <div className="flex-1 flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-[10px] font-mono text-muted-foreground">Latência</p>
                <p className={`text-sm font-heading font-bold ${service.response_time > 1000 ? 'text-destructive' : service.response_time > 500 ? 'text-warning' : 'text-foreground'}`}>
                  {service.response_time}ms
                </p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] font-mono text-muted-foreground">Uptime</p>
                <p className={`text-sm font-heading font-bold ${Number(service.uptime) < 99 ? 'text-warning' : 'text-success'}`}>
                  {Number(service.uptime).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Time since last check badge */}
        <div className="text-right hidden sm:block">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${timeSince.color} bg-secondary`}>
            <Clock className="h-2.5 w-2.5" />
            {timeSince.text}
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {service.response_time}ms
          </p>
        </div>
      </div>
    </Card>
  );
}
