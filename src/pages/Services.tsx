import { useState, useMemo } from 'react';
import { useServices, useCreateService } from '@/hooks/useServices';
import { useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { ServiceRow } from '@/components/monitoring/ServiceRow';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const statusLabels: Record<string, string> = {
  online: 'Online', offline: 'Offline', warning: 'Atenção', maintenance: 'Manutenção',
};

const Services = () => {
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const createService = useCreateService();
  const triggerCheck = useTriggerHealthCheck();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkType, setCheckType] = useState('http');

  const filtered = useMemo(() => {
    return services.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'all' || s.category === filterCategory;
      const matchStat = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchCat && matchStat;
    });
  }, [services, search, filterCategory, filterStatus]);

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const type = form.get('check_type') as string || 'http';
    
    let checkConfig: Record<string, unknown> = {};
    if (type === 'tcp') {
      checkConfig = {
        host: form.get('tcp_host') as string,
        port: Number(form.get('tcp_port')),
      };
    }

    try {
      await createService.mutateAsync({
        name: form.get('name') as string,
        category: form.get('category') as string,
        url: type === 'http' ? (form.get('url') as string) || null : null,
        description: (form.get('description') as string) || '',
        check_type: type,
        check_config: checkConfig,
        check_interval_seconds: Number(form.get('interval') || 60),
      } as any);
      toast.success('Serviço adicionado!');
      setDialogOpen(false);
      setCheckType('http');
    } catch {
      toast.error('Erro ao adicionar serviço');
    }
  };

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
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
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCheckType('http'); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Adicionar Serviço</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading">Novo Serviço</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddService} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Serviço</Label>
                  <Input name="name" required placeholder="Ex: EC2 - Produção" className="bg-secondary border-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select name="category" defaultValue="server">
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Check</Label>
                    <Select name="check_type" defaultValue="http" value={checkType} onValueChange={setCheckType}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="tcp">TCP</SelectItem>
                        <SelectItem value="sql_query">SQL Server (Azure)</SelectItem>
                        <SelectItem value="process">Processo</SelectItem>
                        <SelectItem value="custom">Customizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {checkType === 'http' && (
                  <div className="space-y-2">
                    <Label>URL / Endpoint</Label>
                    <Input name="url" required placeholder="https://api.empresa.com" className="bg-secondary border-border" />
                  </div>
                )}

                {checkType === 'tcp' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Host</Label>
                      <Input name="tcp_host" required placeholder="db.empresa.com" className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Porta</Label>
                      <Input name="tcp_port" type="number" required placeholder="5432" className="bg-secondary border-border" />
                    </div>
                  </div>
                )}

                {checkType === 'sql_query' && (
                  <div className="rounded-md border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">📊 Azure SQL Server</p>
                    <p>As credenciais do Azure SQL já estão configuradas no backend. Este serviço irá coletar automaticamente:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>CPU e Memória (DMVs)</li>
                      <li>Uso de disco / storage</li>
                      <li>Conexões ativas</li>
                      <li>Top waits e latência</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Intervalo de verificação</Label>
                  <Select name="interval" defaultValue="60">
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="60">1 minuto</SelectItem>
                      <SelectItem value="300">5 minutos</SelectItem>
                      <SelectItem value="600">10 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input name="description" placeholder="Descrição do serviço" className="bg-secondary border-border" />
                </div>
                <Button type="submit" className="w-full" disabled={createService.isPending}>
                  {createService.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
          <p className="text-center py-12 text-muted-foreground font-mono">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-mono">Nenhum serviço encontrado</p>
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
