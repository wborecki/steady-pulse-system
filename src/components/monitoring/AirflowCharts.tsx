import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useMemo } from 'react';

interface MetricsBarChartProps {
  title: string;
  data: { date: string; success: number; failed: number; running?: number }[];
}

export function MetricsBarChart({ title, data }: MetricsBarChartProps) {
  const chartData = useMemo(() => data, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
        <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-mono">
          Sem dados disponíveis
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
              tickFormatter={(v: string) => v.substring(5)} // show MM-DD
            />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 10%)',
                border: '1px solid hsl(220 14% 18%)',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }}
            />
            <Bar dataKey="success" name="Sucesso" stackId="a" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" name="Falhas" stackId="a" fill="hsl(0 84% 60%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface DagDurationChartProps {
  title: string;
  data: { dag_id: string; runs: { date: string; duration_seconds: number }[] }[];
}

const DURATION_COLORS = [
  'hsl(173 80% 40%)', 'hsl(210 80% 60%)', 'hsl(280 70% 60%)',
  'hsl(45 90% 55%)', 'hsl(340 75% 55%)', 'hsl(120 60% 50%)',
  'hsl(200 80% 50%)', 'hsl(30 90% 55%)', 'hsl(260 70% 60%)',
  'hsl(0 70% 55%)',
];

export function DagDurationChart({ title, data }: DagDurationChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Merge all runs into date-keyed rows
    const dateMap: Record<string, Record<string, number>> = {};
    const dagIds = new Set<string>();

    for (const dag of data) {
      dagIds.add(dag.dag_id);
      for (const run of dag.runs) {
        if (!dateMap[run.date]) dateMap[run.date] = {};
        dateMap[run.date][dag.dag_id] = run.duration_seconds;
      }
    }

    return Object.entries(dateMap)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const dagIds = useMemo(() => {
    const ids = new Set<string>();
    data?.forEach(d => ids.add(d.dag_id));
    return Array.from(ids).slice(0, 10); // max 10 DAGs in chart
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
        <div className="h-48 flex items-center justify-center text-xs text-muted-foreground font-mono">
          Sem dados disponíveis
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
              tickFormatter={(v: string) => v.substring(5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }}
              tickFormatter={(v: number) => v >= 60 ? `${Math.round(v / 60)}m` : `${v}s`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 10%)',
                border: '1px solid hsl(220 14% 18%)',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono',
              }}
              formatter={(val: number) => {
                if (val >= 3600) return [`${(val / 3600).toFixed(1)}h`, ''];
                if (val >= 60) return [`${(val / 60).toFixed(1)}min`, ''];
                return [`${val}s`, ''];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} />
            {dagIds.map((dagId, i) => (
              <Bar
                key={dagId}
                dataKey={dagId}
                name={dagId.length > 20 ? dagId.substring(0, 20) + '...' : dagId}
                fill={DURATION_COLORS[i % DURATION_COLORS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
