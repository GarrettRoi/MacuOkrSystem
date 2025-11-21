import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Calendar, Target, TrendingUp, Users, Filter } from "lucide-react";
import type { StaffWithDetails, Spu, EmployeeProgressRecord, Year } from "@shared/schema";

interface EmployeeProgressProps {
  staff: StaffWithDetails;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const STATUSES = ["not_started", "in_progress", "at_risk", "completed"];

const statusColors = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  at_risk: "bg-orange-500",
  completed: "bg-green-500",
};

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
  
  // Detail drawer state
  const [selectedOkr, setSelectedOkr] = useState<EmployeeProgressRecord | null>(null);

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

  // Build query params
  const queryParams = new URLSearchParams();
  if (selectedYear) queryParams.append("year", selectedYear);
  if (selectedQuarter) queryParams.append("quarter", selectedQuarter);
  if (selectedStaffId) queryParams.append("staffId", selectedStaffId);
  if (selectedSpuId) queryParams.append("spuId", selectedSpuId);
  if (selectedStatus) queryParams.append("status", selectedStatus);

  // Fetch employee progress
  const { data: progressRecords, isLoading } = useQuery<EmployeeProgressRecord[]>({
    queryKey: ["/api/employee-progress", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/employee-progress?${queryParams.toString()}`);
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

  const activeFiltersCount = [selectedYear, selectedQuarter, selectedStaffId, selectedSpuId, selectedStatus].filter(Boolean).length;

  const getKeyResults = (keyResultsJson: string) => {
    try {
      return JSON.parse(keyResultsJson);
    } catch {
      return [];
    }
  };

  const getKeyResultScores = (keyResultScoresJson: string | null) => {
    if (!keyResultScoresJson) return [];
    try {
      return JSON.parse(keyResultScoresJson);
    } catch {
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Progress View</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive view of OKR progress across the organization
          </p>
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
                      <SelectItem value="" data-testid="option-filter-year-all">All years</SelectItem>
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
                      <SelectItem value="" data-testid="option-filter-quarter-all">All quarters</SelectItem>
                      {QUARTERS.map((q) => (
                        <SelectItem key={q} value={q} data-testid={`option-filter-quarter-${q}`}>
                          {q}
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
                      <SelectItem value="" data-testid="option-filter-staff-all">All employees</SelectItem>
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
                      <SelectItem value="" data-testid="option-filter-spu-all">All SPUs</SelectItem>
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
                      <SelectItem value="" data-testid="option-filter-status-all">All statuses</SelectItem>
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

        {/* Results */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary" data-testid="tab-summary">
              <Target className="h-4 w-4 mr-2" />
              OKR Summary
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              <Calendar className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : progressRecords && progressRecords.length > 0 ? (
              <div className="grid gap-4">
                {progressRecords.map((record) => {
                  const keyResults = getKeyResults(record.okr.keyResults);
                  const latestScores = record.latestUpdate ? getKeyResultScores(record.latestUpdate.keyResultScores) : [];

                  return (
                    <Card
                      key={record.okr.id}
                      className="hover-elevate active-elevate-2 cursor-pointer"
                      onClick={() => setSelectedOkr(record)}
                      data-testid={`card-okr-${record.okr.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg">{record.okr.okrNumber}</CardTitle>
                              <Badge variant="outline" data-testid={`badge-quarter-${record.okr.id}`}>
                                {record.okr.quarter} {record.okr.year}
                              </Badge>
                              <Badge 
                                className={statusColors[record.okr.status as keyof typeof statusColors]}
                                data-testid={`badge-status-${record.okr.id}`}
                              >
                                {statusLabels[record.okr.status as keyof typeof statusLabels]}
                              </Badge>
                            </div>
                            <CardDescription className="line-clamp-2">
                              {record.okr.objectiveStatement}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{record.okr.staff.name}</p>
                              <p className="text-xs text-muted-foreground">{record.okr.staff.spu.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{keyResults.length} Key Results</p>
                              <p className="text-xs text-muted-foreground">Defined</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {record.latestUpdate?.averageScore ?? "N/A"}
                                {record.latestUpdate?.averageScore !== null && "%"}
                              </p>
                              <p className="text-xs text-muted-foreground">Latest Score</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {record.latestUpdate 
                                  ? new Date(record.latestUpdate.submittedAt).toLocaleDateString()
                                  : "Not updated"}
                              </p>
                              <p className="text-xs text-muted-foreground">Last Update</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No OKRs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeFiltersCount > 0 
                      ? "Try adjusting your filters to see more results"
                      : "No OKRs have been submitted yet"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : progressRecords && progressRecords.length > 0 ? (
              <div className="space-y-6">
                {progressRecords.map((record) => (
                  <Card key={record.okr.id} data-testid={`card-timeline-${record.okr.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {record.okr.okrNumber} - {record.okr.objectiveStatement}
                      </CardTitle>
                      <CardDescription>
                        {record.okr.staff.name} • {record.okr.quarter} {record.okr.year}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Created: {new Date(record.okr.createdAt).toLocaleDateString()}</span>
                        </div>
                        {record.quarterlyUpdates.length > 0 ? (
                          <div className="border-l-2 border-muted pl-4 space-y-4">
                            {record.quarterlyUpdates.map((update, idx) => (
                              <div key={update.id} className="relative">
                                <div className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full bg-primary" />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">
                                      {update.quarter} {update.year} Update
                                    </p>
                                    {update.averageScore !== null && (
                                      <Badge variant="secondary">Score: {update.averageScore}%</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(update.submittedAt).toLocaleDateString()}
                                  </p>
                                  {update.notes && (
                                    <p className="text-sm mt-2 line-clamp-2">{update.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No updates submitted yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No timeline data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeFiltersCount > 0 
                      ? "Try adjusting your filters to see more results"
                      : "No OKRs have been submitted yet"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Detail Drawer */}
        <Sheet open={!!selectedOkr} onOpenChange={(open) => !open && setSelectedOkr(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {selectedOkr && (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedOkr.okr.okrNumber} Details</SheetTitle>
                  <SheetDescription>
                    {selectedOkr.okr.quarter} {selectedOkr.okr.year} • {selectedOkr.okr.staff.name}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status and Basic Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Status</h3>
                    <Badge className={statusColors[selectedOkr.okr.status as keyof typeof statusColors]}>
                      {statusLabels[selectedOkr.okr.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>

                  {/* Objective */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Objective Statement</h3>
                    <p className="text-sm">{selectedOkr.okr.objectiveStatement}</p>
                  </div>

                  {/* University Objective & Key Result */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">University Alignment</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Objective:</span> {selectedOkr.okr.universityObjective}</p>
                      <p><span className="font-medium">Key Result:</span> {selectedOkr.okr.universityKeyResult}</p>
                    </div>
                  </div>

                  {/* Key Results */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Key Results</h3>
                    <div className="space-y-2">
                      {getKeyResults(selectedOkr.okr.keyResults).map((kr: any, idx: number) => (
                        <div key={idx} className="border rounded-md p-3">
                          <p className="font-medium text-sm">KR {idx + 1}</p>
                          <p className="text-sm mt-1">{kr.description}</p>
                          {kr.percentage && (
                            <p className="text-xs text-muted-foreground mt-1">Weight: {kr.percentage}%</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Departments */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Departments</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">SPU:</span> {selectedOkr.okr.spu?.name || "N/A"}</p>
                      {selectedOkr.okr.subUnit && (
                        <p><span className="font-medium">Sub-Unit:</span> {selectedOkr.okr.subUnit.name}</p>
                      )}
                      {selectedOkr.okr.collaborationSpu && (
                        <p><span className="font-medium">Collaboration SPU:</span> {selectedOkr.okr.collaborationSpu.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Responsible Parties */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">Responsible Parties</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="font-medium">{selectedOkr.okr.staff.name}</p>
                          <p className="text-xs text-muted-foreground">Owner (Creator)</p>
                        </div>
                      </div>
                      {selectedOkr.responsibilities.map((resp) => (
                        <div key={resp.id} className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm">
                            <p className="font-medium">{resp.staff.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{resp.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Latest Update */}
                  {selectedOkr.latestUpdate && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Latest Update</h3>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {selectedOkr.latestUpdate.quarter} {selectedOkr.latestUpdate.year}
                            </CardTitle>
                            {selectedOkr.latestUpdate.averageScore !== null && (
                              <Badge variant="secondary">
                                Score: {selectedOkr.latestUpdate.averageScore}%
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {new Date(selectedOkr.latestUpdate.submittedAt).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedOkr.latestUpdate.keyResultScores && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Key Result Scores:</p>
                              {getKeyResultScores(selectedOkr.latestUpdate.keyResultScores).map((kr: any) => (
                                <div key={kr.keyResultNumber} className="flex justify-between text-sm">
                                  <span>KR {kr.keyResultNumber}</span>
                                  <span className="font-medium">{kr.score}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {selectedOkr.latestUpdate.notes && (
                            <div>
                              <p className="text-sm font-medium mb-1">Notes:</p>
                              <p className="text-sm">{selectedOkr.latestUpdate.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
