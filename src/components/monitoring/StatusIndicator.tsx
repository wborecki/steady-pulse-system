import { ServiceStatus } from '@/data/mockData';

interface StatusIndicatorProps {
  status: ServiceStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<ServiceStatus, { color: string; label: string; glowClass: string }> = {
  online: { color: 'bg-success', label: 'Online', glowClass: 'glow-success' },
  offline: { color: 'bg-destructive', label: 'Offline', glowClass: 'glow-destructive' },
  warning: { color: 'bg-warning', label: 'Atenção', glowClass: 'glow-warning' },
  maintenance: { color: 'bg-muted-foreground', label: 'Manutenção', glowClass: '' },
};

const sizeMap = { sm: 'h-2 w-2', md: 'h-3 w-3', lg: 'h-4 w-4' };

export function StatusIndicator({ status, size = 'md', showLabel = false }: StatusIndicatorProps) {
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`${sizeMap[size]} rounded-full ${config.color} ${status === 'online' || status === 'warning' ? 'status-pulse' : ''}`} />
      {showLabel && <span className="text-sm font-mono text-muted-foreground">{config.label}</span>}
    </div>
  );
}
