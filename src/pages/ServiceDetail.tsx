import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useService, useUpdateService, useDeleteService } from '@/hooks/useServices';
import { useHealthCheckHistory, useTriggerHealthCheck } from '@/hooks/useHealthChecks';
import { StatusIndicator } from '@/components/monitoring/StatusIndicator';
import { MetricsChart } from '@/components/monitoring/MetricsChart';
import { ArrowLeft, Globe, MapPin, Clock, Activity, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: service, isLoading } = useService(id);
  const { data: history = [] } = useHealthCheckHistory(id, 100);
  const triggerCheck = useTriggerHealthCheck();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const [editOpen, setEditOpen] = useState(false);

  const responseTimeData = useMemo(() => {
    return [...history].reverse().map(h => ({
      time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value: h.response_time ?? 0,
    }));
  }, [history]);

  const statusData = useMemo(() => {
    return [...history].reverse().map(h => ({
      time: new Date(h.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value: h.status === 'online' ? 100 : h.status === 'warning' ? 50 : 0,
    }));
  }, [history]);

  const handleCheck = async () => {
    try {
      await triggerCheck.mutateAsync(id);
      toast.success('Health check executado!');
    } catch {
      toast.error('Erro ao executar check');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteService.mutateAsync(id!);
      toast.success('Serviço removido');
      navigate('/services');
    } catch {
      toast.error('Erro ao remover serviço');
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await updateService.mutateAsync({
        id: id!,
        name: form.get('name') as string,
        description: (form.get('description') as string) || '',
        url: (form.get('url') as string) || null,
        category: form.get('category') as string,
        check_interval_seconds: Number(form.get('interval') || 60),
      } as any);
      toast.success('Serviço atualizado!');
      setEditOpen(false);
    } catch {
      toast.error('Erro ao atualizar serviço');
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. Todos os health checks e alertas associados serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleCheck} disabled={triggerCheck.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${triggerCheck.isPending ? 'animate-spin' : ''}`} />
            Verificar Agora
          </Button>
        </div>
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

      {/* Charts with real data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Latência (ms)" data={responseTimeData} color="hsl(175, 80%, 50%)" unit="ms" />
        </div>
        <div className="glass-card rounded-lg p-4">
          <MetricsChart title="Disponibilidade (%)" data={statusData} color="hsl(145, 65%, 45%)" unit="%" />
        </div>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">Editar Serviço</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input name="name" defaultValue={service.name} required className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select name="category" defaultValue={service.category}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input name="url" defaultValue={service.url || ''} className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Intervalo de verificação</Label>
              <Select name="interval" defaultValue={String(service.check_interval_seconds)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
              <Input name="description" defaultValue={service.description} className="bg-secondary border-border" />
            </div>
            <Button type="submit" className="w-full" disabled={updateService.isPending}>
              {updateService.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceDetail;
