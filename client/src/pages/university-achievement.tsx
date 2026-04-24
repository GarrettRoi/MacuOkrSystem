import React, { useState, useEffect, useMemo } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
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
import { TrendingUp, Target, AlertTriangle, Search, X, Filter, Calendar, Building2, Users, ChevronRight, ChevronDown } from "lucide-react";
import type { OkrWithDetails, QuarterlyUpdate, Spu, Year, StrategicAdvancementData, StrategicChartData, AnalyticsDashboardWithWidgets, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { parseMultiSelectField, getPlanningYear, PLANNING_YEARS, QUARTERS as SCHEMA_QUARTERS } from "@shared/schema";
import { AnalyticsWidgetCard } from "@/components/analytics-widget";
import { generateQuarterPeriods, CHART_COLORS } from "@/lib/utils";

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];

function DashboardTab() {
  const [quarterFilter, setQuarterFilter] = usePersistedFilter("ua-dash:quarter", "All");
  const [yearFilter, setYearFilter] = usePersistedFilter("ua-dash:year", "All");
  const [planningYearFilter, setPlanningYearFilter] = usePersistedFilter("ua-dash:planningYear", "All");
  const [spuFilter, setSpuFilter] = usePersistedFilter("ua-dash:spu", "All");
  const [keywordSearch, setKeywordSearch] = usePersistedFilter("ua-dash:keyword", "");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [spuSearch, setSpuSearch] = useState<string>("");
  const [selectedSpuId, setSelectedSpuId] = useState<string | null>(null);
  const [expandedOkrIds, setExpandedOkrIds] = useState<Set<string>>(new Set());

  const toggleOkrExpand = (id: string) =>
    setExpandedOkrIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

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
    setSelectedSpuId(null);
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

  const getKeyResults = (keyResultsJson: string) => {
    try { return JSON.parse(keyResultsJson); } catch { return []; }
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
      id: spu.id,
      name: spu.name,
      progress: avgProg,
      count: spuOkrs.length,
    };
  }).filter((s) => s.count > 0) || [];

  const filteredSpuProgress = spuProgress.filter((spu) =>
    spu.name.toLowerCase().includes(spuSearch.toLowerCase())
  );

  const selectedSpuOkrs = useMemo(() => {
    if (!selectedSpuId) return [];
    const spuOkrs = filteredOkrs.filter(okr => okr.spuId === selectedSpuId);
    const subMap: Record<string, { subUnitName: string; subUnitId: string | null; okrs: OkrWithDetails[] }> = {};
    for (const okr of spuOkrs) {
      const subKey = okr.subUnitId || "__none__";
      const subUnitName = okr.subUnit?.name || "No Sub-Unit";
      if (!subMap[subKey]) subMap[subKey] = { subUnitName, subUnitId: okr.subUnitId || null, okrs: [] };
      subMap[subKey].okrs.push(okr);
    }
    return Object.values(subMap).sort((a, b) => {
      if (a.subUnitId === null) return 1;
      if (b.subUnitId === null) return -1;
      return a.subUnitName.localeCompare(b.subUnitName);
    });
  }, [selectedSpuId, filteredOkrs]);

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

        {/* Cards chunked into rows so the drilldown can appear inline after its row */}
        {(() => {
          const COLS = 3;
          const selectedIdx = selectedSpuId
            ? filteredSpuProgress.findIndex(s => s.id === selectedSpuId)
            : -1;
          const selectedRow = selectedIdx >= 0 ? Math.floor(selectedIdx / COLS) : -1;
          const rows: typeof filteredSpuProgress[] = [];
          for (let i = 0; i < filteredSpuProgress.length; i += COLS) {
            rows.push(filteredSpuProgress.slice(i, i + COLS));
          }
          const spuName = selectedSpuId ? spuProgress.find(s => s.id === selectedSpuId)?.name || "" : "";
          const totalSpuOkrs = selectedSpuOkrs.reduce((sum, s) => sum + s.okrs.length, 0);

          return rows.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {row.map((spu) => {
                  const isSelected = selectedSpuId === spu.id;
                  return (
                    <Card
                      key={spu.name}
                      data-testid={`card-spu-${spu.name}`}
                      className={`cursor-pointer transition-colors hover-elevate ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedSpuId(isSelected ? null : spu.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{spu.name}</CardTitle>
                          {isSelected && <ChevronDown className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <CardDescription>{spu.count} OKR{spu.count !== 1 ? "s" : ""} · click to view</CardDescription>
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
                  );
                })}
              </div>

              {/* Drilldown — only shown under the row containing the selected card */}
              {selectedRow === rowIndex && selectedSpuId && (
                <div className="border rounded-lg overflow-hidden" data-testid={`section-spu-drill-${selectedSpuId}`}>
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-base">{spuName}</span>
                    <Badge variant="secondary" className="text-xs">{totalSpuOkrs} OKR{totalSpuOkrs !== 1 ? "s" : ""}</Badge>
                    <button
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedSpuId(null)}
                      data-testid="button-close-drill"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {selectedSpuOkrs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No OKRs match the current filters for this SPU.</div>
                  ) : (
                    selectedSpuOkrs.map((subUnit) => (
                      <div key={subUnit.subUnitId || "__none__"} className="border-t first:border-t-0">
                        {(selectedSpuOkrs.length > 1 || subUnit.subUnitId !== null) && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-b">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{subUnit.subUnitName}</span>
                            <span className="text-xs text-muted-foreground">· {subUnit.okrs.length} OKR{subUnit.okrs.length !== 1 ? "s" : ""}</span>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm" data-testid={`table-drill-${subUnit.subUnitId || "none"}`}>
                            <thead>
                              <tr className="border-b bg-muted/10">
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">#</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objective</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 hidden lg:table-cell">Owner</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28 hidden md:table-cell">Period</th>
                                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {subUnit.okrs.map((okr) => {
                                const progress = getOkrProgress(okr.id);
                                const hasScore = updates?.some(u => u.okrId === okr.id);
                                const krs = getKeyResults(okr.keyResults || "[]");
                                const isExpanded = expandedOkrIds.has(okr.id);
                                return (
                                  <React.Fragment key={okr.id}>
                                    <tr
                                      className={`cursor-pointer transition-colors ${isExpanded ? "bg-muted/30" : "hover:bg-muted/20"}`}
                                      onClick={() => toggleOkrExpand(okr.id)}
                                      data-testid={`row-drill-okr-${okr.id}`}
                                    >
                                      <td className="px-4 py-3 align-top">
                                        <div className="flex items-center gap-1">
                                          {isExpanded
                                            ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                            : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                          <span className="font-semibold text-xs">{okr.okrNumber}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 align-top max-w-sm">
                                        <p className="font-medium text-sm leading-snug">{okr.objectiveStatement}</p>
                                        {krs.length > 0 && (
                                          <span className="text-xs text-muted-foreground">{krs.length} key result{krs.length !== 1 ? "s" : ""}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 align-top hidden lg:table-cell">
                                        <span className="text-sm">{okr.staff?.name || "—"}</span>
                                      </td>
                                      <td className="px-4 py-3 align-top hidden md:table-cell">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">{okr.quarter} {okr.year}</span>
                                      </td>
                                      <td className="px-4 py-3 align-top text-right">
                                        {hasScore ? (
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-base font-bold tabular-nums">{progress}%</span>
                                            <div className="w-14"><Progress value={progress} className="h-1" /></div>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">No score</span>
                                        )}
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr className="bg-muted/10" data-testid={`row-drill-detail-${okr.id}`}>
                                        <td colSpan={5} className="px-6 py-4">
                                          {krs.length > 0 ? (
                                            <div className="space-y-1">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Key Results</p>
                                              {krs.map((kr: any, i: number) => (
                                                <p key={i} className="text-xs text-foreground leading-snug pl-2 border-l-2 border-muted">
                                                  KR {i + 1}: {typeof kr === "string" ? kr : kr.description}
                                                </p>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-muted-foreground italic">No key results.</p>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </React.Fragment>
          ));
        })()}
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

interface OkrWithUpdates {
  id: string;
  okrNumber: string;
  objectiveStatement: string;
  universityObjective: string;
  universityKeyResult: string;
  keyResults: string;
  quarter: string;
  year: number;
  spuId: string;
  subUnitId: string | null;
  staff: { name: string } | null;
  spu: { name: string } | null;
  subUnit: { name: string } | null;
  quarterlyUpdates: Array<{
    id: string;
    quarter: string;
    year: number;
    averageScore: number | null;
    notes: string;
    submittedAt: string;
    isPrimaryScore: boolean | null;
    scorerName: string | null;
  }>;
}

function ObjectiveResultsTab() {
  const [selectedObjectiveLabels, setSelectedObjectiveLabels] = useState<Set<string>>(new Set());
  const [uniYear, setUniYear] = usePersistedFilter("ua-obj:year", "");
  const [uniQuarter, setUniQuarter] = usePersistedFilter("ua-obj:quarter", "");
  const [uniSpu, setUniSpu] = usePersistedFilter("ua-obj:spu", "");

  const { data: universityObjectives } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });
  const { data: okrsWithUpdates, isLoading: okrsLoading } = useQuery<OkrWithUpdates[]>({
    queryKey: ["/api/okrs-with-updates"],
  });
  const { data: years } = useQuery<Year[]>({ queryKey: ["/api/years"] });
  const { data: spus } = useQuery<Spu[]>({ queryKey: ["/api/spus"] });

  const activeObjectives = useMemo(
    () => (universityObjectives || []).filter(o => o.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [universityObjectives]
  );

  // Normalizes any objective label/value to a canonical "Objective N" key.
  // Accepts forms like "Objective 1: ...", "University Objective 1", "Objective 1", etc.
  const normalizeObjPrefix = (s: string): string => {
    const head = (s.split(":")[0] ?? s).trim();
    const match = head.match(/objective\s*(\d+)/i);
    return match ? `Objective ${match[1]}` : head;
  };

  // Parse a universityObjective field into individual objective prefix strings.
  // Handles JSON arrays, single strings, and comma-separated strings like
  // "Objective 1: desc, Objective 2: desc" stored by the TSV import.
  const parseObjPrefixes = (raw: string): string[] => {
    const items = parseMultiSelectField(raw);
    const prefixes: string[] = [];
    for (const item of items) {
      // If a single item contains ", Objective" it's likely a comma-joined TSV value
      if (/,\s*Objective\s+\d/i.test(item)) {
        // Split on boundaries where a comma is followed by "Objective N"
        const parts = item.split(/,\s*(?=Objective\s+\d)/i);
        for (const part of parts) {
          const p = normalizeObjPrefix(part);
          if (p) prefixes.push(p);
        }
      } else {
        const p = normalizeObjPrefix(item);
        if (p) prefixes.push(p);
      }
    }
    return prefixes;
  };

  const toggleObjective = (label: string) => {
    const key = normalizeObjPrefix(label);
    setSelectedObjectiveLabels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const uniFilteredOkrs = useMemo(() => {
    if (!okrsWithUpdates || selectedObjectiveLabels.size === 0) return [];
    return okrsWithUpdates.filter(okr => {
      const prefixes = parseObjPrefixes(okr.universityObjective);
      const matchesObjective = prefixes.some(p => selectedObjectiveLabels.has(p));
      if (!matchesObjective) return false;
      if (uniYear && uniYear !== "all" && String(okr.year) !== uniYear) return false;
      if (uniQuarter && uniQuarter !== "all" && okr.quarter !== uniQuarter) return false;
      if (uniSpu && uniSpu !== "all" && okr.spuId !== uniSpu) return false;
      return true;
    });
  }, [okrsWithUpdates, selectedObjectiveLabels, uniYear, uniQuarter, uniSpu]);

  const uniActiveFilters = [uniYear, uniQuarter, uniSpu].filter(v => v && v !== "all").length;
  const clearUniFilters = () => { setUniYear(""); setUniQuarter(""); setUniSpu(""); };

  const getOkrObjectiveLabels = (okr: OkrWithUpdates): string[] => parseObjPrefixes(okr.universityObjective);

  const getPrimaryUpdate = (okr: OkrWithUpdates) =>
    okr.quarterlyUpdates.find(u => u.isPrimaryScore !== false) ||
    okr.quarterlyUpdates[0] ||
    null;

  const getKeyResults = (keyResultsJson: string) => {
    try { return JSON.parse(keyResultsJson); } catch { return []; }
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-lg font-bold">Objective Results</h2>
              <p className="text-xs text-muted-foreground">
                {selectedObjectiveLabels.size === 0
                  ? "Select one or more university strategic objectives below"
                  : `${selectedObjectiveLabels.size} objective${selectedObjectiveLabels.size !== 1 ? "s" : ""} selected · ${uniFilteredOkrs.length} aligned OKRs`}
              </p>
            </div>
          </div>

          {/* Objective selector */}
          {activeObjectives.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No university strategic objectives configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pb-3">
              {activeObjectives.map(obj => {
                const objKey = normalizeObjPrefix(obj.label);
                const isSelected = selectedObjectiveLabels.has(objKey);
                const alignedCount = okrsWithUpdates?.filter(okr =>
                  parseObjPrefixes(okr.universityObjective).includes(objKey)
                ).length || 0;
                return (
                  <button
                    key={obj.id}
                    onClick={() => toggleObjective(obj.label)}
                    data-testid={`button-objective-${obj.id}`}
                    className={`flex flex-col items-start gap-1 px-4 py-3 rounded-md border text-left transition-colors flex-1 min-w-[240px] max-w-[400px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Target className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold text-sm">{obj.label}</span>
                      {alignedCount > 0 && (
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-sm shrink-0 ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {alignedCount} OKR{alignedCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs leading-snug ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {obj.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filters */}
          {selectedObjectiveLabels.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Select value={uniYear || "all"} onValueChange={v => setUniYear(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-28" data-testid="select-obj-filter-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {years?.sort((a, b) => b.year - a.year).map(y => (
                    <SelectItem key={y.id} value={String(y.year)}>{y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={uniQuarter || "all"} onValueChange={v => setUniQuarter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-28" data-testid="select-obj-filter-quarter">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All quarters</SelectItem>
                  {SCHEMA_QUARTERS.map(q => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={uniSpu || "all"} onValueChange={v => setUniSpu(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-40" data-testid="select-obj-filter-spu">
                  <SelectValue placeholder="All SPUs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SPUs</SelectItem>
                  {spus?.map(spu => (
                    <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {uniActiveFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearUniFilters} className="h-8 text-xs gap-1">
                  <X className="h-3 w-3" />
                  Clear {uniActiveFilters} filter{uniActiveFilters !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* OKR results */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {selectedObjectiveLabels.size === 0 ? (
          <Card>
            <CardContent className="p-16 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No Objectives Selected</h3>
              <p className="text-sm text-muted-foreground">Select one or more university strategic objectives above to see aligned SPU OKRs.</p>
            </CardContent>
          </Card>
        ) : okrsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : uniFilteredOkrs.length === 0 ? (
          <Card>
            <CardContent className="p-16 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No Aligned OKRs Found</h3>
              <p className="text-sm text-muted-foreground">No OKRs are aligned to the selected objective{selectedObjectiveLabels.size !== 1 ? "s" : ""} with the current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm" data-testid="table-objective-results-okrs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">OKR #</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objective Statement</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 hidden md:table-cell">SPU</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 hidden lg:table-cell">Submitter</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24 hidden md:table-cell">Period</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 hidden xl:table-cell">Aligned Objectives</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {uniFilteredOkrs.map(okr => {
                  const primaryUpdate = getPrimaryUpdate(okr);
                  const score = primaryUpdate?.averageScore;
                  const hasScore = score !== null && score !== undefined;
                  const objLabels = getOkrObjectiveLabels(okr);
                  const krs = getKeyResults(okr.keyResults || "[]");
                  return (
                    <tr key={okr.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-obj-okr-${okr.id}`}>
                      <td className="px-4 py-3 align-top">
                        <span className="font-semibold text-xs">{okr.okrNumber}</span>
                      </td>
                      <td className="px-4 py-3 align-top max-w-md">
                        <p className="font-medium text-sm leading-snug">{okr.objectiveStatement}</p>
                        {krs.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {krs.map((kr: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground leading-snug pl-2 border-l-2 border-muted">
                                KR {i + 1}: {typeof kr === "string" ? kr : kr.description}
                              </p>
                            ))}
                          </div>
                        )}
                        {primaryUpdate?.notes && (
                          <div className="mt-2 px-2 py-1.5 bg-muted/40 rounded text-xs text-muted-foreground leading-snug">
                            <span className="font-medium text-foreground">Notes: </span>
                            {primaryUpdate.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top hidden md:table-cell">
                        <span className="text-sm">{okr.spu?.name || "—"}</span>
                        {okr.subUnit && <p className="text-xs text-muted-foreground mt-0.5">{okr.subUnit.name}</p>}
                      </td>
                      <td className="px-4 py-3 align-top hidden lg:table-cell">
                        <span className="text-sm">{okr.staff?.name || "—"}</span>
                        {primaryUpdate?.scorerName && primaryUpdate.scorerName !== okr.staff?.name && (
                          <p className="text-xs text-muted-foreground mt-0.5">Scored by {primaryUpdate.scorerName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top hidden md:table-cell">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{okr.quarter} {okr.year}</span>
                      </td>
                      <td className="px-4 py-3 align-top hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {objLabels.map((lbl, i) => (
                            <Badge
                              key={i}
                              variant={selectedObjectiveLabels.has(lbl) ? "default" : "outline"}
                              className="text-xs px-1.5 py-0 font-normal"
                            >
                              {lbl}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {hasScore ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-base font-bold tabular-nums">{score}%</span>
                            <div className="w-14">
                              <Progress value={score} className="h-1" />
                            </div>
                            {okr.quarterlyUpdates.length > 1 && (
                              <span className="text-xs text-muted-foreground">{okr.quarterlyUpdates.length} scores</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No score</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold">Leadership Commentary</h3>
                <p className="text-xs text-muted-foreground">Notes from leadership on progress for the objectives below.</p>
              </div>
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

export function UniversityAchievementContent({ hideAnalytics = false }: { hideAnalytics?: boolean } = {}) {
  return (
    <Tabs defaultValue="dashboard" className="space-y-6">
      <TabsList data-testid="tabs-achievement">
        <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="objective-results" data-testid="tab-objective-results">Objective Results</TabsTrigger>
        {!hideAnalytics && (
          <TabsTrigger value="trends" data-testid="tab-trends">Analytics</TabsTrigger>
        )}
        <TabsTrigger value="strategic-advancement" data-testid="tab-strategic-advancement">Strategic Advancement</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <DashboardTab />
      </TabsContent>

      <TabsContent value="objective-results" className="space-y-0 mt-0">
        <ObjectiveResultsTab />
      </TabsContent>

      {!hideAnalytics && (
        <TabsContent value="trends">
          <AnalyticsTab />
        </TabsContent>
      )}

      <TabsContent value="strategic-advancement">
        <StrategicAdvancementTab />
      </TabsContent>
    </Tabs>
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

      <UniversityAchievementContent />
    </div>
  );
}
