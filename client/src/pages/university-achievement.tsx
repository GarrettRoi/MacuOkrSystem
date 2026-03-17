import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Target, AlertTriangle, Search, X, Filter, Calendar } from "lucide-react";
import type { OkrWithDetails, QuarterlyUpdate, Spu, Year, StrategicAdvancementData } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear, PLANNING_YEARS } from "@shared/schema";

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
    const hasRecentUpdate = updates?.some((update) => {
      const quarterMatch = update.quarter === quarterFilter;
      const yearMatch = yearFilter === "All" || update.year === Number(yearFilter);
      return update.okrId === okr.id && quarterMatch && yearMatch;
    });
    return !hasRecentUpdate && quarterFilter !== "All";
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

function StrategicAdvancementTab() {
  const { data, isLoading } = useQuery<StrategicAdvancementData>({
    queryKey: ["/api/strategic-advancement"],
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const objectives = data?.objectives ?? [];
  const lastUpdated = formatDate(data?.lastUpdated ?? null);

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
      ) : (
        objectives.map((obj) => (
          <Card key={obj.id} data-testid={`card-objective-${obj.id}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs shrink-0">{obj.label}</Badge>
                <span>{obj.description}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {obj.keyResults.length > 0 && (
                <div className="space-y-3">
                  {obj.keyResults.map((kr) => (
                    <div key={kr.id} className="space-y-1" data-testid={`kr-progress-${kr.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          <span className="text-muted-foreground font-mono mr-1">{kr.label}</span>
                          {kr.description}
                        </span>
                        <span className="text-sm font-semibold tabular-nums shrink-0" data-testid={`text-kr-percent-${kr.id}`}>
                          {kr.progressPercent}%
                        </span>
                      </div>
                      <Progress value={kr.progressPercent} className="h-2" data-testid={`progress-kr-${kr.id}`} />
                    </div>
                  ))}
                </div>
              )}

              {obj.comment && (
                <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-objective-comment-${obj.id}`}>
                  {obj.comment}
                </div>
              )}
            </CardContent>
          </Card>
        ))
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
          <TabsTrigger value="trends" data-testid="tab-trends">Historical Trends</TabsTrigger>
          <TabsTrigger value="strategic-advancement" data-testid="tab-strategic-advancement">Strategic Advancement</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="trends">
          <TrendsTab />
        </TabsContent>

        <TabsContent value="strategic-advancement">
          <StrategicAdvancementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
