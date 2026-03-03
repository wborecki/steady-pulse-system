import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { useMemo } from 'react';

interface CategoryBarChartProps {
  title: string;
  data: { time: string; value: number }[];
}

const BAR_COLORS = [
  'hsl(0, 72%, 55%)',     // vermelho
  'hsl(25, 90%, 55%)',    // laranja
  'hsl(38, 92%, 55%)',    // amarelo
  'hsl(175, 80%, 50%)',   // ciano
  'hsl(215, 70%, 55%)',   // azul
  'hsl(280, 65%, 55%)',   // roxo
  'hsl(145, 65%, 45%)',   // verde
  'hsl(330, 70%, 55%)',   // rosa
];

export function CategoryBarChart({ title, data }: CategoryBarChartProps) {
  const chartData = useMemo(() => data, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
        <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-mono">
          Nenhum incidente registrado
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
            barCategoryGap="20%"
          >
            <defs>
              {BAR_COLORS.map((color, i) => (
                <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220 14% 18%)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)', fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'hsl(220 14% 20%)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)', fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, Math.ceil(maxVal * 1.15)]}
            />
            <Tooltip
              cursor={{ fill: 'hsl(220 14% 15%)', opacity: 0.5 }}
              contentStyle={{
                backgroundColor: 'hsl(220 18% 10%)',
                border: '1px solid hsl(220 14% 22%)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                color: 'hsl(210 20% 90%)',
              }}
              labelStyle={{ color: 'hsl(210 20% 98%)' }}
              itemStyle={{ color: 'hsl(210 20% 85%)' }}
              formatter={(val: number) => [val, 'Incidentes']}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              minPointSize={8}
              animationDuration={800}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="value"
                position="top"
                style={{
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  fill: 'hsl(215 20% 75%)',
                  fontWeight: 600,
                }}
                offset={6}
              />
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#bar-grad-${index % BAR_COLORS.length})`}
                  stroke={BAR_COLORS[index % BAR_COLORS.length]}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
