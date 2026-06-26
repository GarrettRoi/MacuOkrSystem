import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Target } from "lucide-react";
import { useEffect } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import type { OkrWithDetails } from "@shared/schema";
import { getPlanningYear, PLANNING_YEARS, formatPlanYearLabel, formatQuarterTagForPlanYear } from "@shared/schema";

export default function TrendsPage() {
  const [selectedPlanYear, setSelectedPlanYear] = usePersistedFilter("trends:selectedPlanYear", "");
  const [comparisonPlanYear, setComparisonPlanYear] = usePersistedFilter("trends:comparisonPlanYear", "");

  const { data: okrs, isLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  // Fetch strategic plan start year
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  // Plan years that actually have data, newest first
  const availablePlanYears = okrs
    ? Array.from(new Set(okrs.map((o) => getPlanningYear(o.quarter, o.year, planStartYear)))).sort((a, b) => b - a)
    : [];

  // Default the two selectors to the most recent plan years once data loads
  useEffect(() => {
    if (availablePlanYears.length === 0) return;
    if (!selectedPlanYear || !availablePlanYears.includes(parseInt(selectedPlanYear))) {
      setSelectedPlanYear(String(availablePlanYears[0]));
    }
    if (!comparisonPlanYear || !availablePlanYears.includes(parseInt(comparisonPlanYear))) {
      setComparisonPlanYear(String(availablePlanYears[1] ?? availablePlanYears[0]));
    }
  }, [availablePlanYears.length]);

  const selectedPy = parseInt(selectedPlanYear);
  const comparisonPy = parseInt(comparisonPlanYear);
  const selectedLabel = selectedPlanYear ? formatPlanYearLabel(selectedPy, planStartYear) : "";
  const comparisonLabel = comparisonPlanYear ? formatPlanYearLabel(comparisonPy, planStartYear) : "";

  const inPlanYear = (okr: OkrWithDetails, py: number) =>
    getPlanningYear(okr.quarter, okr.year, planStartYear) === py;

  const progressOf = (okr: OkrWithDetails) =>
    Math.min(100, (okr.targetValue || 0) > 0 ? (okr.currentValue / (okr.targetValue || 1)) * 100 : 0);

  const quarterlyData = okrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentOkrs = okrs.filter((okr) => inPlanYear(okr, selectedPy) && okr.quarter === quarter);
        const comparisonOkrs = okrs.filter((okr) => inPlanYear(okr, comparisonPy) && okr.quarter === quarter);

        const currentAvg = currentOkrs.length > 0
          ? currentOkrs.reduce((sum, okr) => sum + progressOf(okr), 0) / currentOkrs.length
          : 0;
        const comparisonAvg = comparisonOkrs.length > 0
          ? comparisonOkrs.reduce((sum, okr) => sum + progressOf(okr), 0) / comparisonOkrs.length
          : 0;

        return {
          quarter: selectedPlanYear ? formatQuarterTagForPlanYear(quarter, selectedPy, planStartYear) : quarter,
          current: Math.round(currentAvg),
          comparison: Math.round(comparisonAvg),
          count: currentOkrs.length,
        };
      })
    : [];

  const spuTrends = okrs
    ? Object.values(
        okrs.reduce((acc, okr) => {
          const spuName = okr.spu?.name || okr.staff?.spu?.name || "Unknown";
          if (!acc[spuName]) {
            acc[spuName] = {
              spu: spuName,
              currentTotal: 0,
              comparisonTotal: 0,
              currentCount: 0,
              comparisonCount: 0,
            };
          }

          const progressPercent = progressOf(okr);

          if (inPlanYear(okr, selectedPy)) {
            acc[spuName].currentTotal += progressPercent;
            acc[spuName].currentCount += 1;
          } else if (inPlanYear(okr, comparisonPy)) {
            acc[spuName].comparisonTotal += progressPercent;
            acc[spuName].comparisonCount += 1;
          }

          return acc;
        }, {} as Record<string, any>)
      ).map((spu) => ({
        spu: spu.spu,
        current: spu.currentCount > 0 ? Math.round(spu.currentTotal / spu.currentCount) : 0,
        comparison: spu.comparisonCount > 0 ? Math.round(spu.comparisonTotal / spu.comparisonCount) : 0,
      }))
    : [];

  const completionRates = okrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentOkrs = okrs.filter((okr) => inPlanYear(okr, selectedPy) && okr.quarter === quarter);
        const completedCount = currentOkrs.filter((okr) => okr.status === "completed").length;
        const completionRate = currentOkrs.length > 0
          ? Math.round((completedCount / currentOkrs.length) * 100)
          : 0;

        return {
          quarter: selectedPlanYear ? formatQuarterTagForPlanYear(quarter, selectedPy, planStartYear) : quarter,
          completionRate,
          total: currentOkrs.length,
          completed: completedCount,
        };
      })
    : [];

  const selectedYearOkrs = okrs?.filter((okr) => inPlanYear(okr, selectedPy)) || [];
  const totalOkrs = selectedYearOkrs.length;
  const completedOkrs = selectedYearOkrs.filter((okr) => okr.status === "completed").length;
  const avgProgress = totalOkrs > 0
    ? Math.round(selectedYearOkrs.reduce((sum, okr) => sum + progressOf(okr), 0) / totalOkrs)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
                Historical Trends & Analysis
              </h1>
              <p className="text-muted-foreground mt-1">
                Plan-year comparison and quarterly performance trends
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Current Plan Year</label>
                <Select value={selectedPlanYear} onValueChange={setSelectedPlanYear}>
                  <SelectTrigger className="w-40" data-testid="select-current-plan-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_YEARS.map((py) => (
                      <SelectItem key={py} value={String(py)} data-testid={`option-current-plan-year-${py}`}>
                        {formatPlanYearLabel(py, planStartYear)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Compare To</label>
                <Select value={comparisonPlanYear} onValueChange={setComparisonPlanYear}>
                  <SelectTrigger className="w-40" data-testid="select-comparison-plan-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_YEARS.map((py) => (
                      <SelectItem key={py} value={String(py)} data-testid={`option-comparison-plan-year-${py}`}>
                        {formatPlanYearLabel(py, planStartYear)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total OKRs ({selectedLabel})</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-okrs">
                      {totalOkrs}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedOkrs} completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-progress">
                      {avgProgress}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across all quarters
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-completion-rate">
                      {totalOkrs > 0 ? Math.round((completedOkrs / totalOkrs) * 100) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedOkrs} of {totalOkrs} OKRs
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Plan-Year Progress Comparison</CardTitle>
                  <CardDescription>
                    Average OKR progress by quarter comparing {selectedLabel} vs {comparisonLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={quarterlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" />
                      <YAxis label={{ value: "Progress (%)", angle: -90, position: "insideLeft" }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="current" fill="hsl(var(--primary))" name={selectedLabel} />
                      <Bar dataKey="comparison" fill="hsl(var(--muted-foreground))" name={comparisonLabel} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quarterly Completion Trends ({selectedLabel})</CardTitle>
                  <CardDescription>
                    Percentage of OKRs marked as completed each quarter
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={completionRates}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" />
                      <YAxis label={{ value: "Completion Rate (%)", angle: -90, position: "insideLeft" }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="completionRate"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        name="Completion %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SPU Performance Comparison</CardTitle>
                  <CardDescription>
                    Average progress across all quarters: {selectedLabel} vs {comparisonLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={spuTrends} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" label={{ value: "Progress (%)", position: "insideBottom", offset: -5 }} />
                      <YAxis type="category" dataKey="spu" width={150} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="current" fill="hsl(var(--primary))" name={selectedLabel} />
                      <Bar dataKey="comparison" fill="hsl(var(--muted-foreground))" name={comparisonLabel} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
    </div>
  );
}
