import { useState } from 'react';
import { useAlertThresholds, useUpsertThreshold, useDeleteThreshold, useToggleThreshold } from '@/hooks/useAlertThresholds';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Bell, BellOff, ShieldAlert } from 'lucide-react';

const allMetricOptions = [
  { value: 'cpu', label: 'CPU %' },
  { value: 'memory', label: 'Memória %' },
  { value: 'disk', label: 'Disco %' },
  { value: 'response_time', label: 'Latência (ms)' },
  { value: 'error_rate', label: 'Taxa de Erro %' },
];

// Map check_type → which metrics are actually collected
const metricsByCheckType: Record<string, string[]> = {
  http:              ['response_time'],
  tcp:               ['response_time'],
  process:           ['response_time'],
  sql_query:         ['cpu', 'memory', 'disk', 'response_time'],
  postgresql:        ['cpu', 'memory', 'response_time'],
  mongodb:           ['cpu', 'memory', 'disk', 'response_time'],
  cloudwatch:        ['cpu', 'memory', 'disk', 'response_time'],
  s3:                ['response_time'],
  airflow:           ['cpu', 'memory', 'response_time'],
  lambda:            ['cpu', 'memory', 'response_time', 'error_rate'],
  ecs:               ['cpu', 'memory', 'response_time'],
  cloudwatch_alarms: ['response_time'],
  systemctl:         ['cpu', 'memory', 'disk', 'response_time'],
  container:         ['cpu', 'memory', 'disk', 'response_time'],
};

// Friendly labels per check type for clarity
const metricLabelOverrides: Record<string, Record<string, string>> = {
  postgresql: { cpu: 'Conexões %', memory: 'Cache Hit %' },
  mongodb:    { cpu: 'Conexões %', memory: 'Memória %' },
  airflow:    { cpu: 'Pool Utilization %', memory: 'DAG Success %' },
  lambda:     { cpu: 'Error Rate %', memory: 'Duration Avg ms' },
  ecs:        { cpu: 'CPU %', memory: 'Memória %' },
  cloudwatch_alarms: {},
  sql_query:  { disk: 'Storage %' },
};

const operatorOptions = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
];

const severityOptions = [
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

interface Props {
  serviceId: string;
  checkType: string;
  serviceMetrics?: { cpu: number; memory: number; disk: number; response_time: number };
}

export function ThresholdConfigPanel({ serviceId, checkType, serviceMetrics }: Props) {
  const { data: thresholds = [], isLoading } = useAlertThresholds(serviceId);
  const upsert = useUpsertThreshold();
  const remove = useDeleteThreshold();
  const toggle = useToggleThreshold();

  const [adding, setAdding] = useState(false);

  // Determine available metrics: combine check_type mapping + metrics the service actually has data for
  const baseMetrics = metricsByCheckType[checkType] || ['cpu', 'memory', 'disk', 'response_time'];
  const extraMetrics: string[] = [];
  if (serviceMetrics) {
    if (serviceMetrics.cpu > 0 && !baseMetrics.includes('cpu')) extraMetrics.push('cpu');
    if (serviceMetrics.memory > 0 && !baseMetrics.includes('memory')) extraMetrics.push('memory');
    if (serviceMetrics.disk > 0 && !baseMetrics.includes('disk')) extraMetrics.push('disk');
    if (serviceMetrics.response_time > 0 && !baseMetrics.includes('response_time')) extraMetrics.push('response_time');
  }
  const allowedMetrics = [...baseMetrics, ...extraMetrics];
  const overrides = metricLabelOverrides[checkType] || {};
  const availableMetrics = allMetricOptions
    .filter(m => allowedMetrics.includes(m.value))
    .map(m => ({ ...m, label: overrides[m.value] || m.label }));

  const defaultMetric = availableMetrics[0]?.value || 'response_time';
  const [form, setForm] = useState({ metric: defaultMetric, operator: 'gt', threshold: '90', severity: 'warning', cooldown_minutes: '15' });

  const handleAdd = async () => {
    try {
      await upsert.mutateAsync({
        service_id: serviceId,
        metric: form.metric,
        operator: form.operator,
        threshold: Number(form.threshold),
        severity: form.severity,
        cooldown_minutes: Number(form.cooldown_minutes),
        enabled: true,
      });
      toast.success('Threshold adicionado');
      setAdding(false);
      setForm({ metric: 'cpu', operator: 'gt', threshold: '90', severity: 'warning', cooldown_minutes: '15' });
    } catch {
      toast.error('Erro ao salvar threshold');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync({ id, serviceId });
      toast.success('Threshold removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggle.mutateAsync({ id, enabled, serviceId });
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const metricLabel = (metric: string) => {
    const override = overrides[metric];
    if (override) return override;
    return allMetricOptions.find(m => m.value === metric)?.label ?? metric;
  };
  const operatorLabel = (op: string) => operatorOptions.find(o => o.value === op)?.label ?? op;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm">Alertas Automáticos (Thresholds)</h3>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAdding(!adding)}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <Card className="glass-card border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs font-mono">Métrica</Label>
                <Select value={form.metric} onValueChange={v => setForm(f => ({ ...f, metric: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableMetrics.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Operador</Label>
                <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Valor</Label>
                <Input className="h-8 text-xs" type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-mono">Severidade</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Cooldown (min)</Label>
                <Input className="h-8 text-xs" type="number" value={form.cooldown_minutes} onChange={e => setForm(f => ({ ...f, cooldown_minutes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={upsert.isPending} className="gap-1.5">
                <Bell className="h-3 w-3" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing thresholds */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground font-mono">Carregando...</p>
      ) : thresholds.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">Nenhum threshold configurado. Clique em "Adicionar" para criar alertas automáticos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {thresholds.map(t => (
            <Card key={t.id} className={`glass-card ${!t.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <Switch
                  checked={t.enabled}
                  onCheckedChange={v => handleToggle(t.id, v)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono">
                    <span className="font-semibold">{metricLabel(t.metric)}</span>
                    {' '}
                    <span className="text-muted-foreground">{operatorLabel(t.operator)}</span>
                    {' '}
                    <span className="font-bold text-foreground">{t.threshold}{t.metric === 'response_time' ? 'ms' : '%'}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Severidade: <span className={t.severity === 'critical' ? 'text-destructive' : 'text-warning'}>{t.severity}</span>
                    {' · '}Cooldown: {t.cooldown_minutes}min
                    {t.last_triggered_at && ` · Último: ${new Date(t.last_triggered_at).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover threshold?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O alerta automático para {metricLabel(t.metric)} será removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
