import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageLoader } from '@/components/PageLoader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNotificationSettings, useSaveNotificationSettings } from '@/hooks/useNotificationSettings';
import { Loader2, Save, Settings2, Bell, Shield, SlidersHorizontal } from 'lucide-react';
import StatusRulesPanel from '@/components/monitoring/StatusRulesPanel';
import AgentSecurityPanel from '@/components/monitoring/AgentSecurityPanel';

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
    return <PageLoader />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-6 grid-bg min-h-screen">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground font-mono">Gerencie preferências, notificações, segurança e regras</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 bg-secondary/50 p-1">
          <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background">
            <Settings2 className="h-3.5 w-3.5" />
            <span>Geral</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background">
            <Bell className="h-3.5 w-3.5" />
            <span>Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background">
            <Shield className="h-3.5 w-3.5" />
            <span>Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Regras de Status</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Geral ── */}
        <TabsContent value="general" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Monitoramento
              </CardTitle>
              <CardDescription className="text-xs">
                Controle de atualização automática e comportamento do dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label>Intervalo de atualização</Label>
                  <p className="text-xs text-muted-foreground">Frequência de refresh automático da interface</p>
                </div>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger className="w-full sm:w-36 bg-secondary border-border">
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
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label>Auto-refresh</Label>
                  <p className="text-xs text-muted-foreground">Atualizar dashboard automaticamente</p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label>Alertas sonoros</Label>
                  <p className="text-xs text-muted-foreground">Emitir som ao receber alertas críticos</p>
                </div>
                <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* ── Aba Notificações ── */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Canais de Notificação
              </CardTitle>
              <CardDescription className="text-xs">
                Configure email, Slack e webhooks para receber alertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email para alertas</Label>
                <Input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="equipe@empresa.com" className="bg-secondary border-border" />
                <p className="text-xs text-muted-foreground">Receba alertas direto na caixa de entrada</p>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <Label>Webhook Slack</Label>
                <Input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="bg-secondary border-border" />
                <p className="text-xs text-muted-foreground">Notificações no canal do Slack</p>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <Label>Webhook genérico</Label>
                <Input value={genericWebhook} onChange={e => setGenericWebhook(e.target.value)} placeholder="https://api.exemplo.com/webhook" className="bg-secondary border-border" />
                <p className="text-xs text-muted-foreground">Integração com qualquer serviço que aceite webhooks</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Filtros</CardTitle>
              <CardDescription className="text-xs">
                Controle quais alertas geram notificações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label>Apenas alertas críticos</Label>
                  <p className="text-xs text-muted-foreground">Ignorar warnings e informativos</p>
                </div>
                <Switch checked={criticalOnly} onCheckedChange={setCriticalOnly} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Notificações
            </Button>
          </div>
        </TabsContent>

        {/* ── Aba Segurança ── */}
        <TabsContent value="security">
          <AgentSecurityPanel />
        </TabsContent>

        {/* ── Aba Regras de Status ── */}
        <TabsContent value="rules">
          <StatusRulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
