import { StatusIndicator } from './StatusIndicator';
import { Card } from '@/components/ui/card';
import { Cloud, Database, Wind, Server, Cog, Globe } from 'lucide-react';

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

export function ServiceRow({ service, onClick }: ServiceRowProps) {
  const Icon = categoryIconMap[service.category] || Server;
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
            <StatusIndicator status={service.status as any} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {categoryLabels[service.category] || service.category} • {statusLabels[service.status] || service.status} • Uptime {Number(service.uptime).toFixed(2)}%
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 w-80">
          <MetricBar value={Number(service.cpu)} label="CPU" color={getBarColor(Number(service.cpu))} />
          <MetricBar value={Number(service.memory)} label="MEM" color={getBarColor(Number(service.memory))} />
          <MetricBar value={Number(service.disk)} label="DISK" color={getBarColor(Number(service.disk))} />
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs font-mono text-muted-foreground">{service.response_time}ms</p>
          <p className="text-[10px] font-mono text-muted-foreground">
            {service.last_check ? new Date(service.last_check).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </p>
        </div>
      </div>
    </Card>
  );
}
