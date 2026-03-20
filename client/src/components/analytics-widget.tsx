import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
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

export function getColors(scheme: string, count: number): string[] {
  const base = SCHEME_COLORS[scheme] ?? SCHEME_COLORS.mixed;
  if (count <= base.length) return base.slice(0, count);
  const extended: string[] = [];
  for (let i = 0; i < count; i++) extended.push(base[i % base.length]);
  return extended;
}

export const FONT_SIZE_OPTIONS = [
  { value: "text-2xl",  label: "XS" },
  { value: "text-3xl",  label: "SM" },
  { value: "text-5xl",  label: "MD" },
  { value: "text-6xl",  label: "LG" },
  { value: "text-7xl",  label: "XL" },
  { value: "text-8xl",  label: "2XL" },
];

export const LABEL_FONT_SIZE_OPTIONS = [
  { value: "9",  label: "XS" },
  { value: "11", label: "SM" },
  { value: "13", label: "MD" },
  { value: "15", label: "LG" },
];

export const VALUE_COLOR_OPTIONS = [
  { value: "",         label: "Default",  swatch: "hsl(var(--foreground))" },
  { value: "#2563eb",  label: "Blue",     swatch: "#2563eb" },
  { value: "#16a34a",  label: "Green",    swatch: "#16a34a" },
  { value: "#ea580c",  label: "Orange",   swatch: "#ea580c" },
  { value: "#dc2626",  label: "Red",      swatch: "#dc2626" },
  { value: "#7c3aed",  label: "Purple",   swatch: "#7c3aed" },
  { value: "#0891b2",  label: "Cyan",     swatch: "#0891b2" },
];

export interface WidgetConfig {
  // Data filtering
  filters?: { quarter?: string; year?: number; spuId?: string };
  // Color
  colorScheme?: string;
  valueColor?: string;
  // Typography
  valueFontSize?: string;
  labelFontSize?: string;
  // Metric specific
  metricSuffix?: string;
  metricDecimals?: number;
  metricLabelOverride?: string;
  // Chart controls
  showLegend?: boolean;
  showDataLabels?: boolean;
  // Layout
  widgetHeight?: number;
}

export function parseConfig(raw: string): WidgetConfig {
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
  const showDataLabels = config.showDataLabels === true;
  const valueFontSize = config.valueFontSize || "text-5xl";
  const labelFontSizePx = parseInt(config.labelFontSize || "11");
  const metricSuffix = config.metricSuffix || "";
  const metricDecimals = config.metricDecimals ?? 0;
  const valueColor = config.valueColor || undefined;
  const effectiveHeight = config.widgetHeight || height;

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
      <div style={{ height: effectiveHeight }} className="flex items-center justify-center">
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
      <div style={{ height: effectiveHeight }} className="flex items-center justify-center text-muted-foreground text-sm">
        Failed to load data
      </div>
    );
  }

  // Metric display — triggered by chart type OR by data type
  const isMetricDisplay = widget.chartType === "metric" || data.type === "metric";
  if (isMetricDisplay) {
    let rawValue: number;
    let label: string;

    if (data.type === "metric") {
      rawValue = data.metricValue ?? 0;
      label = config.metricLabelOverride || data.metricLabel || "";
    } else {
      // Non-metric data source but user chose Metric chart type — use first value
      rawValue = data.data?.[0]?.value ?? 0;
      label = config.metricLabelOverride || data.data?.[0]?.label || "";
    }

    const displayValue = metricDecimals > 0
      ? rawValue.toFixed(metricDecimals)
      : Math.round(rawValue).toString();

    return (
      <div
        style={{ height: effectiveHeight }}
        className="flex flex-col items-center justify-center gap-2"
        data-testid={`metric-widget-${widget.id}`}
      >
        <span
          className={`font-bold tabular-nums leading-none ${valueFontSize}`}
          style={valueColor ? { color: valueColor } : undefined}
          data-testid={`metric-value-${widget.id}`}
        >
          {displayValue}{metricSuffix}
        </span>
        {label && (
          <span
            className="text-muted-foreground text-center px-4 leading-snug"
            style={{ fontSize: labelFontSizePx }}
          >
            {label}
          </span>
        )}
      </div>
    );
  }

  const chartData = (data.data ?? []).map(p => ({ name: p.label, value: p.value }));
  const colors = getColors(scheme, chartData.length);

  if (chartData.length === 0) {
    return (
      <div style={{ height: effectiveHeight }} className="flex items-center justify-center text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  switch (widget.chartType) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={effectiveHeight}>
          <BarChart data={chartData} margin={{ top: showDataLabels ? 20 : 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: labelFontSizePx }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: labelFontSizePx }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              {showDataLabels && <LabelList dataKey="value" position="top" style={{ fontSize: labelFontSizePx, fill: "hsl(var(--foreground))" }} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "horizontal_bar":
      return (
        <ResponsiveContainer width="100%" height={Math.max(effectiveHeight, chartData.length * 36 + 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: showDataLabels ? 40 : 20, left: 120, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: labelFontSizePx }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: labelFontSizePx }} width={115} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              {showDataLabels && <LabelList dataKey="value" position="right" style={{ fontSize: labelFontSizePx, fill: "hsl(var(--foreground))" }} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={effectiveHeight}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: labelFontSizePx }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: labelFontSizePx }} />
            <Tooltip />
            {showLegend && <Legend />}
            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0] }}>
              {showDataLabels && <LabelList dataKey="value" position="top" style={{ fontSize: labelFontSizePx }} />}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      );

    case "pie":
    case "donut":
      return (
        <ResponsiveContainer width="100%" height={effectiveHeight}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy={showLegend ? "45%" : "50%"}
              outerRadius={effectiveHeight / 2 - (showLegend ? 45 : 30)}
              innerRadius={widget.chartType === "donut" ? effectiveHeight / 4 - 10 : 0}
              label={showDataLabels ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
              labelLine={showDataLabels}
            >
              {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
            {showLegend && <Legend wrapperStyle={{ fontSize: labelFontSizePx }} />}
          </PieChart>
        </ResponsiveContainer>
      );

    case "table":
      return (
        <div style={{ height: effectiveHeight, overflowY: "auto" }} className="text-sm">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="text-left p-2 border-b font-medium text-muted-foreground" style={{ fontSize: labelFontSizePx }}>Label</th>
                <th className="text-right p-2 border-b font-medium text-muted-foreground" style={{ fontSize: labelFontSizePx }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => (
                <tr key={i} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/30" : ""}`}>
                  <td className="p-2" style={{ fontSize: labelFontSizePx }}>{row.name}</td>
                  <td className="p-2 text-right tabular-nums font-medium" style={{ fontSize: labelFontSizePx, color: valueColor || undefined }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div style={{ height: effectiveHeight }} className="flex items-center justify-center text-muted-foreground text-sm">
          Unsupported chart type: {widget.chartType}
        </div>
      );
  }
}
