import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Filter } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressSummary, Year } from "@shared/schema";
import { QUARTERS, getQuarterLabel } from "@shared/schema";

interface EmployeeProgressProps {
  staff: StaffWithDetails;
}
const STATUSES = ["not_started", "in_progress", "at_risk", "completed"];

const statusLabels = {
  not_started: "Not Started",
  in_progress: "In Progress",
  at_risk: "At Risk",
  completed: "Completed",
};

export default function EmployeeProgress({ staff }: EmployeeProgressProps) {
  // Filter state
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedSpuId, setSelectedSpuId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
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
    queryKey: ["/api/departments"],
  });

  // Build query params - "all" values should not be added as filters
  const queryParams = new URLSearchParams();
  if (selectedYear && selectedYear !== "all") queryParams.append("year", selectedYear);
  if (selectedQuarter && selectedQuarter !== "all") queryParams.append("quarter", selectedQuarter);
  if (selectedStaffId && selectedStaffId !== "all") queryParams.append("staffId", selectedStaffId);
  if (selectedSpuId && selectedSpuId !== "all") queryParams.append("spuId", selectedSpuId);
  if (selectedStatus && selectedStatus !== "all") queryParams.append("status", selectedStatus);

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
    setSelectedStaffId("");
    setSelectedSpuId("");
    setSelectedStatus("");
  };

  const activeFiltersCount = [selectedYear, selectedQuarter, selectedStaffId, selectedSpuId, selectedStatus].filter(v => v && v !== "all").length;

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

                {/* Staff Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Employee</label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger data-testid="select-filter-staff">
                      <SelectValue placeholder="All employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-staff-all">All employees</SelectItem>
                      {allStaff && allStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`option-filter-staff-${s.id}`}>
                          {s.name}
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

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-filter-status-all">All statuses</SelectItem>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status} data-testid={`option-filter-status-${status}`}>
                          {statusLabels[status as keyof typeof statusLabels]}
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
        ) : !progressSummaries || progressSummaries.length === 0 ? (
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
          <Accordion type="multiple" defaultValue={progressSummaries.slice(0, 3).map((_, i) => `employee-${i}`)} className="space-y-4">
            {progressSummaries.map((summary, index) => (
              <AccordionItem
                key={summary.staff.id}
                value={`employee-${index}`}
                className="border rounded-lg overflow-hidden"
                data-testid={`accordion-employee-${summary.staff.id}`}
              >
                <AccordionTrigger className="px-6 py-4 bg-accent hover:no-underline hover-elevate">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-bold">{summary.staff.name}</h2>
                      <Badge variant="outline">{summary.okrCount} OKRs</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{getDateRange()}</span>
                      <div className="text-3xl font-bold text-primary">{summary.overallProgress}%</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm" data-testid={`table-employee-${summary.staff.id}`}>
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
                        {summary.okrs.map((record) => {
                          const keyResults = getKeyResults(record.okr.keyResults || "[]");
                          const latestScore = record.latestUpdate?.averageScore;
                          
                          return (
                            <>
                              {/* Row 1: Objective (destructive background) */}
                              <tr key={`${record.okr.id}-objective`} className="border-b" data-testid={`row-okr-${record.okr.id}`}>
                                <td rowSpan={4} className="p-2 align-top font-semibold border-r bg-muted/50">{record.okr.okrNumber}</td>
                                <td colSpan={6} className="p-2 bg-destructive/10 font-semibold">
                                  {record.okr.objectiveStatement}
                                </td>
                                <td rowSpan={4} className="p-2 align-top text-right font-bold text-lg border-l">
                                  {latestScore !== null && latestScore !== undefined ? `${latestScore}%` : "—"}
                                </td>
                              </tr>

                              {/* Row 2: Strategic Alignment */}
                              <tr key={`${record.okr.id}-strategic`} className="border-b">
                                <td className="p-2 text-xs text-muted-foreground font-medium">Strategic</td>
                                <td className="p-2">{record.okr.universityObjective}</td>
                                <td className="p-2">{record.okr.subUnit?.name || "—"}</td>
                                <td className="p-2">{record.okr.collaborationSpu?.name || "—"}</td>
                                <td className="p-2">
                                  {record.responsibilities.filter(r => r.role === 'collaborator').length > 0
                                    ? record.responsibilities.filter(r => r.role === 'collaborator').map(r => r.staff.name).join(", ")
                                    : "—"}
                                </td>
                                <td className="p-2">{record.okr.universityKeyResult}</td>
                              </tr>

                              {/* Row 3: Owner / SPU */}
                              <tr key={`${record.okr.id}-owner`} className="border-b bg-muted/20">
                                <td className="p-2 text-xs text-muted-foreground font-medium">Owner</td>
                                <td className="p-2">{record.okr.spu?.name || "—"}</td>
                                <td className="p-2">{record.okr.subUnit?.name || "—"}</td>
                                <td className="p-2">—</td>
                                <td className="p-2">
                                  {record.responsibilities.find(r => r.role === 'owner')?.staff.name || record.okr.staff.name}
                                </td>
                                <td className="p-2 text-muted-foreground">{keyResults.length} Key Results</td>
                              </tr>

                              {/* Row 4: Aligned / Period */}
                              <tr key={`${record.okr.id}-aligned`} className="border-b">
                                <td className="p-2 text-xs text-muted-foreground font-medium">Aligned</td>
                                <td className="p-2">{record.okr.quarter} {record.okr.year}</td>
                                <td className="p-2">{statusLabels[record.okr.status as keyof typeof statusLabels]}</td>
                                <td className="p-2">—</td>
                                <td className="p-2">—</td>
                                <td className="p-2 text-muted-foreground text-xs">
                                  Last updated: {record.latestUpdate 
                                    ? new Date(record.latestUpdate.submittedAt).toLocaleDateString()
                                    : "Never"}
                                </td>
                              </tr>
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
