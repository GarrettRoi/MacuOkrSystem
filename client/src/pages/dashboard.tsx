import { useState, useEffect } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, AlertTriangle, Search, X, Filter, CalendarClock } from "lucide-react";
import type { OkrWithDetails, QuarterlyUpdate, Spu } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear, PLANNING_YEARS } from "@shared/schema";

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const [quarterFilter, setQuarterFilter] = usePersistedFilter("dashboard:quarter", "All");
  const [yearFilter, setYearFilter] = usePersistedFilter("dashboard:year", "All");
  const [planningYearFilter, setPlanningYearFilter] = usePersistedFilter("dashboard:planningYear", "All");
  const [spuFilter, setSpuFilter] = usePersistedFilter("dashboard:spu", "All");
  const [keywordSearch, setKeywordSearch] = usePersistedFilter("dashboard:keyword", "");
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

  const { data: quarterlyDueDates } = useQuery<{ q1: string | null; q2: string | null; q3: string | null; q4: string | null }>({
    queryKey: ["/api/settings/quarterly-due-dates"],
  });

  const nextSubmission = (() => {
    if (!quarterlyDueDates) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidates: { quarter: string; date: Date; days: number }[] = [];
    (["q1", "q2", "q3", "q4"] as const).forEach((q) => {
      const raw = quarterlyDueDates[q];
      if (!raw) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
      const d = new Date(raw + "T00:00:00");
      const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        candidates.push({ quarter: q.toUpperCase(), date: d, days });
      }
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.days - b.days);
    return candidates[0];
  })();

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
  const avgProgress = totalOkrs > 0
    ? Math.round(filteredOkrs.reduce((sum, okr) => sum + getOkrProgress(okr.id), 0) / totalOkrs)
    : 0;
  
  const uniqueStaffWithOkrs = new Set(filteredOkrs.map((okr) => okr.staffId)).size;
  
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

  // Filter SPU progress by search term
  const filteredSpuProgress = spuProgress.filter((spu) =>
    spu.name.toLowerCase().includes(spuSearch.toLowerCase())
  );


  return (
    <div className="p-6 space-y-6">
      {nextSubmission && (
        <Card data-testid="card-submission-countdown" className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex flex-wrap items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Next OKR Submission Due
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  className="text-2xl font-bold tabular-nums"
                  data-testid="text-submission-countdown-days"
                >
                  {nextSubmission.days}
                </span>
                <span className="text-base">
                  {nextSubmission.days === 1 ? "day" : "days"} until {nextSubmission.quarter} submissions are due
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-submission-countdown-date">
                Due {nextSubmission.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">OKR Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Track progress and performance across all SPUs
            </p>
          </div>
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
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {showAdvancedFilters && (
          <Card data-testid="card-advanced-filters">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Advanced Filters</CardTitle>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-progress">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-staff">{uniqueStaffWithOkrs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Staff with OKRs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
            {filteredSpuProgress.map((spu, index) => (
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
