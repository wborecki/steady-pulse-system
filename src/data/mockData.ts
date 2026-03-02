export type ServiceStatus = 'online' | 'offline' | 'warning' | 'maintenance';
export type ServiceCategory = 'aws' | 'database' | 'airflow' | 'server' | 'process' | 'api';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  uptime: number;
  cpu: number;
  memory: number;
  disk: number;
  responseTime: number;
  lastCheck: string;
  url?: string;
  description: string;
  region?: string;
}

export interface Alert {
  id: string;
  serviceId: string;
  serviceName: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  network: number;
  requests: number;
}

const now = new Date();
const fmt = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const services: Service[] = [
  { id: '1', name: 'EC2 - Produção', category: 'aws', status: 'online', uptime: 99.97, cpu: 42, memory: 68, disk: 55, responseTime: 12, lastCheck: fmt(now), url: 'ec2-prod.empresa.com', description: 'Instância principal de produção', region: 'us-east-1' },
  { id: '2', name: 'EC2 - Staging', category: 'aws', status: 'online', uptime: 99.85, cpu: 18, memory: 35, disk: 40, responseTime: 15, lastCheck: fmt(now), url: 'ec2-stg.empresa.com', description: 'Ambiente de staging', region: 'us-east-1' },
  { id: '3', name: 'RDS PostgreSQL', category: 'database', status: 'online', uptime: 99.99, cpu: 25, memory: 72, disk: 63, responseTime: 3, lastCheck: fmt(now), description: 'Banco principal PostgreSQL', region: 'us-east-1' },
  { id: '4', name: 'Redis Cache', category: 'database', status: 'online', uptime: 99.98, cpu: 8, memory: 45, disk: 12, responseTime: 1, lastCheck: fmt(now), description: 'Cache Redis para sessões' },
  { id: '5', name: 'MongoDB Analytics', category: 'database', status: 'warning', uptime: 98.50, cpu: 78, memory: 89, disk: 82, responseTime: 45, lastCheck: fmt(now), description: 'Banco de dados de analytics' },
  { id: '6', name: 'Airflow Scheduler', category: 'airflow', status: 'online', uptime: 99.90, cpu: 35, memory: 50, disk: 30, responseTime: 8, lastCheck: fmt(now), description: 'Scheduler principal do Airflow' },
  { id: '7', name: 'Airflow Workers', category: 'airflow', status: 'online', uptime: 99.80, cpu: 65, memory: 70, disk: 45, responseTime: 20, lastCheck: fmt(now), description: 'Pool de workers do Airflow' },
  { id: '8', name: 'Nginx Load Balancer', category: 'server', status: 'online', uptime: 99.99, cpu: 12, memory: 20, disk: 15, responseTime: 2, lastCheck: fmt(now), description: 'Load balancer principal' },
  { id: '9', name: 'API Gateway', category: 'api', status: 'online', uptime: 99.95, cpu: 30, memory: 40, disk: 25, responseTime: 5, lastCheck: fmt(now), url: 'api.empresa.com', description: 'Gateway principal da API' },
  { id: '10', name: 'Worker ETL', category: 'process', status: 'offline', uptime: 85.20, cpu: 0, memory: 0, disk: 50, responseTime: 0, lastCheck: fmt(new Date(now.getTime() - 3600000)), description: 'Processo ETL de dados' },
  { id: '11', name: 'S3 - Data Lake', category: 'aws', status: 'online', uptime: 99.999, cpu: 0, memory: 0, disk: 74, responseTime: 8, lastCheck: fmt(now), description: 'Data Lake S3', region: 'us-east-1' },
  { id: '12', name: 'Lambda - Notificações', category: 'aws', status: 'warning', uptime: 97.50, cpu: 55, memory: 60, disk: 10, responseTime: 120, lastCheck: fmt(now), description: 'Lambda de envio de notificações', region: 'us-east-1' },
  { id: '13', name: 'Servidor Backup', category: 'server', status: 'maintenance', uptime: 95.00, cpu: 0, memory: 0, disk: 90, responseTime: 0, lastCheck: fmt(new Date(now.getTime() - 7200000)), description: 'Servidor de backup em manutenção' },
  { id: '14', name: 'Cron Jobs', category: 'process', status: 'online', uptime: 99.70, cpu: 15, memory: 25, disk: 20, responseTime: 10, lastCheck: fmt(now), description: 'Jobs agendados do sistema' },
];

export const alerts: Alert[] = [
  { id: 'a1', serviceId: '10', serviceName: 'Worker ETL', type: 'critical', message: 'Serviço offline há mais de 1 hora. Última execução falhou com erro de conexão.', timestamp: new Date(now.getTime() - 3600000).toISOString(), acknowledged: false },
  { id: 'a2', serviceId: '5', serviceName: 'MongoDB Analytics', type: 'warning', message: 'Uso de memória acima de 85%. Considere escalar a instância.', timestamp: new Date(now.getTime() - 1800000).toISOString(), acknowledged: false },
  { id: 'a3', serviceId: '12', serviceName: 'Lambda - Notificações', type: 'warning', message: 'Tempo de resposta elevado (120ms). Taxa de erro em 2.5%.', timestamp: new Date(now.getTime() - 900000).toISOString(), acknowledged: false },
  { id: 'a4', serviceId: '13', serviceName: 'Servidor Backup', type: 'info', message: 'Manutenção programada em andamento. Previsão de retorno: 18:00.', timestamp: new Date(now.getTime() - 7200000).toISOString(), acknowledged: true },
  { id: 'a5', serviceId: '3', serviceName: 'RDS PostgreSQL', type: 'info', message: 'Backup automático concluído com sucesso.', timestamp: new Date(now.getTime() - 5400000).toISOString(), acknowledged: true },
];

export function generateMetrics(hours: number = 24): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (let i = hours; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    points.push({
      time: t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cpu: Math.max(10, Math.min(95, 40 + Math.sin(i / 3) * 20 + (Math.random() - 0.5) * 15)),
      memory: Math.max(30, Math.min(95, 60 + Math.sin(i / 5) * 15 + (Math.random() - 0.5) * 10)),
      network: Math.max(5, Math.min(100, 30 + Math.sin(i / 2) * 25 + (Math.random() - 0.5) * 20)),
      requests: Math.max(50, Math.floor(200 + Math.sin(i / 4) * 100 + (Math.random() - 0.5) * 80)),
    });
  }
  return points;
}

export const categoryLabels: Record<ServiceCategory, string> = {
  aws: 'AWS',
  database: 'Banco de Dados',
  airflow: 'Airflow',
  server: 'Servidores',
  process: 'Processos',
  api: 'APIs',
};

export const statusLabels: Record<ServiceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  warning: 'Atenção',
  maintenance: 'Manutenção',
};

export const categoryIcons: Record<ServiceCategory, string> = {
  aws: 'Cloud',
  database: 'Database',
  airflow: 'Wind',
  server: 'Server',
  process: 'Cog',
  api: 'Globe',
};
