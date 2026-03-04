import { useState } from 'react';
import { useAlerts, useAcknowledgeAlert, useAcknowledgeAll, AlertFilters } from '@/hooks/useAlerts';
import { PageLoader } from '@/components/PageLoader';
import { useServices } from '@/hooks/useServices';
import { AlertItem } from '@/components/monitoring/AlertItem';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const PER_PAGE = 30;

const Alerts = () => {
  const [filters, setFilters] = useState<AlertFilters>({ type: 'all', serviceId: 'all', period: 'all', status: 'all' });
  const [page, setPage] = useState(0);
  const { data: services = [] } = useServices();
  const { data: result, isLoading } = useAlerts(filters, page, PER_PAGE);
  const alerts = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  const acknowledgeAlert = useAcknowledgeAlert();
  const acknowledgeAll = useAcknowledgeAll();

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id, { onSuccess: () => toast.success('Alerta reconhecido') });
  };

  const handleAcknowledgeAll = () => {
    acknowledgeAll.mutate(undefined, { onSuccess: () => toast.success('Todos os alertas foram reconhecidos') });
  };

  const updateFilter = (key: keyof AlertFilters, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(0);
  };

  const pendingCount = alerts.filter(a => !a.acknowledged).length;

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold">Alertas</h1>
          <p className="text-sm text-muted-foreground font-mono">{totalCount} alertas encontrados</p>
        </div>
        {pendingCount > 0 && (
          <Button variant="outline" onClick={handleAcknowledgeAll} className="gap-2 w-full sm:w-auto">
            <CheckCheck className="h-4 w-4" /> Reconhecer Todos
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible scrollbar-hide">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={filters.type} onValueChange={v => updateFilter('type', v)}>
          <SelectTrigger className="min-w-[120px] sm:w-36 bg-secondary border-border h-9 text-xs shrink-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.serviceId} onValueChange={v => updateFilter('serviceId', v)}>
          <SelectTrigger className="min-w-[150px] sm:w-44 bg-secondary border-border h-9 text-xs shrink-0">
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os serviços</SelectItem>
            {services.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.period} onValueChange={v => updateFilter('period', v)}>
          <SelectTrigger className="min-w-[120px] sm:w-36 bg-secondary border-border h-9 text-xs shrink-0">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="1">Última hora</SelectItem>
            <SelectItem value="6">Últimas 6h</SelectItem>
            <SelectItem value="24">Últimas 24h</SelectItem>
            <SelectItem value="168">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={v => updateFilter('status', v)}>
          <SelectTrigger className="min-w-[120px] sm:w-36 bg-secondary border-border h-9 text-xs shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="acknowledged">Reconhecidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert list */}
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map(a => (
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
              onAcknowledge={!a.acknowledged ? handleAcknowledge : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-mono">Nenhum alerta encontrado</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-mono text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Alerts;
