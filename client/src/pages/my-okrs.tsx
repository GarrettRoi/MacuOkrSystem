import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Target, Calendar, Building2, TrendingUp, CheckCircle2, AlertCircle, Clock, Filter, X, User } from "lucide-react";
import type { StaffWithDetails, OkrWithDetails, QuarterlyUpdate, Spu } from "@shared/schema";
import { QUARTERS, getQuarterLabel } from "@shared/schema";

interface MyOkrsProps {
  staff: StaffWithDetails;
}
const currentYear = new Date().getFullYear();
const YEARS = ["All", String(currentYear - 1), String(currentYear), String(currentYear + 1)];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: TrendingUp },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  at_risk: { label: "At Risk", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export default function MyOkrs({ staff }: MyOkrsProps) {
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [quarterFilter, setQuarterFilter] = useState<string>("All");
  const [spuFilter, setSpuFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // SPU-centric model: Fetch OKRs scoped to user's SPU directly from server
  // Server validates session-based staff belongs to requested SPU
  const { data: spuOkrs, isLoading: okrsLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs/by-spu", staff.spuId],
    queryFn: async () => {
      const response = await fetch(`/api/okrs/by-spu/${staff.spuId}`, {
        credentials: "include", // Include session cookies
      });
      if (!response.ok) throw new Error("Failed to fetch SPU OKRs");
      return response.json();
    },
    enabled: !!staff.spuId,
  });

  const { data: updates } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  // OKRs are already scoped to user's SPU from the server
  const mySpuOkrs = spuOkrs || [];

  const filteredOkrs = useMemo(() => {
    return mySpuOkrs.filter((okr) => {
      const yearMatch = yearFilter === "All" || String(okr.year) === yearFilter;
      const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
      const spuMatch = spuFilter === "All" || String(okr.spuId) === spuFilter;
      const statusMatch = statusFilter === "All" || okr.status === statusFilter;
      return yearMatch && quarterMatch && spuMatch && statusMatch;
    });
  }, [mySpuOkrs, yearFilter, quarterFilter, spuFilter, statusFilter]);

  const getLatestUpdate = (okrId: string) => {
    if (!updates) return null;
    const okrUpdates = updates.filter((u) => u.okrId === okrId);
    if (okrUpdates.length === 0) return null;
    return okrUpdates.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
  };

  const parseKeyResults = (keyResultsJson: string): Array<{ description: string; percentage?: number }> => {
    try {
      return JSON.parse(keyResultsJson);
    } catch {
      return [];
    }
  };

  const clearFilters = () => {
    setYearFilter(String(currentYear));
    setQuarterFilter("All");
    setSpuFilter("All");
    setStatusFilter("All");
  };

  const activeFilterCount = [
    yearFilter !== String(currentYear),
    quarterFilter !== "All",
    spuFilter !== "All",
    statusFilter !== "All",
  ].filter(Boolean).length;

  const uniqueSpusInMyOkrs = useMemo(() => {
    const spuIds = new Set(mySpuOkrs.map((okr) => okr.spuId));
    return spus?.filter((spu) => spuIds.has(spu.id)) || [];
  }, [mySpuOkrs, spus]);

  const totalProgress = filteredOkrs.length > 0
    ? Math.round(filteredOkrs.reduce((sum, okr) => sum + okr.currentValue, 0) / filteredOkrs.length)
    : 0;

  if (okrsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{staff.spu?.name || "My"} OKRs</h1>
            <p className="text-muted-foreground">
              View and track all OKRs for your SPU
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} active</Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-32" data-testid="select-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y === "All" ? "All Years" : y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                <SelectTrigger className="w-48" data-testid="select-quarter">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Quarters</SelectItem>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={spuFilter} onValueChange={setSpuFilter}>
                <SelectTrigger className="w-48" data-testid="select-spu">
                  <SelectValue placeholder="SPU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All SPUs</SelectItem>
                  {uniqueSpusInMyOkrs.map((spu) => (
                    <SelectItem key={spu.id} value={String(spu.id)}>{spu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total OKRs</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-okrs">{filteredOkrs.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {mySpuOkrs.length} total across all periods
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Progress</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-avg-progress">{totalProgress}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={totalProgress} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-completed">
              {filteredOkrs.filter((o) => o.status === "completed").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {filteredOkrs.filter((o) => o.status === "in_progress").length} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {filteredOkrs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No OKRs Found</h3>
            <p className="text-muted-foreground mb-4">
              {mySpuOkrs.length === 0
                ? "Your SPU hasn't submitted any OKRs yet."
                : "No OKRs match your current filters."}
            </p>
            {mySpuOkrs.length === 0 ? (
              <Link href="/submit-okr">
                <Button data-testid="button-submit-first-okr">Submit Your First OKR</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters-empty">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4" defaultValue={filteredOkrs.map((o) => String(o.id))}>
          {filteredOkrs.map((okr) => {
            const keyResults = parseKeyResults(okr.keyResults);
            const latestUpdate = getLatestUpdate(okr.id);
            const statusConfig = STATUS_CONFIG[okr.status] || STATUS_CONFIG.not_started;
            const StatusIcon = statusConfig.icon;

            let keyResultScores: Array<{ keyResultNumber: number; description: string; score: number }> = [];
            if (latestUpdate?.keyResultScores) {
              try {
                keyResultScores = JSON.parse(latestUpdate.keyResultScores);
              } catch {}
            }

            return (
              <AccordionItem
                key={okr.id}
                value={String(okr.id)}
                className="border rounded-lg px-0 overflow-hidden"
                data-testid={`accordion-okr-${okr.id}`}
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2 text-left pr-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {okr.okrNumber}
                      </Badge>
                      <span className="font-semibold">{okr.universityObjective}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {okr.quarter} {okr.year}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {okr.spu?.name || staff.spu.name}
                      </Badge>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                      <span className="font-bold text-lg" data-testid={`text-okr-progress-${okr.id}`}>
                        {okr.currentValue}%
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-2">
                    {/* SPU-centric: Show who submitted this OKR */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                      <User className="h-4 w-4" />
                      <span>Submitted by: <span className="font-medium text-foreground">{okr.staff?.name || "Unknown"}</span></span>
                      {okr.staffId === staff.id && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Objective Statement</h4>
                      <p className="text-sm">{okr.objectiveStatement}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">University Key Result</h4>
                      <p className="text-sm">{okr.universityKeyResult}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Results</h4>
                      <div className="space-y-2">
                        {keyResults.map((kr, idx) => {
                          const krScore = keyResultScores.find((s) => s.keyResultNumber === idx + 1);
                          return (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg"
                              data-testid={`kr-${okr.id}-${idx + 1}`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">KR {idx + 1}</Badge>
                                  {kr.percentage !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      Weight: {kr.percentage}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm mt-1">{kr.description}</p>
                              </div>
                              {krScore && (
                                <div className="text-right">
                                  <div className="text-lg font-bold">{krScore.score}%</div>
                                  <div className="text-xs text-muted-foreground">Score</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {latestUpdate && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Latest Update ({latestUpdate.quarter} {latestUpdate.year})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Average Score</span>
                            <div className="flex items-center gap-2">
                              <Progress value={latestUpdate.averageScore || 0} className="flex-1 h-2" />
                              <span className="font-semibold">{latestUpdate.averageScore || 0}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Submitted</span>
                            <p className="text-sm font-medium">
                              {new Date(latestUpdate.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {latestUpdate.notes && (
                          <div className="mt-3">
                            <span className="text-sm text-muted-foreground">Notes</span>
                            <p className="text-sm mt-1 bg-muted/50 p-3 rounded-lg">{latestUpdate.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {okr.collaborationSpuId && okr.collaborationSpu && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Collaborating SPU</h4>
                        <Badge variant="outline">{okr.collaborationSpu.name}</Badge>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Link href="/quarterly-update">
                        <Button variant="outline" size="sm" data-testid={`button-update-${okr.id}`}>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Update Progress
                        </Button>
                      </Link>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
