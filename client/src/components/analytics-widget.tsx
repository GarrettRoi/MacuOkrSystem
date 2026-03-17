import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsWidget, AnalyticsData } from "@shared/schema";

const SCHEME_COLORS: Record<string, string[]> = {
  default: ["hsl(var(--primary))"],
  blue:    ["#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe"],
  green:   ["#16a34a","#22c55e","#4ade80","#86efac","#bbf7d0"],
  orange:  ["#ea580c","#f97316","#fb923c","#fdba74","#fed7aa"],
  purple:  ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"],
  mixed:   ["#2563eb","#16a34a","#ea580c","#7c3aed","#db2777","#0891b2","#d97706","#059669"],
};

function getColors(scheme: string, count: number): string[] {
  const base = SCHEME_COLORS[scheme] ?? SCHEME_COLORS.mixed;
  if (count <= base.length) return base.slice(0, count);
  const extended: string[] = [];
  for (let i = 0; i < count; i++) extended.push(base[i % base.length]);
  return extended;
}

interface WidgetConfig {
  filters?: { quarter?: string; year?: number; spuId?: string };
  colorScheme?: string;
  showLegend?: boolean;
}

function parseConfig(raw: string): WidgetConfig {
  try { return JSON.parse(raw) as WidgetConfig; } catch { return {}; }
}

function buildQueryString(filters: WidgetConfig["filters"]): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.quarter) params.set("quarter", filters.quarter);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.spuId) params.set("spuId", filters.spuId);
  const s = params.toString();
  return s ? `&${s}` : "";
}

interface AnalyticsWidgetCardProps {
  widget: AnalyticsWidget;
  height?: number;
}

export function AnalyticsWidgetCard({ widget, height = 260 }: AnalyticsWidgetCardProps) {
  const config = parseConfig(widget.config);
  const filterQs = buildQueryString(config.filters);
  const scheme = config.colorScheme || "mixed";
  const showLegend = config.showLegend !== false;

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: [`/api/analytics/data`, widget.dataSource, widget.config],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/data?source=${widget.dataSource}${filterQs}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <div className="space-y-2 w-full px-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-muted-foreground text-sm">
        Failed to load data
      </div>
    );
  }

  if (data.type === "metric") {
    return (
      <div style={{ height }} className="flex flex-col items-center justify-center gap-2">
        <span className="text-5xl font-bold tabular-nums" data-testid={`metric-value-${widget.id}`}>
          {data.metricValue ?? 0}
        </span>
        <span className="text-sm text-muted-foreground">{data.metricLabel}</span>
      </div>
    );
  }

  const chartData = (data.data ?? []).map(p => ({ name: p.label, value: p.value }));
  const colors = getColors(scheme, chartData.length);

  if (chartData.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  switch (widget.chartType) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "horizontal_bar":
      return (
        <ResponsiveContainer width="100%" height={Math.max(height, chartData.length * 36 + 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={115} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {showLegend && <Legend />}
            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0] }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case "pie":
    case "donut":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={height / 2 - 30}
              innerRadius={widget.chartType === "donut" ? height / 4 - 10 : 0}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
            {showLegend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      );

    case "table":
      return (
        <div style={{ height, overflowY: "auto" }} className="text-sm">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="text-left p-2 border-b font-medium text-muted-foreground">Label</th>
                <th className="text-right p-2 border-b font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2">{row.name}</td>
                  <td className="p-2 text-right tabular-nums font-medium">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div style={{ height }} className="flex items-center justify-center text-muted-foreground text-sm">
          Unknown chart type: {widget.chartType}
        </div>
      );
  }
}
