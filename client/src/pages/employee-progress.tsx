import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Calendar, X, ChevronRight, Building2, Users } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressSummary, EmployeeProgressRecord, Year } from "@shared/schema";
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

interface EmployeeProgressProps {
  staff: StaffWithDetails;
}

export default function EmployeeProgress({ staff }: EmployeeProgressProps) {
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedPlanningYear, setSelectedPlanningYear] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedSpuId, setSelectedSpuId] = useState<string>("");

  const { data: years } = useQuery<Year[]>({ queryKey: ["/api/years"] });
  const { data: spus } = useQuery<Spu[]>({ queryKey: ["/api/spus"] });
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const queryParams = new URLSearchParams();
  if (selectedYear && selectedYear !== "all") queryParams.append("year", selectedYear);
  if (selectedQuarter && selectedQuarter !== "all") queryParams.append("quarter", selectedQuarter);
  if (selectedStaffId && selectedStaffId !== "all") queryParams.append("staffId", selectedStaffId);
  if (selectedSpuId && selectedSpuId !== "all") queryParams.append("spuId", selectedSpuId);

  const { data: progressSummaries, isLoading } = useQuery<EmployeeProgressSummary[]>({
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

  const spuGroups: SpuGroup[] = (() => {
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
  })();

  const getPeriodLabel = () => {
    if (selectedQuarter && selectedQuarter !== "all" && selectedYear && selectedYear !== "all")
      return `${getQuarterLabel(selectedQuarter)} ${selectedYear}`;
    if (selectedYear && selectedYear !== "all") return selectedYear;
    if (selectedQuarter && selectedQuarter !== "all") return getQuarterLabel(selectedQuarter);
    return "All Periods";
  };

  const totalOkrCount = spuGroups.reduce((sum, g) => sum + g.allOkrs.length, 0);

  return (
    <div className="bg-background min-h-screen">
      {/* Page Header */}
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          {/* Title row */}
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div>
                <h1 className="text-lg font-bold leading-tight">All OKRs</h1>
                <p className="text-xs text-muted-foreground">{getPeriodLabel()} · {totalOkrCount} OKRs across {spuGroups.length} SPUs</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{totalProgress}%</div>
                <div className="text-xs text-muted-foreground">Overall Progress</div>
              </div>
            </div>
          </div>
          {/* Filter strip */}
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

      {/* Main content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-3">
        {isLoading ? (
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
                        <table
                          className="w-full border-collapse text-sm"
                          data-testid={`table-spu-${spuGroup.spuId}-sub-${subUnit.subUnitId || "none"}`}
                        >
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
                              const owner = record.responsibilities.find(r => r.role === 'owner')?.staff.name || record.okr.staff.name;
                              const collaborators = record.responsibilities.filter(r => r.role === 'collaborator').map(r => r.staff.name);
                              const strategicObjs = parseMultiSelectField(record.okr.universityObjective).map(o => o.split(":")[0]?.trim()).filter(Boolean);
                              const hasScore = latestScore !== null && latestScore !== undefined;

                              return (
                                <tr
                                  key={record.okr.id}
                                  className="hover:bg-muted/20 transition-colors"
                                  data-testid={`row-okr-${record.okr.id}`}
                                >
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
    </div>
  );
}
