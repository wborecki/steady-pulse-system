import { useParams, useNavigate } from 'react-router-dom';
import { useService } from '@/hooks/useServices';
import { useHealthCheckHistory, useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { ArrowLeft, Globe, MapPin, Clock, Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function MetricCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-heading font-bold ${color}`}>{value}<span className="text-sm">{unit}</span></p>
        <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${value >= 85 ? 'bg-destructive' : value >= 70 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: service, isLoading } = useService(id);
  const { data: history = [] } = useHealthCheckHistory(id);
  const triggerCheck = useTriggerHealthCheck();

  const handleCheck = async () => {
    try {
      await triggerCheck.mutateAsync(id);
      toast.success('Health check executado!');
    } catch {
      toast.error('Erro ao executar check');
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

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">{service.name}</h1>
            <StatusIndicator status={service.status as any} size="lg" showLabel />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{service.description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheck} disabled={triggerCheck.isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
          Verificar Agora
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground">
        {service.url && <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{service.url}</span>}
        {service.region && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{service.region}</span>}
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Último check: {lastCheck}</span>
        <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Uptime: {Number(service.uptime).toFixed(2)}%</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="CPU" value={Number(service.cpu)} unit="%" color="text-primary" />
        <MetricCard label="Memória" value={Number(service.memory)} unit="%" color="text-success" />
        <MetricCard label="Disco" value={Number(service.disk)} unit="%" color="text-warning" />
        <MetricCard label="Latência" value={service.response_time} unit="ms" color="text-foreground" />
      </div>

      {/* Health Check History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Histórico de Checks</h2>
          <div className="glass-card rounded-lg overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="p-3 text-left">Horário</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Latência</th>
                  <th className="p-3 text-left">HTTP</th>
                  <th className="p-3 text-left">Erro</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map(h => (
                  <tr key={h.id} className="border-b border-border/50">
                    <td className="p-3 text-xs">{new Date(h.checked_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><StatusIndicator status={h.status as any} size="sm" showLabel /></td>
                    <td className="p-3">{h.response_time}ms</td>
                    <td className="p-3">{h.status_code || '-'}</td>
                    <td className="p-3 text-xs text-destructive truncate max-w-[200px]">{h.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="CPU - Últimas 24h" dataKey="cpu" color="hsl(175, 80%, 50%)" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Memória - Últimas 24h" dataKey="memory" color="hsl(145, 65%, 45%)" />
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;
