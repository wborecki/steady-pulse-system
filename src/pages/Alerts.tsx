import { useAlerts, useAcknowledgeAlert, useAcknowledgeAll } from '@/hooks/useAlerts';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Alerts = () => {
  const { data: alerts = [], isLoading } = useAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const acknowledgeAll = useAcknowledgeAll();

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id, {
      onSuccess: () => toast.success('Alerta reconhecido'),
    });
  };

  const handleAcknowledgeAll = () => {
    acknowledgeAll.mutate(undefined, {
      onSuccess: () => toast.success('Todos os alertas foram reconhecidos'),
    });
  };

  const unack = alerts.filter(a => !a.acknowledged);
  const ack = alerts.filter(a => a.acknowledged);

  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Alertas</h1>
          <p className="text-sm text-muted-foreground font-mono">{unack.length} alertas pendentes</p>
        </div>
        {unack.length > 0 && (
          <Button variant="outline" onClick={handleAcknowledgeAll} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Reconhecer Todos
          </Button>
        )}
      </div>

      {unack.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Pendentes</h2>
          <div className="space-y-2">
            {unack.map(a => (
              <AlertItem
                key={a.id}
                alert={{
                  id: a.id,
                  serviceId: a.service_id,
                  serviceName: a.services?.name || 'Serviço',
                  type: a.type as 'critical' | 'warning' | 'info',
                  message: a.message,
                  timestamp: a.created_at,
                  acknowledged: a.acknowledged,
                }}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </div>
        </div>
      )}

      {ack.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Reconhecidos</h2>
          <div className="space-y-2 opacity-60">
            {ack.map(a => (
              <AlertItem
                key={a.id}
                alert={{
                  id: a.id,
                  serviceId: a.service_id,
                  serviceName: a.services?.name || 'Serviço',
                  type: a.type as 'critical' | 'warning' | 'info',
                  message: a.message,
                  timestamp: a.created_at,
                  acknowledged: a.acknowledged,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-mono">Nenhum alerta registrado</p>
        </div>
      )}
    </div>
  );
};

export default Alerts;
