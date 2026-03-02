import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useMemo } from 'react';

interface MetricsChartProps {
  title: string;
  data: { time: string; value: number }[];
  color: string;
  unit?: string;
}

export function MetricsChart({ title, data, color, unit = '' }: MetricsChartProps) {
  const chartData = useMemo(() => data, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground font-mono">
          Sem dados disponíveis
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 10%)',
                border: '1px solid hsl(220 14% 18%)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
              }}
              formatter={(val: number) => [`${val}${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#grad-${title})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
