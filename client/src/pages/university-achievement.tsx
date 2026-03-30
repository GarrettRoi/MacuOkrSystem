import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Target, AlertTriangle, Search, X, Filter, Calendar } from "lucide-react";
import type { OkrWithDetails, QuarterlyUpdate, Spu, Year, StrategicAdvancementData, StrategicChartData, AnalyticsDashboardWithWidgets } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear, PLANNING_YEARS } from "@shared/schema";
import { AnalyticsWidgetCard } from "@/components/analytics-widget";
import { generateQuarterPeriods, CHART_COLORS } from "@/lib/utils";

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];

function DashboardTab() {
  const [quarterFilter, setQuarterFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [planningYearFilter, setPlanningYearFilter] = useState<string>("All");
  const [spuFilter, setSpuFilter] = useState<string>("All");
  const [keywordSearch, setKeywordSearch] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [spuSearch, setSpuSearch] = useState<string>("");

  const { data: okrs, isLoading: okrsLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  const { data: updates, isLoading: updatesLoading } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: spus, isLoading: spusLoading } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const isLoading = okrsLoading || updatesLoading || spusLoading;

  const availableYears = okrs
    ? Array.from(new Set(okrs.map(o => o.year))).sort((a, b) => b - a)
    : [];
  const YEARS = ["All", ...availableYears.map(String)];

  useEffect(() => {
    if (yearFilter === "All" && availableYears.length > 0) {
      setYearFilter(String(availableYears[0]));
    }
  }, [availableYears.length]);

  const filteredOkrs = okrs?.filter((okr) => {
    const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
    const yearMatch = yearFilter === "All" || String(okr.year) === yearFilter;
    const planningYearMatch = planningYearFilter === "All" || getPlanningYear(okr.quarter, okr.year, planStartYear) === parseInt(planningYearFilter);
    const spuMatch = spuFilter === "All" || String(okr.spuId) === spuFilter;
    const keywordMatch = !keywordSearch || 
      okr.objectiveStatement.toLowerCase().includes(keywordSearch.toLowerCase()) ||
      parseMultiSelectField(okr.universityObjective).some(o => o.toLowerCase().includes(keywordSearch.toLowerCase())) ||
      parseMultiSelectField(okr.universityKeyResult).some(kr => kr.toLowerCase().includes(keywordSearch.toLowerCase())) ||
      okr.okrNumber.toLowerCase().includes(keywordSearch.toLowerCase());
    
    return quarterMatch && yearMatch && planningYearMatch && spuMatch && keywordMatch;
  }) || [];

  const clearAllFilters = () => {
    setQuarterFilter("All");
    setYearFilter(availableYears.length > 0 ? String(availableYears[0]) : "All");
    setPlanningYearFilter("All");
    setSpuFilter("All");
    setKeywordSearch("");
  };

  const activeFilterCount = [
    quarterFilter !== "All",
    yearFilter !== "All" && yearFilter !== (availableYears.length > 0 ? String(availableYears[0]) : "All"),
    planningYearFilter !== "All",
    spuFilter !== "All",
    keywordSearch !== "",
  ].filter(Boolean).length;

  const getOkrProgress = (okrId: string): number => {
    if (!updates) return 0;
    const okrUpdates = updates.filter(u => u.okrId === okrId && u.isPrimaryScore !== false);
    if (okrUpdates.length === 0) return 0;
    const latest = okrUpdates.sort((a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
    return latest.progress ?? 0;
  };

  const totalOkrs = filteredOkrs.length;
  const completedOkrs = filteredOkrs.filter(okr => getOkrProgress(okr.id) >= 100).length;
  const avgProgress = totalOkrs > 0
    ? Math.round(filteredOkrs.reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) / totalOkrs)
    : 0;
  
  
  const okrsNeedingUpdate = filteredOkrs.filter((okr) => {
    if (quarterFilter === "All") {
      return getOkrProgress(okr.id) < 100;
    }
    const hasRecentUpdate = updates?.some((update) => {
      const quarterMatch = update.quarter === quarterFilter;
      const yearMatch = yearFilter === "All" || update.year === Number(yearFilter);
      return update.okrId === okr.id && quarterMatch && yearMatch;
    });
    return !hasRecentUpdate;
  }).length;

  const spuProgress = spus?.map((spu) => {
    const spuOkrs = filteredOkrs.filter((okr) => okr.spuId === spu.id);
    const avgProg = spuOkrs.length > 0
      ? Math.round(spuOkrs.reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) / spuOkrs.length)
      : 0;
    return {
      name: spu.name,
      progress: avgProg,
      count: spuOkrs.length,
    };
  }).filter((s) => s.count > 0) || [];

  const filteredSpuProgress = spuProgress.filter((spu) =>
    spu.name.toLowerCase().includes(spuSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={quarterFilter} onValueChange={setQuarterFilter}>
              <SelectTrigger className="w-32" data-testid="select-filter-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q} value={q} data-testid={`option-filter-quarter-${q}`}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32" data-testid="select-filter-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y} data-testid={`option-filter-year-${y}`}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={planningYearFilter} onValueChange={setPlanningYearFilter}>
              <SelectTrigger className="w-40" data-testid="select-filter-planning-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Plan Years</SelectItem>
                {PLANNING_YEARS.map((py) => (
                  <SelectItem key={py} value={String(py)} data-testid={`option-filter-planning-year-${py}`}>
                    Year {py}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              data-testid="button-toggle-advanced-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-active-filters">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {showAdvancedFilters && (
          <Card data-testid="card-advanced-filters">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Advanced Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary SPU</label>
                  <Select value={spuFilter} onValueChange={setSpuFilter}>
                    <SelectTrigger data-testid="select-filter-spu">
                      <SelectValue placeholder="All SPUs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All SPUs</SelectItem>
                      {spus?.map((spu) => (
                        <SelectItem key={spu.id} value={String(spu.id)} data-testid={`option-filter-spu-${spu.id}`}>
                          {spu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Keyword Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in titles and descriptions..."
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-keyword-search"
                  />
                  {keywordSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 px-2"
                      onClick={() => setKeywordSearch("")}
                      data-testid="button-clear-keyword"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total OKRs</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-okrs">{totalOkrs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all departments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-progress">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Updates</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-updates">{okrsNeedingUpdate}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Need quarterly updates
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SPUs..."
            value={spuSearch}
            onChange={(e) => setSpuSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-spu"
          />
          {spuSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSpuSearch("")}
              data-testid="button-clear-spu-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SPU Progress</CardTitle>
            <CardDescription>Average OKR completion by SPU</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSpuProgress.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No SPUs found{spuSearch ? ` matching "${spuSearch}"` : " for selected filters"}</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredSpuProgress}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpuProgress.map((spu) => (
            <Card key={spu.name} data-testid={`card-spu-${spu.name}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{spu.name}</CardTitle>
                <CardDescription>{spu.count} OKRs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="text-2xl font-bold" data-testid={`text-spu-progress-${spu.name}`}>{spu.progress}%</span>
                  </div>
                  <Progress value={spu.progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendsTab() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [comparisonYear, setComparisonYear] = useState((currentYear - 1).toString());

  const { data: okrs, isLoading: okrsLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  const { data: updates } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: yearsData } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  const isLoading = okrsLoading;

  const years = yearsData
    ? yearsData.map(y => y.year).sort((a, b) => b - a)
    : [];

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

  const getOkrProgress = (okrId: string): number => {
    if (!updates) return 0;
    const okrUpdates = updates.filter(u => u.okrId === okrId && u.isPrimaryScore !== false);
    if (okrUpdates.length === 0) return 0;
    const latest = okrUpdates.sort((a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
    return latest.progress ?? 0;
  };

  const quarterlyData = okrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentYearOkrs = okrs.filter(
          (okr) => okr.year === parseInt(selectedYear) && okr.quarter === quarter
        );
        const comparisonYearOkrs = okrs.filter(
          (okr) => okr.year === parseInt(comparisonYear) && okr.quarter === quarter
        );

        const currentAvg = currentYearOkrs.length > 0
          ? currentYearOkrs.reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) / currentYearOkrs.length
          : 0;

        const comparisonAvg = comparisonYearOkrs.length > 0
          ? comparisonYearOkrs.reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) / comparisonYearOkrs.length
          : 0;

        return {
          quarter,
          [selectedYear]: Math.round(currentAvg),
          [comparisonYear]: Math.round(comparisonAvg),
          count: currentYearOkrs.length,
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
              currentYear: 0,
              comparisonYear: 0,
              currentCount: 0,
              comparisonCount: 0,
            };
          }

          const progressPercent = getOkrProgress(okr.id);
          
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

  const completionRates = okrs
    ? ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
        const currentYearOkrs = okrs.filter(
          (okr) => okr.year === parseInt(selectedYear) && okr.quarter === quarter
        );
        const completedCount = currentYearOkrs.filter((okr) => getOkrProgress(okr.id) >= 100).length;
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

  const totalOkrs = okrs?.filter((okr) => okr.year === parseInt(selectedYear)).length || 0;
  const completedOkrs = okrs?.filter(
    (okr) => okr.year === parseInt(selectedYear) && getOkrProgress(okr.id) >= 100
  ).length || 0;
  const avgProgress = okrs
    ? Math.round(
        okrs
          .filter((okr) => okr.year === parseInt(selectedYear))
          .reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) /
          (okrs.filter((okr) => okr.year === parseInt(selectedYear)).length || 1)
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-muted-foreground">
          Year-over-year comparison and quarterly performance trends
        </p>
        <div className="flex gap-3 flex-wrap">
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
                <CardTitle className="text-sm font-medium">Total OKRs ({selectedYear})</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-trends-total-okrs">
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
                <div className="text-2xl font-bold" data-testid="text-trends-avg-progress">
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

function AnalyticsTab() {
  const { data: publishedDashboards, isLoading } = useQuery<AnalyticsDashboardWithWidgets[]>({
    queryKey: ["/api/analytics/dashboards"],
  });

  return (
    <div className="space-y-10">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : publishedDashboards && publishedDashboards.length > 0 ? (
        publishedDashboards.map((dashboard) => (
          <section key={dashboard.id} data-testid={`analytics-dashboard-${dashboard.id}`}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{dashboard.name}</h2>
              {dashboard.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{dashboard.description}</p>
              )}
            </div>
            {dashboard.widgets.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No widgets in this dashboard yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dashboard.widgets.map((widget) => (
                  <div
                    key={widget.id}
                    className={widget.width === "full" ? "sm:col-span-2" : ""}
                    data-testid={`analytics-widget-${widget.id}`}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{widget.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <AnalyticsWidgetCard widget={widget} />
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-base font-medium">No analytics dashboards published yet.</p>
          <p className="text-sm mt-1">A super admin can build and publish dashboards in the Admin panel.</p>
        </div>
      )}

      {/* Built-in: Historical Trends */}
      <section>
        <div className="mb-4 pb-2 border-b">
          <h2 className="text-lg font-semibold">Historical Trends</h2>
          <p className="text-sm text-muted-foreground">Year-over-year comparisons and progress trends</p>
        </div>
        <TrendsTab />
      </section>
    </div>
  );
}

const QUARTER_LABELS: Record<string, string> = { Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4" };

function StrategicAdvancementTab() {
  const { data, isLoading } = useQuery<StrategicChartData>({
    queryKey: ["/api/strategic-advancement/chart"],
  });

  const allObjectiveIds = useMemo(() => (data?.objectives ?? []).map(o => `obj-${o.id}`), [data]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (allObjectiveIds.length > 0 && selectedItems.size === 0) {
      setSelectedItems(new Set(allObjectiveIds));
    }
  }, [allObjectiveIds]);

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const objectives = data?.objectives ?? [];
  const range = data?.range ?? null;
  const lastUpdated = formatDate(data?.lastUpdated ?? null);

  const periods = useMemo(() => {
    if (!range) return [];
    return generateQuarterPeriods(range.startQuarter, range.startYear, range.endQuarter, range.endYear);
  }, [range]);

  const allKRs = useMemo(() => objectives.flatMap(obj => obj.keyResults.map(kr => ({ ...kr, objId: obj.id, objLabel: obj.label }))), [objectives]);

  const chartItems = useMemo(() => {
    const items: Array<{ key: string; label: string; color: string; isObjective: boolean; objId?: string; krId?: string }> = [];
    let colorIdx = 0;
    for (const obj of objectives) {
      if (selectedItems.has(`obj-${obj.id}`)) {
        items.push({ key: `obj-${obj.id}`, label: `${obj.label} (avg)`, color: CHART_COLORS[colorIdx++ % CHART_COLORS.length], isObjective: true, objId: obj.id });
      }
      for (const kr of obj.keyResults) {
        if (selectedItems.has(`kr-${kr.id}`)) {
          items.push({ key: `kr-${kr.id}`, label: `${obj.label} ${kr.label}`, color: CHART_COLORS[colorIdx++ % CHART_COLORS.length], isObjective: false, krId: kr.id });
        }
      }
    }
    return items;
  }, [objectives, selectedItems]);

  const rechartsData = useMemo(() => {
    if (!range || periods.length === 0) return [];
    return periods.map(p => {
      const point: Record<string, string | number | null> = { period: `${p.quarter} ${p.year}` };
      for (const item of chartItems) {
        if (item.isObjective && item.objId) {
          const obj = objectives.find(o => o.id === item.objId);
          if (!obj) { point[item.key] = null; continue; }
          const vals = obj.keyResults.map(kr => {
            const dp = kr.datapoints.find(d => d.quarter === p.quarter && d.year === p.year);
            return dp?.progressPercent ?? null;
          }).filter(v => v !== null) as number[];
          point[item.key] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        } else if (!item.isObjective && item.krId) {
          const kr = allKRs.find(k => k.id === item.krId);
          const dp = kr?.datapoints.find(d => d.quarter === p.quarter && d.year === p.year);
          point[item.key] = dp?.progressPercent ?? null;
        }
      }
      return point;
    });
  }, [periods, chartItems, objectives, allKRs, range]);

  const toggleItem = (key: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const hasChartData = range && periods.length > 0 && objectives.length > 0;

  return (
    <div className="space-y-6">
      {lastUpdated && (
        <p className="text-center text-sm text-muted-foreground" data-testid="text-strategic-last-updated">
          Last Updated: {lastUpdated}
        </p>
      )}

      {objectives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <Target className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-lg font-medium">No strategic objectives configured yet.</p>
          <p className="text-sm mt-1">An administrator can add objectives in the Strategic Planning section.</p>
        </div>
      ) : !hasChartData ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-lg font-medium">No chart data configured yet.</p>
          <p className="text-sm mt-1">An administrator can set the date range and enter progress data in the Strategic Planning section.</p>
        </div>
      ) : (
        <>
          {/* Item selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Select Items to Display
              </CardTitle>
              <CardDescription className="text-xs">Click objectives or individual key results to toggle lines on the chart</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {objectives.map(obj => (
                <div key={obj.id} className="space-y-2">
                  <button
                    onClick={() => toggleItem(`obj-${obj.id}`)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-opacity ${selectedItems.has(`obj-${obj.id}`) ? "opacity-100" : "opacity-40"}`}
                    style={{ borderColor: "currentColor", color: CHART_COLORS[objectives.indexOf(obj) % CHART_COLORS.length] }}
                    data-testid={`toggle-objective-${obj.id}`}
                  >
                    <span className="font-mono">{obj.label}</span>
                    <span>{obj.description}</span>
                    <span className="text-muted-foreground ml-1">(avg)</span>
                  </button>
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {obj.keyResults.map(kr => (
                      <button
                        key={kr.id}
                        onClick={() => toggleItem(`kr-${kr.id}`)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-opacity ${selectedItems.has(`kr-${kr.id}`) ? "opacity-100" : "opacity-40"}`}
                        style={{ borderColor: "currentColor", color: CHART_COLORS[(objectives.indexOf(obj) * 3 + obj.keyResults.indexOf(kr) + objectives.length) % CHART_COLORS.length] }}
                        data-testid={`toggle-kr-${kr.id}`}
                      >
                        <span className="font-mono">{kr.label}</span>
                        <span>{kr.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Strategic Progress Over Time</CardTitle>
              <CardDescription>
                {range.startQuarter} {range.startYear} — {range.endQuarter} {range.endYear} &nbsp;·&nbsp; 0% = start of period, 100% = full completion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <p className="text-sm">Select at least one item above to display it on the chart.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={rechartsData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={45} />
                    <Tooltip
                      formatter={(value: unknown, name: string) => [value != null ? `${value}%` : "—", name]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" opacity={0.4} />
                    {chartItems.map(item => (
                      <Line
                        key={item.key}
                        type="monotone"
                        dataKey={item.key}
                        name={item.label}
                        stroke={item.color}
                        strokeWidth={item.isObjective ? 2.5 : 1.5}
                        strokeDasharray={item.isObjective ? undefined : "4 2"}
                        dot={{ r: 3, fill: item.color }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Comments per objective */}
          {objectives.some(o => o.comment) && (
            <div className="space-y-4">
              {objectives.filter(o => o.comment).map(obj => (
                <Card key={obj.id} data-testid={`card-objective-comment-${obj.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">{obj.label}</Badge>
                      <span>{obj.description}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-objective-comment-${obj.id}`}>
                      {obj.comment}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UniversityAchievement() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">University Achievement</h1>
        <p className="text-muted-foreground mt-1">
          Track progress, performance, and historical trends across all SPUs
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList data-testid="tabs-achievement">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Analytics</TabsTrigger>
          <TabsTrigger value="strategic-advancement" data-testid="tab-strategic-advancement">Strategic Advancement</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="trends">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="strategic-advancement">
          <StrategicAdvancementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
