import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const SettingsPage = () => {
  const handleSave = () => toast.success('Configurações salvas (demo)');

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
              <Select defaultValue="30">
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
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas sonoros</Label>
                <p className="text-xs text-muted-foreground">Emitir som ao receber alertas críticos</p>
              </div>
              <Switch />
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
              <Input placeholder="equipe@empresa.com" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Slack</Label>
              <Input placeholder="https://hooks.slack.com/..." className="bg-secondary border-border" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificar apenas alertas críticos</Label>
                <p className="text-xs text-muted-foreground">Ignorar warnings e informativos</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave}>Salvar Configurações</Button>
    </div>
  );
};

export default SettingsPage;
