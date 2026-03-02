import { Service, categoryLabels, statusLabels } from '@/data/mockData';
import { StatusIndicator } from './StatusIndicator';
import { Card } from '@/components/ui/card';
import { Cloud, Database, Wind, Server, Cog, Globe } from 'lucide-react';
import { ServiceCategory } from '@/data/mockData';

const categoryIconMap: Record<ServiceCategory, React.ElementType> = {
  aws: Cloud,
  database: Database,
  airflow: Wind,
  server: Server,
  process: Cog,
  api: Globe,
};

interface ServiceRowProps {
  service: Service;
  onClick?: (service: Service) => void;
}

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
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
  const Icon = categoryIconMap[service.category];
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
            <StatusIndicator status={service.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {categoryLabels[service.category]} • {statusLabels[service.status]} • Uptime {service.uptime}%
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 w-80">
          <MetricBar value={service.cpu} label="CPU" color={getBarColor(service.cpu)} />
          <MetricBar value={service.memory} label="MEM" color={getBarColor(service.memory)} />
          <MetricBar value={service.disk} label="DISK" color={getBarColor(service.disk)} />
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs font-mono text-muted-foreground">{service.responseTime}ms</p>
          <p className="text-[10px] font-mono text-muted-foreground">{service.lastCheck}</p>
        </div>
      </div>
    </Card>
  );
}
