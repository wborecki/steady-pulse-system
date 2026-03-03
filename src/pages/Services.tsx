import { useState, useMemo } from 'react';
import { useServices } from '@/hooks/useServices';
import { useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { ServiceRow } from '@/components/monitoring/ServiceRow';
import { AddServiceForm } from '@/components/monitoring/AddServiceForm';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, RefreshCw, Server } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ServicesSkeleton } from '@/components/monitoring/ServicesSkeleton';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
  container: 'Containers', infra: 'Infraestrutura',
};

const statusLabels: Record<string, string> = {
  online: 'Online', offline: 'Offline', warning: 'Atenção', maintenance: 'Manutenção',
};

const Services = () => {
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const triggerCheck = useTriggerHealthCheck();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return services.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'all' || s.category === filterCategory;
      const matchStat = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchCat && matchStat;
    });
  }, [services, search, filterCategory, filterStatus]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Serviços</h1>
          <p className="text-sm text-muted-foreground font-mono">{services.length} serviços configurados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => triggerCheck.mutateAsync(undefined).then(() => toast.success('Checks executados!'))} disabled={triggerCheck.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
            Verificar Todos
          </Button>
          <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Adicionar Serviço</Button>
            </SheetTrigger>
            <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-heading">Novo Serviço</SheetTitle>
              </SheetHeader>
              <AddServiceForm onSuccess={() => setDialogOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviços..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-secondary border-border">
            <Filter className="h-3.5 w-3.5 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <ServicesSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-4">
            <Server className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="font-mono">Nenhum serviço encontrado</p>
            {services.length === 0 && (
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar primeiro serviço
              </Button>
            )}
          </div>
        ) : (
          filtered.map(service => (
            <ServiceRow key={service.id} service={service} onClick={() => navigate(`/service/${service.id}`)} />
          ))
        )}
      </div>
    </div>
  );
};

export default Services;
