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
      <CardContent className="p-3 sm:p-4 lg:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">{title}</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold mt-0.5 sm:mt-1">{value}</p>
            {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 font-mono truncate">{subtitle}</p>}
          </div>
          <div className={`p-1.5 sm:p-2 rounded-lg bg-secondary flex-shrink-0 ${variantStyles[variant].split(' ')[0]}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
