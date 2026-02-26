import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Filter, Building2, Users } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressSummary, EmployeeProgressRecord, Year } from "@shared/schema";
import { QUARTERS, getQuarterLabel, parseMultiSelectField, getPlanningYear, PLANNING_YEARS } from "@shared/schema";
import { compareNames } from "@/lib/utils";

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
  // Filter state
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedPlanningYear, setSelectedPlanningYear] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedSpuId, setSelectedSpuId] = useState<string>("");
  const [showFilters, setShowFilters] = useState(true);

  // Fetch years
  const { data: years } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  // Fetch all staff
  const { data: allStaff } = useQuery<StaffWithDetails[]>({
    queryKey: ["/api/staff"],
  });

  // Fetch all SPUs
  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  // Fetch strategic plan start year
  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  // Build query params - "all" values should not be added as filters
  const queryParams = new URLSearchParams();
  if (selectedYear && selectedYear !== "all") queryParams.append("year", selectedYear);
  if (selectedQuarter && selectedQuarter !== "all") queryParams.append("quarter", selectedQuarter);
  if (selectedStaffId && selectedStaffId !== "all") queryParams.append("staffId", selectedStaffId);
  if (selectedSpuId && selectedSpuId !== "all") queryParams.append("spuId", selectedSpuId);

  // Fetch employee progress grouped
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

  const activeFiltersCount = [selectedYear, selectedQuarter, selectedPlanningYear, selectedStaffId, selectedSpuId].filter(v => v && v !== "all").length;

  const getKeyResults = (keyResultsJson: string) => {
    try {
      return JSON.parse(keyResultsJson);
    } catch {
      return [];
    }
  };

  // Calculate total quarterly progress
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

      if (!spuMap[spuId]) {
        spuMap[spuId] = { spuName, spuId, subMap: {} };
      }
      const subKey = subUnitId || "__none__";
      if (!spuMap[spuId].subMap[subKey]) {
        spuMap[spuId].subMap[subKey] = { subUnitName, subUnitId, okrs: [] };
      }
      spuMap[spuId].subMap[subKey].okrs.push(record);
    }

    return Object.values(spuMap)
      .map(spu => {
        const subUnits = Object.values(spu.subMap).sort((a, b) => {
          if (a.subUnitId === null) return 1;
          if (b.subUnitId === null) return -1;
          return a.subUnitName.localeCompare(b.subUnitName);
        });
        const okrsList = subUnits.flatMap(s => s.okrs);
        const totalProgress = okrsList.length > 0
          ? Math.round(okrsList.reduce((sum, r) => sum + (r.latestUpdate?.averageScore || 0), 0) / okrsList.length)
          : 0;
        return { spuName: spu.spuName, spuId: spu.spuId, subUnits, allOkrs: okrsList, overallProgress: totalProgress };
      })
      .sort((a, b) => a.spuName.localeCompare(b.spuName));
  })();

  const getDateRange = () => {
    if (selectedQuarter && selectedQuarter !== "all" && selectedYear && selectedYear !== "all") {
      return `${getQuarterLabel(selectedQuarter)} ${selectedYear}`;
    }
    if (selectedYear && selectedYear !== "all") {
      return `${selectedYear}`;
    }
    if (selectedQuarter && selectedQuarter !== "all") {
      return getQuarterLabel(selectedQuarter);
    }
    return "All Periods";
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Total Quarterly Progress Header */}
        <div className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">TOTAL QUARTERLY PROGRESS:</h1>
              <p className="opacity-90 mt-1">{getDateRange()}</p>
            </div>
            <div className="text-5xl font-bold">{totalProgress}%</div>
          </div>
        </div>

        {/* Filter Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle>Filters</CardTitle>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" data-testid="badge-active-filters">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  {showFilters ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Year Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger data-testid="select-filter-year">
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-year-all">All years</SelectItem>
                      {years && years.length > 0 && years.sort((a, b) => b.year - a.year).map((year) => (
                        <SelectItem key={year.id} value={String(year.year)} data-testid={`option-filter-year-${year.year}`}>
                          {year.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quarter Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quarter</label>
                  <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                    <SelectTrigger data-testid="select-filter-quarter">
                      <SelectValue placeholder="All quarters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-quarter-all">All quarters</SelectItem>
                      {QUARTERS.map((q) => (
                        <SelectItem key={q.value} value={q.value} data-testid={`option-filter-quarter-${q.value}`}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Planning Year Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Year</label>
                  <Select value={selectedPlanningYear} onValueChange={setSelectedPlanningYear}>
                    <SelectTrigger data-testid="select-filter-planning-year">
                      <SelectValue placeholder="All plan years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-planning-year-all">All plan years</SelectItem>
                      {PLANNING_YEARS.map((py) => (
                        <SelectItem key={py} value={String(py)} data-testid={`option-filter-planning-year-${py}`}>
                          Year {py}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SPU Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">SPU</label>
                  <Select value={selectedSpuId} onValueChange={setSelectedSpuId}>
                    <SelectTrigger data-testid="select-filter-spu">
                      <SelectValue placeholder="All SPUs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-spu-all">All SPUs</SelectItem>
                      {spus && spus.map((spu) => (
                        <SelectItem key={spu.id} value={spu.id} data-testid={`option-filter-spu-${spu.id}`}>
                          {spu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          )}
        </Card>

        {/* Employee Progress Table */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : spuGroups.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No OKRs Found</h3>
              <p className="text-muted-foreground">
                No OKRs match your current filters. Try adjusting your filter criteria.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={spuGroups.slice(0, 3).map((_, i) => `spu-${i}`)} className="space-y-4">
            {spuGroups.map((spuGroup, spuIndex) => (
              <AccordionItem
                key={spuGroup.spuId}
                value={`spu-${spuIndex}`}
                className="border rounded-lg overflow-hidden"
                data-testid={`accordion-spu-${spuGroup.spuId}`}
              >
                <AccordionTrigger className="px-6 py-4 bg-accent hover:no-underline hover-elevate">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <Building2 className="h-5 w-5" />
                      <h2 className="text-xl font-bold">{spuGroup.spuName}</h2>
                      <Badge variant="outline">{spuGroup.allOkrs.length} OKRs</Badge>
                      {spuGroup.subUnits.filter(s => s.subUnitId !== null).length > 0 && (
                        <Badge variant="secondary">{spuGroup.subUnits.filter(s => s.subUnitId !== null).length} Sub-Units</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{getDateRange()}</span>
                      <div className="text-3xl font-bold text-primary">{spuGroup.overallProgress}%</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  {spuGroup.subUnits.map((subUnit) => (
                    <div key={subUnit.subUnitId || "__none__"} className="border-t">
                      {(spuGroup.subUnits.length > 1 || subUnit.subUnitId !== null) && (
                        <div className="flex items-center gap-2 px-6 py-2 bg-muted/30 border-b">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">{subUnit.subUnitName}</span>
                          <Badge variant="outline" className="text-xs">{subUnit.okrs.length} OKRs</Badge>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm" data-testid={`table-spu-${spuGroup.spuId}-sub-${subUnit.subUnitId || "none"}`}>
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left p-2 font-semibold border-b w-16">OKR #</th>
                              <th className="text-left p-2 font-semibold border-b w-24">Activity</th>
                              <th className="text-left p-2 font-semibold border-b w-40">Strategic / Universal</th>
                              <th className="text-left p-2 font-semibold border-b w-32">Sub-Unit</th>
                              <th className="text-left p-2 font-semibold border-b w-32">Collaborating SPU(s)</th>
                              <th className="text-left p-2 font-semibold border-b w-40">Responsible Parties</th>
                              <th className="text-left p-2 font-semibold border-b">Objective / Details</th>
                              <th className="text-right p-2 font-semibold border-b w-20">Progress</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subUnit.okrs.map((record) => {
                              const keyResults = getKeyResults(record.okr.keyResults || "[]");
                              const latestScore = record.latestUpdate?.averageScore;
                              
                              return (
                                <React.Fragment key={record.okr.id}>
                                  <tr className="border-b" data-testid={`row-okr-${record.okr.id}`}>
                                    <td rowSpan={4} className="p-2 align-top font-semibold border-r bg-muted/50">{record.okr.okrNumber}</td>
                                    <td colSpan={6} className="p-2 font-semibold bg-[#db040473]">
                                      {record.okr.objectiveStatement}
                                    </td>
                                    <td rowSpan={4} className="p-2 align-top text-right font-bold text-lg border-l">
                                      {latestScore !== null && latestScore !== undefined ? `${latestScore}%` : "—"}
                                    </td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-2 text-xs text-muted-foreground font-medium">Strategic</td>
                                    <td className="p-2">{parseMultiSelectField(record.okr.universityObjective).map(o => o.split(":")[0]?.trim()).join(", ")}</td>
                                    <td className="p-2">{record.okr.subUnit?.name || "—"}</td>
                                    <td className="p-2">{record.okr.collaborationSpu?.name || "—"}</td>
                                    <td className="p-2">
                                      {record.responsibilities.filter(r => r.role === 'collaborator').length > 0
                                        ? record.responsibilities.filter(r => r.role === 'collaborator').map(r => r.staff.name).join(", ")
                                        : "—"}
                                    </td>
                                    <td className="p-2">{parseMultiSelectField(record.okr.universityKeyResult).map(kr => kr.split(":")[0]?.trim()).join(", ")}</td>
                                  </tr>
                                  <tr className="border-b bg-muted/20">
                                    <td className="p-2 text-xs text-muted-foreground font-medium">Owner</td>
                                    <td className="p-2">{record.okr.spu?.name || "—"}</td>
                                    <td className="p-2">{record.okr.subUnit?.name || "—"}</td>
                                    <td className="p-2">—</td>
                                    <td className="p-2">
                                      {record.responsibilities.find(r => r.role === 'owner')?.staff.name || record.okr.staff.name}
                                    </td>
                                    <td className="p-2 text-muted-foreground">{keyResults.length} Key Results</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-2 text-xs text-muted-foreground font-medium">Aligned</td>
                                    <td className="p-2">{record.okr.quarter} {record.okr.year}</td>
                                    <td className="p-2">—</td>
                                    <td className="p-2">—</td>
                                    <td className="p-2">—</td>
                                    <td className="p-2 text-muted-foreground text-xs">
                                      Last updated: {record.latestUpdate 
                                        ? new Date(record.latestUpdate.submittedAt).toLocaleDateString()
                                        : "Never"}
                                    </td>
                                  </tr>
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
    </div>
  );
}
