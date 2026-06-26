import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import type { OkrWithDetails, Year } from "@shared/schema";
import { getPlanningYear, PLANNING_YEARS, formatPlanYearLabel } from "@shared/schema";

export default function TrendsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = usePersistedFilter("trends:selectedYear", currentYear.toString());
  const [comparisonYear, setComparisonYear] = usePersistedFilter("trends:comparisonYear", (currentYear - 1).toString());
  const [planningYearFilter, setPlanningYearFilter] = usePersistedFilter("trends:planningYear", "All");

  const { data: okrs, isLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  // Fetch years from admin-managed years endpoint
  const { data: yearsData } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  // Fetch strategic plan start year
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  // Get sorted years from the admin-managed years
  const years = yearsData
    ? yearsData.map(y => y.year).sort((a, b) => b - a)
    : [];

  // Apply planning year filter to all OKR data
  const filteredOkrs = okrs?.filter(okr => {
    if (planningYearFilter === "All") return true;
    return getPlanningYear(okr.quarter, okr.year, planStartYear) === parseInt(planningYearFilter);
  });

  // Update selected years when years data loads
  useEffect(() => {
    if (years.length > 0) {
      if (!years.includes(parseInt(selectedYear))) {
        setSelectedYear(years[0].toString());
      }
      if (!years.includes(parseInt(comparisonYear)) && years.length > 1) {
        setComparisonYear(years[1].toString());
      } else if (!years.includes(parseInt(comparisonYear)) && years.length === 1) {
        setComparisonYear(years[0].toString());
      }
    }
  }, [years, selectedYear, comparisonYear]);

  const quarterlyData = filteredOkrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentYearOkrs = filteredOkrs.filter(
          (okr) => okr.year === parseInt(selectedYear) && okr.quarter === quarter
        );
        const comparisonYearOkrs = filteredOkrs.filter(
          (okr) => okr.year === parseInt(comparisonYear) && okr.quarter === quarter
        );

        const currentAvg = currentYearOkrs.length > 0
          ? currentYearOkrs.reduce((sum, okr) => sum + Math.min(100, (okr.targetValue || 0) > 0 ? (okr.currentValue / (okr.targetValue || 1)) * 100 : 0), 0) / currentYearOkrs.length
          : 0;

        const comparisonAvg = comparisonYearOkrs.length > 0
          ? comparisonYearOkrs.reduce((sum, okr) => sum + Math.min(100, (okr.targetValue || 0) > 0 ? (okr.currentValue / (okr.targetValue || 1)) * 100 : 0), 0) / comparisonYearOkrs.length
          : 0;

        return {
          quarter,
          [selectedYear]: Math.round(currentAvg),
          [comparisonYear]: Math.round(comparisonAvg),
          count: currentYearOkrs.length,
        };
      })
    : [];

  const spuTrends = filteredOkrs
    ? Object.values(
        filteredOkrs.reduce((acc, okr) => {
          const spuName = okr.spu?.name || okr.staff?.spu?.name || "Unknown";
          if (!acc[spuName]) {
            acc[spuName] = {
              spu: spuName,
              currentYear: 0,
              comparisonYear: 0,
              currentCount: 0,
              comparisonCount: 0,
            };
          }

          const progressPercent = Math.min(100, (okr.targetValue || 0) > 0 ? (okr.currentValue / (okr.targetValue || 1)) * 100 : 0);
          
          if (okr.year === parseInt(selectedYear)) {
            acc[spuName].currentYear += progressPercent;
            acc[spuName].currentCount += 1;
          } else if (okr.year === parseInt(comparisonYear)) {
            acc[spuName].comparisonYear += progressPercent;
            acc[spuName].comparisonCount += 1;
          }

          return acc;
        }, {} as Record<string, any>)
      ).map((spu) => ({
        spu: spu.spu,
        [selectedYear]: spu.currentCount > 0 ? Math.round(spu.currentYear / spu.currentCount) : 0,
        [comparisonYear]: spu.comparisonCount > 0 ? Math.round(spu.comparisonYear / spu.comparisonCount) : 0,
      }))
    : [];

  const completionRates = filteredOkrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentYearOkrs = filteredOkrs.filter(
          (okr) => okr.year === parseInt(selectedYear) && okr.quarter === quarter
        );
        const completedCount = currentYearOkrs.filter((okr) => okr.status === "completed").length;
        const completionRate = currentYearOkrs.length > 0
          ? Math.round((completedCount / currentYearOkrs.length) * 100)
          : 0;

        return {
          quarter,
          completionRate,
          total: currentYearOkrs.length,
          completed: completedCount,
        };
      })
    : [];

  const totalOkrs = filteredOkrs?.filter((okr) => okr.year === parseInt(selectedYear)).length || 0;
  const completedOkrs = filteredOkrs?.filter(
    (okr) => okr.year === parseInt(selectedYear) && okr.status === "completed"
  ).length || 0;
  const avgProgress = filteredOkrs
    ? Math.round(
        filteredOkrs
          .filter((okr) => okr.year === parseInt(selectedYear))
          .reduce((sum, okr) => sum + Math.min(100, (okr.targetValue || 0) > 0 ? (okr.currentValue / (okr.targetValue || 1)) * 100 : 0), 0) /
          (filteredOkrs.filter((okr) => okr.year === parseInt(selectedYear)).length || 1)
      )
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
                Historical Trends & Analysis
              </h1>
              <p className="text-muted-foreground mt-1">
                Year-over-year comparison and quarterly performance trends
              </p>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Current Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32" data-testid="select-current-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Compare To</label>
                <Select value={comparisonYear} onValueChange={setComparisonYear}>
                  <SelectTrigger className="w-32" data-testid="select-comparison-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Plan Year</label>
                <Select value={planningYearFilter} onValueChange={setPlanningYearFilter}>
                  <SelectTrigger className="w-40" data-testid="select-planning-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Plan Years</SelectItem>
                    {PLANNING_YEARS.map((py) => (
                      <SelectItem key={py} value={String(py)}>
                        {formatPlanYearLabel(py, planStartYear)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {planningYearFilter !== "All" && (
                <div className="flex items-end pb-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setPlanningYearFilter("All")} data-testid="button-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total OKRs ({selectedYear})</CardTitle>
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
                  <CardTitle>Year-over-Year Progress Comparison</CardTitle>
                  <CardDescription>
                    Average OKR progress by quarter comparing {selectedYear} vs {comparisonYear}
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
                      <Bar dataKey={selectedYear} fill="hsl(var(--primary))" name={`${selectedYear}`} />
                      <Bar dataKey={comparisonYear} fill="hsl(var(--muted-foreground))" name={`${comparisonYear}`} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quarterly Completion Trends ({selectedYear})</CardTitle>
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
                    Average progress across all quarters: {selectedYear} vs {comparisonYear}
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
                      <Bar dataKey={selectedYear} fill="hsl(var(--primary))" name={`${selectedYear}`} />
                      <Bar dataKey={comparisonYear} fill="hsl(var(--muted-foreground))" name={`${comparisonYear}`} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
    </div>
  );
}
