import { useParams, useNavigate } from 'react-router-dom';
import { services } from '@/data/mockData';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { ArrowLeft, Globe, MapPin, Clock, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  const service = services.find(s => s.id === id);

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
            <StatusIndicator status={service.status} size="lg" showLabel />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{service.description}</p>
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground">
        {service.url && (
          <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{service.url}</span>
        )}
        {service.region && (
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{service.region}</span>
        )}
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Último check: {service.lastCheck}</span>
        <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Uptime: {service.uptime}%</span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="CPU" value={service.cpu} unit="%" color="text-primary" />
        <MetricCard label="Memória" value={service.memory} unit="%" color="text-success" />
        <MetricCard label="Disco" value={service.disk} unit="%" color="text-warning" />
        <MetricCard label="Latência" value={service.responseTime} unit="ms" color="text-foreground" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="CPU - Últimas 24h" dataKey="cpu" color="hsl(175, 80%, 50%)" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Memória - Últimas 24h" dataKey="memory" color="hsl(145, 65%, 45%)" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Rede - Últimas 24h" dataKey="network" color="hsl(38, 92%, 55%)" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Requisições/min" dataKey="requests" color="hsl(260, 60%, 55%)" />
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;
