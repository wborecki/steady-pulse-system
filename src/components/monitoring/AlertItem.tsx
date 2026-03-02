import { Alert as AlertType } from '@/data/mockData';
import { AlertTriangle, XCircle, Info, Check } from 'lucide-react';

interface AlertItemProps {
  alert: AlertType;
  onAcknowledge?: (id: string) => void;
}

const iconMap = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  critical: 'text-destructive border-destructive/30 bg-destructive/5',
  warning: 'text-warning border-warning/30 bg-warning/5',
  info: 'text-primary border-primary/30 bg-primary/5',
};

export function AlertItem({ alert, onAcknowledge }: AlertItemProps) {
  const Icon = iconMap[alert.type];
  const timeAgo = getTimeAgo(alert.timestamp);

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${colorMap[alert.type]} transition-all`}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-semibold">{alert.serviceName}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
      </div>
      {!alert.acknowledged && onAcknowledge && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}
