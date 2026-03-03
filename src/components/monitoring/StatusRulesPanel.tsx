import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Loader2, Save, AlertTriangle, XCircle } from 'lucide-react';
import { useCheckTypeRules, useUpdateCheckTypeRule, type CheckTypeStatusRule } from '@/hooks/useCheckTypeRules';

// Labels for each check_type
const CHECK_TYPE_LABELS: Record<string, string> = {
  http: 'HTTP / API',
  airflow: 'Apache Airflow',
  server: 'Servidor (Agent)',
  sql_query: 'Azure SQL',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  lambda: 'AWS Lambda',
  ecs: 'AWS ECS',
  cloudwatch_alarms: 'CloudWatch Alarms',
  systemctl: 'Systemctl Services',
  container: 'Docker Containers',
};

// Human-readable labels for rule keys
const RULE_KEY_LABELS: Record<string, string> = {
  cpu_gt: 'CPU acima de (%)',
  memory_gt: 'Memória acima de (%)',
  disk_gt: 'Disco acima de (%)',
  storage_gt: 'Storage acima de (%)',
  response_time_gt: 'Tempo de resposta acima de (ms)',
  status_code_gte: 'Status code HTTP ≥',
  import_errors_gt: 'Import errors acima de',
  success_rate_lt: 'Taxa de sucesso abaixo de (%)',
  failed_runs_gt: 'Failed runs acima de',
  failed_runs_success_rate_lt: 'Taxa sucesso (com failed runs) abaixo de (%)',
  cache_hit_lt: 'Cache hit ratio abaixo de (%)',
  active_connections_gt: 'Conexões ativas acima de',
  connection_percent_gt: 'Conexões (%) acima de',
  memory_percent_gt: 'Memória (%) acima de',
  error_rate_gt: 'Taxa de erro acima de (%)',
  throttles_gt: 'Throttles acima de',
  insufficient_data_ratio_gt: 'Insufficient data ratio acima de (%)',
  alarm_count_gt: 'Alarmes em ALARM acima de',
  inactive_gt: 'Serviços inativos acima de',
  failed_gt: 'Serviços com falha acima de',
  stopped_gt: 'Containers parados acima de',
  unhealthy_gt: 'Containers unhealthy acima de',
  // Boolean rules
  scheduler_down: 'Scheduler indisponível',
  metadatabase_down: 'Metadatabase indisponível',
  running_lt_desired: 'Running < Desired',
  running_zero: 'Nenhuma instância rodando',
};

function isBooleanRule(key: string) {
  return ['scheduler_down', 'metadatabase_down', 'running_lt_desired', 'running_zero'].includes(key);
}

interface RuleEditorProps {
  label: string;
  rules: Record<string, unknown>;
  onChange: (rules: Record<string, unknown>) => void;
  severity: 'warning' | 'offline';
}

function RuleEditor({ label, rules, onChange, severity }: RuleEditorProps) {
  const icon = severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-yellow-500" /> : <XCircle className="h-4 w-4 text-destructive" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(rules).map(([key, value]) => {
          if (isBooleanRule(key)) {
            return (
              <div key={key} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{RULE_KEY_LABELS[key] || key}</Badge>
                <span className="text-xs text-muted-foreground">ativo</span>
              </div>
            );
          }
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{RULE_KEY_LABELS[key] || key}</Label>
              <Input
                type="number"
                value={String(value)}
                onChange={(e) => onChange({ ...rules, [key]: Number(e.target.value) })}
                className="bg-secondary border-border h-8 text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: CheckTypeStatusRule }) {
  const update = useUpdateCheckTypeRule();
  const [warningRules, setWarningRules] = useState<Record<string, unknown>>(rule.warning_rules);
  const [offlineRules, setOfflineRules] = useState<Record<string, unknown>>(rule.offline_rules);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setWarningRules(rule.warning_rules);
    setOfflineRules(rule.offline_rules);
    setDirty(false);
  }, [rule]);

  const handleSave = () => {
    update.mutate(
      { id: rule.id, warning_rules: warningRules, offline_rules: offlineRules },
      {
        onSuccess: () => { toast.success(`Regras de ${CHECK_TYPE_LABELS[rule.check_type] || rule.check_type} salvas!`); setDirty(false); },
        onError: () => toast.error('Erro ao salvar regras'),
      }
    );
  };

  const hasWarning = Object.keys(warningRules).length > 0;
  const hasOffline = Object.keys(offlineRules).length > 0;

  return (
    <AccordionItem value={rule.check_type} className="border-border">
      <AccordionTrigger className="hover:no-underline px-4">
        <div className="flex items-center gap-3">
          <span className="font-heading text-sm font-medium">{CHECK_TYPE_LABELS[rule.check_type] || rule.check_type}</span>
          <Badge variant="secondary" className="text-xs font-mono">{rule.check_type}</Badge>
          {dirty && <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500">modificado</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-4">
        {hasWarning && (
          <RuleEditor
            label="Regras de Warning"
            rules={warningRules}
            onChange={(r) => { setWarningRules(r); setDirty(true); }}
            severity="warning"
          />
        )}
        {hasOffline && (
          <RuleEditor
            label="Regras de Offline"
            rules={offlineRules}
            onChange={(r) => { setOfflineRules(r); setDirty(true); }}
            severity="offline"
          />
        )}
        {!hasWarning && !hasOffline && (
          <p className="text-xs text-muted-foreground">Nenhuma regra configurável para este tipo.</p>
        )}
        {(hasWarning || hasOffline) && (
          <Button size="sm" onClick={handleSave} disabled={update.isPending || !dirty} className="gap-2">
            {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar
          </Button>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export default function StatusRulesPanel() {
  const { data: rules, isLoading } = useCheckTypeRules();

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-heading">Regras de Status por Tipo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Configure os limites que determinam quando cada tipo de serviço fica em warning ou offline.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {rules?.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
