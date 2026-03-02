import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'text-primary border-primary/20',
  success: 'text-success border-success/20',
  warning: 'text-warning border-warning/20',
  destructive: 'text-destructive border-destructive/20',
};

export function StatsCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatsCardProps) {
  return (
    <Card className={`glass-card border ${variantStyles[variant]} transition-all hover:scale-[1.02]`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-3xl font-heading font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1 font-mono">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-secondary ${variantStyles[variant].split(' ')[0]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
