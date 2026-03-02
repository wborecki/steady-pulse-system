import { useState, useMemo } from 'react';
import { services, alerts, categoryLabels, type ServiceCategory } from '@/data/mockData';
import { StatsCard } from '@/components/monitoring/StatsCard';
import { ServiceRow } from '@/components/monitoring/ServiceRow';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();
  const [activeAlerts, setActiveAlerts] = useState(alerts);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');

  const stats = useMemo(() => {
    const online = services.filter(s => s.status === 'online').length;
    const offline = services.filter(s => s.status === 'offline').length;
    const warning = services.filter(s => s.status === 'warning').length;
    const avgUptime = (services.reduce((a, s) => a + s.uptime, 0) / services.length).toFixed(2);
    return { online, offline, warning, total: services.length, avgUptime };
  }, []);

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'all') return services;
    return services.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  const unacknowledgedAlerts = activeAlerts.filter(a => !a.acknowledged);

  const handleAcknowledge = (id: string) => {
    setActiveAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const categories: (ServiceCategory | 'all')[] = ['all', 'aws', 'database', 'airflow', 'server', 'process', 'api'];

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Visão geral do sistema • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${stats.offline > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
            <Activity className="h-3.5 w-3.5" />
            {stats.offline > 0 ? `${stats.offline} serviço(s) offline` : 'Todos os serviços online'}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Serviços Online" value={stats.online} subtitle={`de ${stats.total} serviços`} icon={CheckCircle} variant="success" />
        <StatsCard title="Alertas Ativos" value={unacknowledgedAlerts.length} subtitle="não reconhecidos" icon={AlertTriangle} variant={unacknowledgedAlerts.length > 0 ? 'warning' : 'default'} />
        <StatsCard title="Serviços Offline" value={stats.offline} subtitle="requer atenção" icon={XCircle} variant={stats.offline > 0 ? 'destructive' : 'default'} />
        <StatsCard title="Uptime Médio" value={`${stats.avgUptime}%`} subtitle="últimas 24h" icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Uso de CPU (%)" dataKey="cpu" color="hsl(175, 80%, 50%)" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Uso de Memória (%)" dataKey="memory" color="hsl(145, 65%, 45%)" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-lg">Serviços</h2>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredServices.map(service => (
              <ServiceRow key={service.id} service={service} onClick={() => navigate(`/service/${service.id}`)} />
            ))}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Alertas Recentes</h2>
          <div className="space-y-2">
            {activeAlerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
