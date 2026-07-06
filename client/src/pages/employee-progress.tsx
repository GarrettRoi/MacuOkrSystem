import React, { useState, useMemo } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, X, ChevronRight, ChevronDown, Building2, Users, Target, MessageSquare } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressSummary, EmployeeProgressRecord, OkrResponsibilityWithDetails, Year, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { QUARTERS, getQuarterLabel, parseMultiSelectField, getPlanningYear, ALL_QUARTERS_LABEL, formatPlanYearLabel, formatPeriodLabel, getCalendarYearForQuarter, formatQuarterTagForPlanYear } from "@shared/schema";
import { usePlanningYears } from "@/hooks/use-planning-years";

interface SpuGroup {
  spuName: string;
  spuId: string;
  subUnits: {
    subUnitName: string;
    subUnitId: string | null;
    okrs: EmployeeProgressRecord[];
  }[];
  allOkrs: EmployeeProgressRecord[];
  overallProgress: number | null;
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
  actedByName: string | null;
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
    actedByName: string | null;
  }>;
}

interface EmployeeProgressProps {
  staff: StaffWithDetails;
}

export default function EmployeeProgress({ staff }: EmployeeProgressProps) {
  // ── All OKRs tab state ──────────────────────────────────────────────────
  const [selectedQuarter, setSelectedQuarter] = usePersistedFilter("emp-progress:quarter", "");
  const [selectedPlanningYear, setSelectedPlanningYear] = usePersistedFilter("emp-progress:planningYear", "");
  const [selectedStaffId, setSelectedStaffId] = usePersistedFilter("emp-progress:staffId", "");
  const [selectedSpuId, setSelectedSpuId] = usePersistedFilter("emp-progress:spuId", "");

  // ── University Dashboard tab state ──────────────────────────────────────
  const [selectedObjectiveLabels, setSelectedObjectiveLabels] = useState<Set<string>>(new Set());
  const [uniYear, setUniYear] = useState<string>("");
  const [uniQuarter, setUniQuarter] = useState<string>("");
  const [uniSpu, setUniSpu] = useState<string>("");

  // ── Expandable row state ────────────────────────────────────────────────
  const [expandedOkrIds, setExpandedOkrIds] = useState<Set<string>>(new Set());
  const toggleOkrExpand = (id: string) =>
    setExpandedOkrIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  // ── Shared data ─────────────────────────────────────────────────────────
  const { data: spus } = useQuery<Spu[]>({ queryKey: ["/api/spus"] });
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;
  const planningYears = usePlanningYears();

  const { data: universityObjectives } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const { data: okrsWithUpdates, isLoading: okrsLoading } = useQuery<AggregatedOkr[]>({
    queryKey: ["/api/okrs-with-updates"],
  });

  // ── All OKRs tab data ───────────────────────────────────────────────────
  const queryParams = new URLSearchParams();
  if (selectedQuarter && selectedQuarter !== "all") {
    queryParams.append("quarter", selectedQuarter);
    if (selectedPlanningYear && selectedPlanningYear !== "all") {
      queryParams.append("year", String(getCalendarYearForQuarter(parseInt(selectedPlanningYear), selectedQuarter, planStartYear)));
    }
  }
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
    setSelectedQuarter("");
    setSelectedPlanningYear("");
    setSelectedStaffId("");
    setSelectedSpuId("");
  };

  const activeFiltersCount = [selectedQuarter, selectedPlanningYear, selectedStaffId, selectedSpuId]
    .filter(v => v && v !== "all").length;

  const getKeyResults = (keyResultsJson: any) => {
    let arr: any[] = [];
    if (Array.isArray(keyResultsJson)) {
      arr = keyResultsJson;
    } else if (typeof keyResultsJson === 'string') {
      try { arr = JSON.parse(keyResultsJson); } catch { return []; }
    } else {
      return [];
    }
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) =>
      typeof item === 'string' ? { description: item } : item
    );
  };

  const getKrScores = (json: any): Array<{ keyResultNumber: number; description?: string; score: number }> => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (typeof json === 'string') {
      try { return JSON.parse(json); } catch { return []; }
    }
    return [];
  };

  // ── Headline "Overall Progress" ────────────────────────────────────────
  // Match the University Achievement page: average every scored OKR
  // equally (each OKR's latest primary averageScore) instead of taking
  // an average of per-staff averages, which over-weighted staff with
  // few OKRs. Computed below from spuGroups so it respects the same
  // planning-year filter that drives the visible breakdown.

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
      const scored = okrsList
        .map(r => r.latestUpdate?.averageScore)
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
      const prog = scored.length > 0
        ? Math.round(scored.reduce((sum, v) => sum + v, 0) / scored.length)
        : null;
      return { spuName: spu.spuName, spuId: spu.spuId, subUnits, allOkrs: okrsList, overallProgress: prog };
    }).sort((a, b) => a.spuName.localeCompare(b.spuName));
  }, [progressSummaries, selectedPlanningYear, planStartYear]);

  const getPeriodLabel = () => {
    const py = selectedPlanningYear && selectedPlanningYear !== "all" ? parseInt(selectedPlanningYear) : null;
    const q = selectedQuarter && selectedQuarter !== "all" ? selectedQuarter : null;
    if (py && q) return formatPeriodLabel(q, getCalendarYearForQuarter(py, q, planStartYear), planStartYear);
    if (py) return formatPlanYearLabel(py, planStartYear);
    if (q) return getQuarterLabel(q);
    return "All Periods";
  };

  const totalOkrCount = spuGroups.reduce((sum, g) => sum + g.allOkrs.length, 0);

  const allScoredOkrScores = spuGroups
    .flatMap(g => g.allOkrs)
    .map(r => r.latestUpdate?.averageScore)
    .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const totalProgress = allScoredOkrScores.length > 0
    ? Math.round(allScoredOkrScores.reduce((sum, v) => sum + v, 0) / allScoredOkrScores.length)
    : 0;

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
                <Select value={selectedQuarter || "all"} onValueChange={v => setSelectedQuarter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-28" data-testid="select-filter-quarter">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ALL_QUARTERS_LABEL}</SelectItem>
                    {QUARTERS.map(q => (
                      <SelectItem key={q.value} value={q.value}>
                        {selectedPlanningYear && selectedPlanningYear !== "all"
                          ? formatQuarterTagForPlanYear(q.value, parseInt(selectedPlanningYear), planStartYear)
                          : q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPlanningYear || "all"} onValueChange={v => setSelectedPlanningYear(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs w-32" data-testid="select-filter-planning-year">
                    <SelectValue placeholder="Plan Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plan years</SelectItem>
                    {planningYears.viewing.map(py => (
                      <SelectItem key={py} value={String(py)}>{formatPlanYearLabel(py, planStartYear)}</SelectItem>
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
                            <Progress value={spuGroup.overallProgress ?? 0} className="h-1.5 flex-1" />
                          </div>
                          <span className="text-lg font-bold tabular-nums w-14 text-right">{spuGroup.overallProgress ?? 0}%</span>
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
                                  const owner = record.responsibilities.find((r: OkrResponsibilityWithDetails) => r.role === 'owner')?.staff.name || record.okr.staff.name;
                                  const collaborators = record.responsibilities.filter((r: OkrResponsibilityWithDetails) => r.role === 'collaborator').map((r: OkrResponsibilityWithDetails) => r.staff.name);
                                  const strategicObjs = parseMultiSelectField(record.okr.universityObjective).map(o => o.split(":")[0]?.trim()).filter(Boolean);
                                  const hasScore = latestScore !== null && latestScore !== undefined;
                                  const isExpanded = expandedOkrIds.has(record.okr.id);
                                  const krScores = getKrScores(record.latestUpdate?.keyResultScores);
                                  return (
                                    <React.Fragment key={record.okr.id}>
                                      <tr
                                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-muted/30" : "hover:bg-muted/20"}`}
                                        onClick={() => toggleOkrExpand(record.okr.id)}
                                        data-testid={`row-okr-${record.okr.id}`}
                                      >
                                        <td className="px-3 py-3 align-top">
                                          <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                              {isExpanded
                                                ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                                : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                              <span className="font-semibold text-xs text-foreground">{record.okr.okrNumber}</span>
                                            </div>
                                            {record.okr.subUnit && (
                                              <span className="text-xs text-muted-foreground hidden sm:block pl-4">{record.okr.subUnit.name}</span>
                                            )}
                                            {((record.okr.collaborationSpus && record.okr.collaborationSpus.length > 0)
                                              || (record.okr.collaborationSubUnits && record.okr.collaborationSubUnits.length > 0)
                                              || record.okr.collaborationSpu) && (
                                              <Badge variant="outline" className="text-xs w-fit px-1 py-0 ml-4">Collab</Badge>
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
                                            {(() => {
                                              const parts: string[] = [];
                                              if (record.okr.collaborationSpus?.length) parts.push(...record.okr.collaborationSpus.map((s: Spu) => s.name));
                                              if (record.okr.collaborationSubUnits?.length) parts.push(...record.okr.collaborationSubUnits.map((su) => su.spuName ? `${su.spuName} — ${su.name}` : su.name));
                                              if (parts.length === 0 && record.okr.collaborationSpu) parts.push(record.okr.collaborationSpu.name);
                                              const orphanCount = record.okr.orphanCollaboratorIds?.length || 0;
                                              if (orphanCount > 0) parts.push(`(${orphanCount} deleted)`);
                                              return parts.length > 0 ? (
                                                <span className="text-xs text-muted-foreground">Collab: {parts.join(", ")}</span>
                                              ) : null;
                                            })()}
                                            {record.latestUpdate && (
                                              <span className="text-xs text-muted-foreground">
                                                Updated {new Date(record.latestUpdate.submittedAt).toLocaleDateString()}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-3 align-top hidden lg:table-cell">
                                          <span className="text-sm">{owner}</span>
                                          {record.okr.actedByName && (
                                            <p className="text-xs text-muted-foreground mt-0.5">Submitted by {record.okr.actedByName}</p>
                                          )}
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
                                          <span className="text-sm text-muted-foreground whitespace-nowrap">{formatPeriodLabel(record.okr.quarter, record.okr.year, planStartYear)}</span>
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
                                      {isExpanded && (
                                        <tr className="bg-primary/5 border-b border-primary/10" data-testid={`row-okr-detail-${record.okr.id}`}>
                                          <td colSpan={6} className="px-6 py-4 bg-[#cc0e0e47]">
                                            {!record.latestUpdate ? (
                                              <p className="text-sm text-muted-foreground italic">No quarterly update submitted yet.</p>
                                            ) : (
                                              <div className="space-y-4">
                                                {/* Key Results with scores */}
                                                {keyResults.length > 0 && (
                                                  <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Key Results</p>
                                                    <div className="space-y-2">
                                                      {(keyResults as Array<string | { description: string }>).map((kr, i: number) => {
                                                        const krText = typeof kr === "string" ? kr : kr.description;
                                                        const krScore = krScores.find(s => s.keyResultNumber === i + 1);
                                                        return (
                                                          <div key={i} className="flex items-start gap-3 text-sm">
                                                            <span className="shrink-0 text-xs font-medium text-muted-foreground w-10 pt-0.5">KR {i + 1}</span>
                                                            <span className="flex-1 text-foreground leading-snug">{krText}</span>
                                                            {krScore !== undefined ? (
                                                              <div className="shrink-0 flex items-center gap-2 min-w-[80px] justify-end">
                                                                <span className="text-xs text-muted-foreground">Score:</span>
                                                                <span className="font-bold text-sm tabular-nums">{krScore.score}</span>
                                                              </div>
                                                            ) : (
                                                              <span className="shrink-0 text-xs text-muted-foreground italic min-w-[80px] text-right">No score</span>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}
                                                {/* Notes/response */}
                                                {record.latestUpdate.notes && (
                                                  <div>
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Response / Notes</p>
                                                    </div>
                                                    <p className="text-sm text-foreground leading-relaxed bg-background rounded-md px-3 py-2 border">{record.latestUpdate.notes}</p>
                                                  </div>
                                                )}
                                                {!record.latestUpdate.notes && keyResults.length === 0 && (
                                                  <p className="text-sm text-muted-foreground italic">No details available.</p>
                                                )}
                                                {/* Scorer info */}
                                                <div className="flex items-center gap-4 pt-1 border-t text-xs text-muted-foreground">
                                                  {record.latestUpdate.scorerName && (
                                                    <span>Scored by <span className="font-medium text-foreground">{record.latestUpdate.scorerName}</span>{record.latestUpdate.actedByName && <span> — entered by <span className="font-medium text-foreground">{record.latestUpdate.actedByName}</span></span>}</span>
                                                  )}
                                                  <span>Submitted {new Date(record.latestUpdate.submittedAt).toLocaleDateString()}</span>
                                                  {hasScore && <span>Overall score: <span className="font-medium text-foreground">{latestScore}%</span></span>}
                                                </div>
                                              </div>
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
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
