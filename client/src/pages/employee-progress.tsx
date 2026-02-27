import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, X, ChevronRight, Building2, Users, Target, CheckSquare, Square } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressSummary, EmployeeProgressRecord, Year, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { QUARTERS, getQuarterLabel, parseMultiSelectField, getPlanningYear, PLANNING_YEARS } from "@shared/schema";

interface SpuGroup {
  spuName: string;
  spuId: string;
  subUnits: {
    subUnitName: string;
    subUnitId: string | null;
    okrs: EmployeeProgressRecord[];
  }[];
  allOkrs: EmployeeProgressRecord[];
  overallProgress: number;
}

interface AggregatedOkr {
  id: string;
  okrNumber: string;
  objectiveStatement: string;
  universityObjective: string;
  universityKeyResult: string;
  keyResults: string;
  quarter: string;
  year: number;
  staffId: string | null;
  spuId: string;
  subUnitId: string | null;
  derivedProgress: number;
  staff: { name: string };
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
    isCollaborativeScore: boolean | null;
    scorerName: string | null;
  }>;
}

interface EmployeeProgressProps {
  staff: StaffWithDetails;
}

export default function EmployeeProgress({ staff }: EmployeeProgressProps) {
  // ── All OKRs tab state ──────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedPlanningYear, setSelectedPlanningYear] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedSpuId, setSelectedSpuId] = useState<string>("");

  // ── University Dashboard tab state ──────────────────────────────────────
  const [selectedObjectiveLabels, setSelectedObjectiveLabels] = useState<Set<string>>(new Set());
  const [uniYear, setUniYear] = useState<string>("");
  const [uniQuarter, setUniQuarter] = useState<string>("");
  const [uniSpu, setUniSpu] = useState<string>("");

  // ── Shared data ─────────────────────────────────────────────────────────
  const { data: years } = useQuery<Year[]>({ queryKey: ["/api/years"] });
  const { data: spus } = useQuery<Spu[]>({ queryKey: ["/api/spus"] });
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const { data: universityObjectives } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const { data: okrsWithUpdates, isLoading: okrsLoading } = useQuery<AggregatedOkr[]>({
    queryKey: ["/api/okrs-with-updates"],
  });

  // ── All OKRs tab data ───────────────────────────────────────────────────
  const queryParams = new URLSearchParams();
  if (selectedYear && selectedYear !== "all") queryParams.append("year", selectedYear);
  if (selectedQuarter && selectedQuarter !== "all") queryParams.append("quarter", selectedQuarter);
  if (selectedStaffId && selectedStaffId !== "all") queryParams.append("staffId", selectedStaffId);
  if (selectedSpuId && selectedSpuId !== "all") queryParams.append("spuId", selectedSpuId);

  const { data: progressSummaries, isLoading: progressLoading } = useQuery<EmployeeProgressSummary[]>({
    queryKey: ["/api/employee-progress/grouped", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/employee-progress/grouped?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch employee progress");
      return response.json();
    },
  });

  const clearFilters = () => {
    setSelectedYear("");
    setSelectedQuarter("");
    setSelectedPlanningYear("");
    setSelectedStaffId("");
    setSelectedSpuId("");
  };

  const activeFiltersCount = [selectedYear, selectedQuarter, selectedPlanningYear, selectedStaffId, selectedSpuId]
    .filter(v => v && v !== "all").length;

  const getKeyResults = (keyResultsJson: string) => {
    try { return JSON.parse(keyResultsJson); } catch { return []; }
  };

  const totalProgress = progressSummaries && progressSummaries.length > 0
    ? Math.round(progressSummaries.reduce((sum, s) => sum + s.overallProgress, 0) / progressSummaries.length)
    : 0;

  const spuGroups: SpuGroup[] = useMemo(() => {
    if (!progressSummaries) return [];
    let allOkrs: EmployeeProgressRecord[] = progressSummaries.flatMap(s => s.okrs);
    if (selectedPlanningYear && selectedPlanningYear !== "all") {
      const pyNum = parseInt(selectedPlanningYear);
      allOkrs = allOkrs.filter(r => getPlanningYear(r.okr.quarter, r.okr.year, planStartYear) === pyNum);
    }
    const spuMap: Record<string, { spuName: string; spuId: string; subMap: Record<string, { subUnitName: string; subUnitId: string | null; okrs: EmployeeProgressRecord[] }> }> = {};
    for (const record of allOkrs) {
      const spuId = record.okr.spuId || record.okr.staff?.spuId || "unknown";
      const spuName = record.okr.spu?.name || record.okr.staff?.spu?.name || "Unknown SPU";
      const subUnitId = record.okr.subUnitId || null;
      const subUnitName = record.okr.subUnit?.name || "No Sub-Unit";
      if (!spuMap[spuId]) spuMap[spuId] = { spuName, spuId, subMap: {} };
      const subKey = subUnitId || "__none__";
      if (!spuMap[spuId].subMap[subKey]) spuMap[spuId].subMap[subKey] = { subUnitName, subUnitId, okrs: [] };
      spuMap[spuId].subMap[subKey].okrs.push(record);
    }
    return Object.values(spuMap).map(spu => {
      const subUnits = Object.values(spu.subMap).sort((a, b) => {
        if (a.subUnitId === null) return 1;
        if (b.subUnitId === null) return -1;
        return a.subUnitName.localeCompare(b.subUnitName);
      });
      const okrsList = subUnits.flatMap(s => s.okrs);
      const prog = okrsList.length > 0
        ? Math.round(okrsList.reduce((sum, r) => sum + (r.latestUpdate?.averageScore || 0), 0) / okrsList.length)
        : 0;
      return { spuName: spu.spuName, spuId: spu.spuId, subUnits, allOkrs: okrsList, overallProgress: prog };
    }).sort((a, b) => a.spuName.localeCompare(b.spuName));
  }, [progressSummaries, selectedPlanningYear, planStartYear]);

  const getPeriodLabel = () => {
    if (selectedQuarter && selectedQuarter !== "all" && selectedYear && selectedYear !== "all")
      return `${getQuarterLabel(selectedQuarter)} ${selectedYear}`;
    if (selectedYear && selectedYear !== "all") return selectedYear;
    if (selectedQuarter && selectedQuarter !== "all") return getQuarterLabel(selectedQuarter);
    return "All Periods";
  };

  const totalOkrCount = spuGroups.reduce((sum, g) => sum + g.allOkrs.length, 0);

  // ── University Dashboard logic ──────────────────────────────────────────
  const activeObjectives = useMemo(
    () => (universityObjectives || []).filter(o => o.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [universityObjectives]
  );

  const toggleObjective = (label: string) => {
    setSelectedObjectiveLabels(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const selectAllObjectives = () => setSelectedObjectiveLabels(new Set(activeObjectives.map(o => o.label)));
  const clearObjectives = () => setSelectedObjectiveLabels(new Set());

  const uniFilteredOkrs = useMemo(() => {
    if (!okrsWithUpdates || selectedObjectiveLabels.size === 0) return [];
    return okrsWithUpdates.filter(okr => {
      const objValues = parseMultiSelectField(okr.universityObjective);
      const matchesObjective = objValues.some(v => {
        const label = v.split(":")[0]?.trim();
        return label && selectedObjectiveLabels.has(label);
      });
      if (!matchesObjective) return false;
      if (uniYear && uniYear !== "all" && String(okr.year) !== uniYear) return false;
      if (uniQuarter && uniQuarter !== "all" && okr.quarter !== uniQuarter) return false;
      if (uniSpu && uniSpu !== "all" && okr.spuId !== uniSpu) return false;
      return true;
    });
  }, [okrsWithUpdates, selectedObjectiveLabels, uniYear, uniQuarter, uniSpu]);

  const uniActiveFilters = [uniYear, uniQuarter, uniSpu].filter(v => v && v !== "all").length;

  const clearUniFilters = () => { setUniYear(""); setUniQuarter(""); setUniSpu(""); };

  const getOkrObjectiveLabels = (okr: AggregatedOkr): string[] =>
    parseMultiSelectField(okr.universityObjective).map(v => v.split(":")[0]?.trim()).filter(Boolean);

  const getPrimaryUpdate = (okr: AggregatedOkr) =>
    okr.quarterlyUpdates.find(u => u.isPrimaryScore !== false) ||
    okr.quarterlyUpdates[0] ||
    null;

  return (
    <div className="bg-background min-h-screen">
      <Tabs defaultValue="all-okrs" className="flex flex-col min-h-screen">
        {/* Sticky combined header + tab bar */}
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between py-2 gap-4">
              <TabsList className="h-9">
                <TabsTrigger value="all-okrs" className="text-sm" data-testid="tab-all-okrs">All OKRs</TabsTrigger>
                <TabsTrigger value="university-dashboard" className="text-sm" data-testid="tab-university-dashboard">University Dashboard</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* ── ALL OKRs TAB ────────────────────────────────────────────── */}
        <TabsContent value="all-okrs" className="flex-1 m-0">
          {/* Sub-header with stats + filters */}
          <div className="border-b bg-card">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between py-3 gap-4">
                <div>
                  <h1 className="text-lg font-bold leading-tight">All OKRs</h1>
                  <p className="text-xs text-muted-foreground">{getPeriodLabel()} · {totalOkrCount} OKRs across {spuGroups.length} SPUs</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums">{totalProgress}%</div>
                  <div className="text-xs text-muted-foreground">Overall Progress</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <Select value={selectedYear || "all"} onValueChange={v => setSelectedYear(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-28" data-testid="select-filter-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years?.sort((a, b) => b.year - a.year).map(y => (
                      <SelectItem key={y.id} value={String(y.year)}>{y.year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedQuarter || "all"} onValueChange={v => setSelectedQuarter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-28" data-testid="select-filter-quarter">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quarters</SelectItem>
                    {QUARTERS.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPlanningYear || "all"} onValueChange={v => setSelectedPlanningYear(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-32" data-testid="select-filter-planning-year">
                    <SelectValue placeholder="Plan Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plan years</SelectItem>
                    {PLANNING_YEARS.map(py => (
                      <SelectItem key={py} value={String(py)}>Year {py}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedSpuId || "all"} onValueChange={v => setSelectedSpuId(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-40" data-testid="select-filter-spu">
                    <SelectValue placeholder="All SPUs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SPUs</SelectItem>
                    {spus?.map(spu => (
                      <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1" data-testid="button-clear-filters">
                    <X className="h-3 w-3" />
                    Clear {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-2">
            {progressLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : spuGroups.length === 0 ? (
              <Card>
                <CardContent className="p-16 text-center">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold mb-1">No OKRs Found</h3>
                  <p className="text-sm text-muted-foreground">No OKRs match your current filters.</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                {spuGroups.map((spuGroup, spuIndex) => (
                  <AccordionItem
                    key={spuGroup.spuId}
                    value={`spu-${spuIndex}`}
                    className="border rounded-lg overflow-hidden bg-card"
                    data-testid={`accordion-spu-${spuGroup.spuId}`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover-elevate [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-base truncate">{spuGroup.spuName}</span>
                          <Badge variant="secondary" className="shrink-0 text-xs">{spuGroup.allOkrs.length} OKRs</Badge>
                          {spuGroup.subUnits.filter(s => s.subUnitId !== null).length > 0 && (
                            <Badge variant="outline" className="shrink-0 text-xs hidden sm:inline-flex">
                              {spuGroup.subUnits.filter(s => s.subUnitId !== null).length} Sub-Units
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex items-center gap-2 w-32">
                            <Progress value={spuGroup.overallProgress} className="h-1.5 flex-1" />
                          </div>
                          <span className="text-lg font-bold tabular-nums w-14 text-right">{spuGroup.overallProgress}%</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      {spuGroup.subUnits.map((subUnit) => (
                        <div key={subUnit.subUnitId || "__none__"} className="border-t">
                          {(spuGroup.subUnits.length > 1 || subUnit.subUnitId !== null) && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{subUnit.subUnitName}</span>
                              <span className="text-xs text-muted-foreground">· {subUnit.okrs.length} OKRs</span>
                            </div>
                          )}
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm" data-testid={`table-spu-${spuGroup.spuId}-sub-${subUnit.subUnitId || "none"}`}>
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">#</th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objective</th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 hidden lg:table-cell">Owner</th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40 hidden xl:table-cell">Strategic Alignment</th>
                                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28 hidden md:table-cell">Period</th>
                                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {subUnit.okrs.map((record) => {
                                  const keyResults = getKeyResults(record.okr.keyResults || "[]");
                                  const latestScore = record.latestUpdate?.averageScore;
                                  const owner = record.responsibilities.find((r: any) => r.role === 'owner')?.staff.name || record.okr.staff.name;
                                  const collaborators = record.responsibilities.filter((r: any) => r.role === 'collaborator').map((r: any) => r.staff.name);
                                  const strategicObjs = parseMultiSelectField(record.okr.universityObjective).map(o => o.split(":")[0]?.trim()).filter(Boolean);
                                  const hasScore = latestScore !== null && latestScore !== undefined;
                                  return (
                                    <tr key={record.okr.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-okr-${record.okr.id}`}>
                                      <td className="px-3 py-3 align-top">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-semibold text-xs text-foreground">{record.okr.okrNumber}</span>
                                          {record.okr.subUnit && (
                                            <span className="text-xs text-muted-foreground hidden sm:block">{record.okr.subUnit.name}</span>
                                          )}
                                          {record.okr.collaborationSpu && (
                                            <Badge variant="outline" className="text-xs w-fit px-1 py-0">Collab</Badge>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-3 align-top max-w-sm">
                                        <p className="font-medium text-sm leading-snug">{record.okr.objectiveStatement}</p>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                                          {keyResults.length > 0 && (
                                            <span className="text-xs text-muted-foreground">{keyResults.length} key result{keyResults.length !== 1 ? "s" : ""}</span>
                                          )}
                                          {collaborators.length > 0 && (
                                            <span className="text-xs text-muted-foreground">Collaborators: {collaborators.join(", ")}</span>
                                          )}
                                          {record.okr.collaborationSpu && (
                                            <span className="text-xs text-muted-foreground">Collab SPU: {record.okr.collaborationSpu.name}</span>
                                          )}
                                          {record.latestUpdate && (
                                            <span className="text-xs text-muted-foreground">
                                              Updated {new Date(record.latestUpdate.submittedAt).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-3 align-top hidden lg:table-cell">
                                        <span className="text-sm">{owner}</span>
                                      </td>
                                      <td className="px-3 py-3 align-top hidden xl:table-cell">
                                        {strategicObjs.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {strategicObjs.map((obj, i) => (
                                              <Badge key={i} variant="outline" className="text-xs px-1.5 py-0 font-normal">{obj}</Badge>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-3 align-top hidden md:table-cell">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">{record.okr.quarter} {record.okr.year}</span>
                                      </td>
                                      <td className="px-3 py-3 align-top text-right">
                                        {hasScore ? (
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-base font-bold tabular-nums">{latestScore}%</span>
                                            <div className="w-14">
                                              <Progress value={latestScore} className="h-1" />
                                            </div>
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
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

        {/* ── UNIVERSITY DASHBOARD TAB ────────────────────────────────── */}
        <TabsContent value="university-dashboard" className="flex-1 m-0">
          <div className="border-b bg-card">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h1 className="text-lg font-bold">University Dashboard</h1>
                  <p className="text-xs text-muted-foreground">
                    {selectedObjectiveLabels.size === 0
                      ? "Select one or more university strategic objectives below"
                      : `${selectedObjectiveLabels.size} objective${selectedObjectiveLabels.size !== 1 ? "s" : ""} selected · ${uniFilteredOkrs.length} aligned OKRs`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={selectAllObjectives} className="h-8 text-xs" data-testid="button-select-all-objectives">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearObjectives} className="h-8 text-xs" data-testid="button-clear-objectives">
                    <Square className="h-3 w-3 mr-1" />
                    None
                  </Button>
                </div>
              </div>

              {/* Objective selector */}
              {activeObjectives.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No university strategic objectives configured.</p>
              ) : (
                <div className="flex flex-wrap gap-2 pb-3">
                  {activeObjectives.map(obj => {
                    const isSelected = selectedObjectiveLabels.has(obj.label);
                    const alignedCount = okrsWithUpdates?.filter(okr =>
                      parseMultiSelectField(okr.universityObjective).some(v => v.split(":")[0]?.trim() === obj.label)
                    ).length || 0;
                    return (
                      <button
                        key={obj.id}
                        onClick={() => toggleObjective(obj.label)}
                        data-testid={`button-objective-${obj.id}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        <Target className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">{obj.label}</span>
                        {alignedCount > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-sm ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {alignedCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filters */}
              {selectedObjectiveLabels.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  <Select value={uniYear || "all"} onValueChange={v => setUniYear(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs w-28" data-testid="select-uni-filter-year">
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
                    <SelectTrigger className="h-8 text-xs w-28" data-testid="select-uni-filter-quarter">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All quarters</SelectItem>
                      {QUARTERS.map(q => (
                        <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={uniSpu || "all"} onValueChange={v => setUniSpu(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs w-40" data-testid="select-uni-filter-spu">
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
                <table className="w-full border-collapse text-sm" data-testid="table-university-okrs">
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
                        <React.Fragment key={okr.id}>
                          <tr className="hover:bg-muted/20 transition-colors" data-testid={`row-uni-okr-${okr.id}`}>
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
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
