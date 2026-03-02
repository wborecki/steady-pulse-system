import { useState } from 'react';
import { alerts as initialAlerts } from '@/data/mockData';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Alerts = () => {
  const [alertList, setAlertList] = useState(initialAlerts);

  const handleAcknowledge = (id: string) => {
    setAlertList(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    toast.success('Alerta reconhecido');
  };

  const handleAcknowledgeAll = () => {
    setAlertList(prev => prev.map(a => ({ ...a, acknowledged: true })));
    toast.success('Todos os alertas foram reconhecidos');
  };

  const unack = alertList.filter(a => !a.acknowledged);
  const ack = alertList.filter(a => a.acknowledged);

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
            {unack.map(a => <AlertItem key={a.id} alert={a} onAcknowledge={handleAcknowledge} />)}
          </div>
        </div>
      )}

      {ack.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Reconhecidos</h2>
          <div className="space-y-2 opacity-60">
            {ack.map(a => <AlertItem key={a.id} alert={a} />)}
          </div>
        </div>
      )}

      {alertList.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-mono">Nenhum alerta registrado</p>
        </div>
      )}
    </div>
  );
};

export default Alerts;
