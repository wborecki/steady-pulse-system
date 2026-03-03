import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNotificationSettings, useSaveNotificationSettings } from '@/hooks/useNotificationSettings';
import { Loader2, Save } from 'lucide-react';

const SettingsPage = () => {
  const { data: settings, isLoading } = useNotificationSettings();
  const save = useSaveNotificationSettings();

  const [interval, setInterval] = useState('30');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [genericWebhook, setGenericWebhook] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);

  useEffect(() => {
    if (settings) {
      setInterval(String(settings.check_interval_seconds));
      setAutoRefresh(settings.auto_refresh);
      setSoundAlerts(settings.sound_alerts);
      setAlertEmail(settings.alert_email || '');
      setSlackWebhook(settings.slack_webhook_url || '');
      setGenericWebhook(settings.generic_webhook_url || '');
      setCriticalOnly(settings.notify_critical_only);
    }
  }, [settings]);

  const handleSave = () => {
    save.mutate(
      {
        check_interval_seconds: Number(interval),
        auto_refresh: autoRefresh,
        sound_alerts: soundAlerts,
        alert_email: alertEmail || null,
        slack_webhook_url: slackWebhook || null,
        generic_webhook_url: genericWebhook || null,
        notify_critical_only: criticalOnly,
      },
      { onSuccess: () => toast.success('Configurações salvas!'), onError: () => toast.error('Erro ao salvar') }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      <div>
        <h1 className="text-2xl font-heading font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground font-mono">Configurações gerais do monitoramento</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-heading">Monitoramento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Intervalo de verificação</Label>
                <p className="text-xs text-muted-foreground">Frequência de checagem dos serviços</p>
              </div>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger className="w-36 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 segundos</SelectItem>
                  <SelectItem value="30">30 segundos</SelectItem>
                  <SelectItem value="60">1 minuto</SelectItem>
                  <SelectItem value="300">5 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-refresh dashboard</Label>
                <p className="text-xs text-muted-foreground">Atualizar dashboard automaticamente</p>
              </div>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas sonoros</Label>
                <p className="text-xs text-muted-foreground">Emitir som ao receber alertas críticos</p>
              </div>
              <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-heading">Notificações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email para alertas</Label>
              <Input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="equipe@empresa.com" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Slack</Label>
              <Input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/..." className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Webhook genérico</Label>
              <Input value={genericWebhook} onChange={e => setGenericWebhook(e.target.value)} placeholder="https://api.exemplo.com/webhook" className="bg-secondary border-border" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificar apenas alertas críticos</Label>
                <p className="text-xs text-muted-foreground">Ignorar warnings e informativos</p>
              </div>
              <Switch checked={criticalOnly} onCheckedChange={setCriticalOnly} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Configurações
      </Button>
    </div>
  );
};

export default SettingsPage;
