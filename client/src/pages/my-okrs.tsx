import { useState, useMemo, useEffect } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Target, Calendar, Building2, TrendingUp, Filter, X, User, Users, Pencil, Plus, Minus } from "lucide-react";
import { apiRequest, queryClient, getErrorMessage, logClientError } from "@/lib/queryClient";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { MultiSelectSpus } from "@/components/multi-select-spus";
import type { StaffWithDetails, OkrWithDetails, QuarterlyUpdate, Spu, SubUnit, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { QUARTERS, getQuarterLabel, parseMultiSelectField, getPlanningYear, PLANNING_YEARS, ALL_QUARTERS_LABEL, isLeaderRole, formatPlanYearLabel, formatQuarterTagForPlanYear, formatPeriodLabel, getCalendarYearForQuarter } from "@shared/schema";

interface MyOkrsProps {
  staff: StaffWithDetails;
}
export default function MyOkrs({ staff }: MyOkrsProps) {
  const { toast } = useToast();
  const [planningYearFilter, setPlanningYearFilter] = usePersistedFilter("my-okrs:planningYear", "All");
  const [quarterFilter, setQuarterFilter] = usePersistedFilter("my-okrs:quarter", "All");
  const [spuFilter, setSpuFilter] = usePersistedFilter("my-okrs:spu", "All");

  const [editingOkr, setEditingOkr] = useState<OkrWithDetails | null>(null);
  const [editObjectiveStatement, setEditObjectiveStatement] = useState("");
  const [editKeyResults, setEditKeyResults] = useState<Array<{ description: string; percentage?: number }>>([]);
  const [editQuarter, setEditQuarter] = useState("");
  const [editYear, setEditYear] = useState<number>(2024);
  const [editPlanYear, setEditPlanYear] = useState<number>(1);
  const [editStatus, setEditStatus] = useState("not_started");
  const [editUniversityObjectives, setEditUniversityObjectives] = useState<string[]>([]);
  const [editUniversityKeyResults, setEditUniversityKeyResults] = useState<string[]>([]);
  const [editCollaborationIds, setEditCollaborationIds] = useState<string[]>([]);
  const [editReason, setEditReason] = useState("");

  const [editingScoreUpdate, setEditingScoreUpdate] = useState<QuarterlyUpdate | null>(null);
  const [editingScoreOkr, setEditingScoreOkr] = useState<OkrWithDetails | null>(null);
  const [editScores, setEditScores] = useState<Array<{ keyResultNumber: number; description: string; score: number }>>([]);
  const [editScoreNotes, setEditScoreNotes] = useState("");
  const [editScoreReason, setEditScoreReason] = useState("");

  const isAdmin = staff.role === "super_admin" || isLeaderRole(staff.role);

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const { data: spuOkrs, isLoading: okrsLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/my-okrs", staff.id],
    queryFn: async () => {
      const response = await fetch(`/api/my-okrs`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch OKRs");
      return response.json();
    },
    enabled: !!staff.id,
  });

  const { data: updates } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: subUnits } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: universityObjectivesData } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const { data: leaders } = useQuery<StaffWithDetails[]>({
    queryKey: ["/api/staff", staff.id, "leaders"],
    queryFn: async () => {
      const response = await fetch(`/api/staff/${staff.id}/leaders`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: staff.role === "basic",
  });

  const mySpuOkrs = spuOkrs || [];

  useEffect(() => {
    if (staff.role === "basic" && staff.spuId) {
      const desired = String(staff.spuId);
      if (spuFilter !== desired) setSpuFilter(desired);
    }
  }, [staff.role, staff.spuId, spuFilter, setSpuFilter]);

  const filteredOkrs = useMemo(() => {
    // Fiscal year runs Q3 -> Q4 -> Q1 -> Q2, so Q2 is the latest quarter of
    // the year and Q3 is the earliest. Sort descending using fiscal order.
    const quarterOrder: Record<string, number> = { "Q3": 1, "Q4": 2, "Q1": 3, "Q2": 4 };
    return mySpuOkrs
      .filter((okr) => {
        const planningYearMatch = planningYearFilter === "All" || getPlanningYear(okr.quarter, okr.year, planStartYear) === parseInt(planningYearFilter);
        const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
        const spuMatch = spuFilter === "All" || String(okr.spuId) === spuFilter;
        return planningYearMatch && quarterMatch && spuMatch;
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return (quarterOrder[b.quarter] || 0) - (quarterOrder[a.quarter] || 0);
      });
  }, [mySpuOkrs, planningYearFilter, quarterFilter, spuFilter, planStartYear]);

  // Keep the stored calendar year in sync with the plan year + fiscal quarter
  // chosen in the edit dialog (storage stays calendar-year based).
  useEffect(() => {
    if (!editingOkr || !editQuarter) return;
    setEditYear(getCalendarYearForQuarter(editPlanYear, editQuarter, planStartYear));
  }, [editPlanYear, editQuarter, planStartYear, editingOkr]);

  const getLatestUpdate = (okrId: string) => {
    if (!updates) return null;
    const primaryUpdates = updates.filter((u) => u.okrId === okrId && u.isPrimaryScore !== false);
    const okrUpdates = primaryUpdates.length > 0 ? primaryUpdates : updates.filter((u) => u.okrId === okrId);
    if (okrUpdates.length === 0) return null;
    return okrUpdates.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
  };

  const parseKeyResults = (keyResultsJson: any): Array<{ description: string; percentage?: number }> => {
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

  const editObjectiveOptions = useMemo(() => {
    if (!universityObjectivesData) return [];
    return universityObjectivesData
      .filter(obj => obj.isActive !== false)
      .filter(obj => {
        if (!obj.applicableYears || obj.applicableYears.length === 0) return true;
        return obj.applicableYears.includes(editYear);
      })
      .map(obj => `${obj.label}: ${obj.description}`);
  }, [universityObjectivesData, editYear]);

  const editKeyResultOptions = useMemo(() => {
    if (!universityObjectivesData || editUniversityObjectives.length === 0) return [];
    const selectedLabels = editUniversityObjectives.map((opt) => opt.split(":")[0].trim());
    return universityObjectivesData
      .filter(obj => selectedLabels.includes(obj.label))
      .flatMap(obj => obj.keyResults.map(kr => `${kr.label} : ${kr.description}`));
  }, [universityObjectivesData, editUniversityObjectives]);

  // Mirror submit-okr: when the year changes (altering applicable objectives)
  // or objectives are deselected (altering valid key results), prune any now-
  // invalid selections so the saved payload never carries stale alignment data.
  useEffect(() => {
    // Don't prune until the source data has loaded, or we'd wipe the values
    // seeded from the existing OKR before options are available.
    if (!universityObjectivesData) return;
    if (editUniversityObjectives.length === 0) return;
    const valid = editUniversityObjectives.filter((obj) => editObjectiveOptions.includes(obj));
    if (valid.length !== editUniversityObjectives.length) {
      setEditUniversityObjectives(valid);
    }
  }, [editObjectiveOptions]);

  useEffect(() => {
    if (!universityObjectivesData) return;
    if (editUniversityKeyResults.length === 0) return;
    const valid = editUniversityKeyResults.filter((kr) => editKeyResultOptions.includes(kr));
    if (valid.length !== editUniversityKeyResults.length) {
      setEditUniversityKeyResults(valid);
    }
  }, [editKeyResultOptions]);

  const editCollaborationOptions = useMemo(() => {
    const allSpus = spus || [];
    const allSubUnits = subUnits || [];
    const spuNameById = new Map(allSpus.map((s) => [s.id, s.name]));
    const spuOptions = allSpus
      .filter((s) => s.id !== editingOkr?.spuId)
      .map((s) => ({ id: `spu:${s.id}`, name: s.name }));
    const subUnitOptions = allSubUnits
      .filter((su) => su.id !== editingOkr?.subUnitId)
      .map((su) => ({
        id: `sub:${su.id}`,
        name: `${spuNameById.get(su.spuId) ?? "SPU"} — ${su.name}`,
      }));
    return [...spuOptions, ...subUnitOptions].sort((a, b) => a.name.localeCompare(b.name));
  }, [spus, subUnits, editingOkr?.spuId, editingOkr?.subUnitId]);

  const clearFilters = () => {
    setPlanningYearFilter("All");
    setQuarterFilter("All");
    setSpuFilter("All");
  };

  const activeFilterCount = [
    planningYearFilter !== "All",
    quarterFilter !== "All",
    spuFilter !== "All",
  ].filter(Boolean).length;

  const uniqueSpusInMyOkrs = useMemo(() => {
    const spuIds = new Set(mySpuOkrs.map((okr) => okr.spuId));
    return spus?.filter((spu) => spuIds.has(spu.id)) || [];
  }, [mySpuOkrs, spus]);

  useEffect(() => {
    if (
      spuFilter !== "All" &&
      uniqueSpusInMyOkrs.length > 0 &&
      !uniqueSpusInMyOkrs.some((s) => String(s.id) === spuFilter)
    ) {
      if (staff.role === "basic" && staff.spuId) {
        setSpuFilter(String(staff.spuId));
      } else {
        setSpuFilter("All");
      }
    }
  }, [spuFilter, uniqueSpusInMyOkrs, staff.role, staff.spuId, setSpuFilter]);

  // Only count OKRs that actually have a recorded score (latest primary update with averageScore).
  const okrScores = filteredOkrs
    .map((okr) => getLatestUpdate(okr.id)?.averageScore)
    .filter((s): s is number => s !== null && s !== undefined);
  const totalProgress = okrScores.length > 0
    ? Math.round(okrScores.reduce((sum, s) => sum + s, 0) / okrScores.length)
    : 0;
  const scoredCount = okrScores.length;
  const unscoredCount = filteredOkrs.length - scoredCount;

  const openEditDialog = (okr: OkrWithDetails) => {
    setEditingOkr(okr);
    setEditObjectiveStatement(okr.objectiveStatement);
    setEditKeyResults(parseKeyResults(okr.keyResults));
    setEditQuarter(okr.quarter);
    setEditYear(okr.year);
    setEditPlanYear(getPlanningYear(okr.quarter, okr.year, planStartYear));
    // Normalize legacy / unknown status values (e.g. "on_track" from older
    // data imports) to a value the server enum accepts, so the Select shows
    // a real option and the update payload validates.
    const allowedStatuses = ["not_started", "in_progress", "completed"] as const;
    const normalizedStatus = allowedStatuses.includes(okr.status as typeof allowedStatuses[number])
      ? okr.status
      : "in_progress";
    setEditStatus(normalizedStatus || "not_started");
    setEditUniversityObjectives(parseMultiSelectField(okr.universityObjective));
    setEditUniversityKeyResults(parseMultiSelectField(okr.universityKeyResult));
    // Seed collaborators from the OKR's joined SPUs / sub-units, encoded with
    // the same "spu:" / "sub:" prefixes the picker and submit handler use.
    const collabIds = [
      ...(okr.collaborationSpus || []).map((s) => `spu:${s.id}`),
      ...(okr.collaborationSubUnits || []).map((su) => `sub:${su.id}`),
    ];
    setEditCollaborationIds(collabIds);
    setEditReason("");
  };

  const closeEditDialog = () => {
    setEditingOkr(null);
    setEditObjectiveStatement("");
    setEditKeyResults([]);
    setEditQuarter("");
    setEditYear(2024);
    setEditPlanYear(1);
    setEditStatus("not_started");
    setEditUniversityObjectives([]);
    setEditUniversityKeyResults([]);
    setEditCollaborationIds([]);
    setEditReason("");
  };

  const updateEditKeyResult = (index: number, field: "description" | "percentage", value: string | number) => {
    setEditKeyResults(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addEditKeyResult = () => {
    setEditKeyResults(prev => [...prev, { description: "", percentage: undefined }]);
  };

  const removeEditKeyResult = (index: number) => {
    setEditKeyResults(prev => prev.filter((_, i) => i !== index));
  };

  const updateOkrMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any; reason: string; editedBy: string; editedByName: string }) => {
      return await apiRequest("PUT", `/api/okrs/${data.id}`, {
        ...data.updates,
        reason: data.reason,
        editedBy: data.editedBy,
        editedByName: data.editedByName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-okrs", staff.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edit-logs"] });
      closeEditDialog();
      toast({
        title: "OKR Updated",
        description: "The OKR has been successfully updated.",
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("my-okrs:update", error);
      toast({
        title: "Update Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = () => {
    if (!editingOkr) return;
    if (!editReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for this edit.", variant: "destructive" });
      return;
    }
    if (editObjectiveStatement.length < 20) {
      toast({ title: "Validation Error", description: "Objective statement must be at least 20 characters.", variant: "destructive" });
      return;
    }
    if (editKeyResults.length === 0 || editKeyResults.some(kr => !kr.description || kr.description.length < 10)) {
      toast({ title: "Validation Error", description: "Each key result description must be at least 10 characters.", variant: "destructive" });
      return;
    }
    if (editUniversityObjectives.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one university objective.", variant: "destructive" });
      return;
    }
    if (editUniversityKeyResults.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one university key result.", variant: "destructive" });
      return;
    }

    // Split the prefixed picker values ("spu:UUID" / "sub:UUID") into the two
    // server-side arrays, mirroring the submit-OKR handler.
    const collaborationSpuIds = editCollaborationIds
      .filter((v) => v.startsWith("spu:"))
      .map((v) => v.slice(4));
    const collaborationSubUnitIds = editCollaborationIds
      .filter((v) => v.startsWith("sub:"))
      .map((v) => v.slice(4));

    const updates = {
      objectiveStatement: editObjectiveStatement,
      keyResults: JSON.stringify(editKeyResults),
      quarter: editQuarter,
      year: editYear,
      status: editStatus,
      universityObjective: JSON.stringify(editUniversityObjectives),
      universityKeyResult: JSON.stringify(editUniversityKeyResults),
      collaborationSpuIds,
      collaborationSubUnitIds,
    };

    updateOkrMutation.mutate({
      id: editingOkr.id,
      updates,
      reason: editReason,
      editedBy: staff.id,
      editedByName: staff.name,
    });
  };

  const updateScoreMutation = useMutation({
    mutationFn: async (data: { id: string; keyResultScores: string; notes: string; reason: string; editedBy: string; editedByName: string }) => {
      return await apiRequest("PUT", `/api/quarterly-updates/${data.id}`, {
        keyResultScores: data.keyResultScores,
        notes: data.notes,
        reason: data.reason,
        editedBy: data.editedBy,
        editedByName: data.editedByName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quarterly-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-okrs", staff.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/edit-logs"] });
      closeEditScoreDialog();
      toast({
        title: "Score Updated",
        description: "The score has been successfully updated.",
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("my-okrs:score-update", error);
      toast({
        title: "Update Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const openEditScoreDialog = (okr: OkrWithDetails, update: QuarterlyUpdate) => {
    const keyResults = parseKeyResults(okr.keyResults);
    let parsedScores: Array<{ keyResultNumber: number; description: string; score: number }> = [];
    if (update.keyResultScores) {
      if (Array.isArray(update.keyResultScores)) {
        parsedScores = update.keyResultScores as any;
      } else if (typeof update.keyResultScores === "string") {
        try { parsedScores = JSON.parse(update.keyResultScores); } catch {}
      }
    }
    // Seed one editable row per key result, preferring any existing score.
    const seeded = keyResults.map((kr, idx) => {
      const existing = parsedScores.find((s) => s.keyResultNumber === idx + 1);
      return {
        keyResultNumber: idx + 1,
        description: kr.description,
        score: existing ? existing.score : 0,
      };
    });
    setEditingScoreOkr(okr);
    setEditingScoreUpdate(update);
    setEditScores(seeded.length > 0 ? seeded : parsedScores);
    setEditScoreNotes(update.notes || "");
    setEditScoreReason("");
  };

  const closeEditScoreDialog = () => {
    setEditingScoreUpdate(null);
    setEditingScoreOkr(null);
    setEditScores([]);
    setEditScoreNotes("");
    setEditScoreReason("");
  };

  const updateEditScore = (idx: number, score: number) => {
    setEditScores((prev) => prev.map((s, i) => (i === idx ? { ...s, score } : s)));
  };

  const handleEditScoreSubmit = () => {
    if (!editingScoreUpdate) return;
    if (!editScoreReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for this score change.", variant: "destructive" });
      return;
    }
    if (editScoreNotes.trim().length < 10) {
      toast({ title: "Validation Error", description: "Notes must be at least 10 characters.", variant: "destructive" });
      return;
    }
    if (editScores.some((s) => s.score < 0 || s.score > 100 || Number.isNaN(s.score))) {
      toast({ title: "Validation Error", description: "Each score must be between 0 and 100.", variant: "destructive" });
      return;
    }
    updateScoreMutation.mutate({
      id: editingScoreUpdate.id,
      keyResultScores: JSON.stringify(editScores),
      notes: editScoreNotes,
      reason: editScoreReason,
      editedBy: staff.id,
      editedByName: staff.name,
    });
  };

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

        {staff.role === "basic" && leaders && leaders.length > 0 && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Your SPU Leaders
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {leaders.map(l => l.name).join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} active</Badge>
                )}
              </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Select value={planningYearFilter} onValueChange={setPlanningYearFilter}>
                <SelectTrigger className="w-40" data-testid="select-planning-year">
                  <SelectValue placeholder="Plan Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Plan Years</SelectItem>
                  {PLANNING_YEARS.map((py) => (
                    <SelectItem key={py} value={String(py)}>{formatPlanYearLabel(py, planStartYear)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                <SelectTrigger className="w-48" data-testid="select-quarter">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{ALL_QUARTERS_LABEL}</SelectItem>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {planningYearFilter !== "All"
                        ? formatQuarterTagForPlanYear(q.value, parseInt(planningYearFilter), planStartYear)
                        : q.label}
                    </SelectItem>
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

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear all
                </Button>
              )}
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
            <CardDescription>Scored</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-scored">
              {scoredCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {unscoredCount} not yet scored
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
        <Accordion type="multiple" className="space-y-4" defaultValue={[]}>
          {filteredOkrs.map((okr) => {
            const keyResults = parseKeyResults(okr.keyResults);
            const latestUpdate = getLatestUpdate(okr.id);
            let keyResultScores: Array<{ keyResultNumber: number; description: string; score: number }> = [];
            if (latestUpdate?.keyResultScores) {
              if (Array.isArray(latestUpdate.keyResultScores)) {
                keyResultScores = latestUpdate.keyResultScores;
              } else if (typeof latestUpdate.keyResultScores === 'string') {
                try { keyResultScores = JSON.parse(latestUpdate.keyResultScores); } catch {}
              }
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
                      <Badge variant="outline" className="font-mono bg-[#aa182c] text-[#fcfcfc]">
                        {okr.okrNumber}
                      </Badge>
                      <span className="font-semibold">{okr.objectiveStatement}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatPeriodLabel(okr.quarter, okr.year, planStartYear)}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {okr.spu?.name || staff.spu.name}
                      </Badge>
                      {okr.subUnit && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {okr.subUnit.name}
                        </Badge>
                      )}
                      <span className="font-bold text-lg" data-testid={`text-okr-progress-${okr.id}`}>
                        {latestUpdate?.averageScore ?? okr.currentValue}%
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-2">
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
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">University Strategic Objective(s)</h4>
                      <div className="space-y-1">
                        {parseMultiSelectField(okr.universityObjective).map((obj, i) => (
                          <p key={i} className="text-sm">{obj}</p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">University Key Result(s)</h4>
                      <div className="space-y-1">
                        {parseMultiSelectField(okr.universityKeyResult).map((kr, i) => (
                          <p key={i} className="text-sm">{kr}</p>
                        ))}
                      </div>
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
                          Latest Update ({formatPeriodLabel(latestUpdate.quarter, latestUpdate.year, planStartYear)})
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

                    {((okr.collaborationSpus && okr.collaborationSpus.length > 0)
                        || (okr.collaborationSubUnits && okr.collaborationSubUnits.length > 0)
                        || (okr.orphanCollaboratorIds && okr.orphanCollaboratorIds.length > 0)
                        || okr.collaborationSpu) && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Collaborators</h4>
                        <div className="flex flex-wrap gap-1">
                          {okr.collaborationSpus?.map((collabSpu) => (
                            <Badge key={`spu-${collabSpu.id}`} variant="outline">{collabSpu.name}</Badge>
                          ))}
                          {okr.collaborationSubUnits?.map((su) => (
                            <Badge key={`sub-${su.id}`} variant="outline">
                              {su.spuName ? `${su.spuName} — ${su.name}` : su.name}
                            </Badge>
                          ))}
                          {(!okr.collaborationSpus || okr.collaborationSpus.length === 0)
                            && (!okr.collaborationSubUnits || okr.collaborationSubUnits.length === 0)
                            && okr.collaborationSpu && (
                            <Badge variant="outline">{okr.collaborationSpu.name}</Badge>
                          )}
                          {okr.orphanCollaboratorIds?.map((id) => (
                            <Badge key={`orphan-${id}`} variant="outline" className="text-muted-foreground italic">
                              (deleted)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Link href={`/quarterly-update?okrId=${okr.id}&quarter=${okr.quarter}&year=${okr.year}`}>
                        <Button variant="outline" size="sm" data-testid={`button-update-${okr.id}`}>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Update Progress
                        </Button>
                      </Link>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(okr)}
                          data-testid={`button-edit-okr-${okr.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      {isAdmin && latestUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditScoreDialog(okr, latestUpdate)}
                          data-testid={`button-edit-score-${okr.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit Score
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={!!editingOkr} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit OKR</DialogTitle>
            <DialogDescription>
              Update details for {editingOkr?.okrNumber} - {editingOkr ? formatPeriodLabel(editingOkr.quarter, editingOkr.year, planStartYear) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-objective">Objective Statement</Label>
              <Textarea
                id="edit-objective"
                value={editObjectiveStatement}
                onChange={(e) => setEditObjectiveStatement(e.target.value)}
                rows={3}
                data-testid="input-edit-objective"
              />
              {editObjectiveStatement.length > 0 && editObjectiveStatement.length < 20 && (
                <p className="text-xs text-destructive">Must be at least 20 characters</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Plan Year</Label>
                <Select value={String(editPlanYear)} onValueChange={(v) => setEditPlanYear(Number(v))}>
                  <SelectTrigger data-testid="select-edit-plan-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_YEARS.map((py) => (
                      <SelectItem key={py} value={String(py)}>{formatPlanYearLabel(py, planStartYear)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Quarter</Label>
                <Select value={editQuarter} onValueChange={setEditQuarter}>
                  <SelectTrigger data-testid="select-edit-quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{formatQuarterTagForPlanYear(q.value, editPlanYear, planStartYear)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Key Results</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEditKeyResult}
                  data-testid="button-add-key-result"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {editKeyResults.map((kr, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs no-default-active-elevate">KR {idx + 1}</Badge>
                        {editKeyResults.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEditKeyResult(idx)}
                            data-testid={`button-remove-kr-${idx}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={kr.description}
                        onChange={(e) => updateEditKeyResult(idx, "description", e.target.value)}
                        rows={2}
                        data-testid={`input-edit-kr-${idx}`}
                      />
                      {kr.description.length > 0 && kr.description.length < 10 && (
                        <p className="text-xs text-destructive">Must be at least 10 characters</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Collaboration SPU(s) or Sub-Unit(s) (Optional)</Label>
              <MultiSelectSpus
                options={editCollaborationOptions}
                selectedIds={editCollaborationIds}
                onChange={setEditCollaborationIds}
                placeholder="Not Applicable"
                testIdPrefix="select-edit-collaboration-spu"
              />
              <p className="text-xs text-muted-foreground">
                If you are collaborating with one or more other SPUs or sub-units, select them here.
              </p>
            </div>

            <div className="space-y-2">
              <Label>University Level Strategic Objective(s) *</Label>
              <MultiSelectCheckboxes
                options={editObjectiveOptions}
                selected={editUniversityObjectives}
                onChange={setEditUniversityObjectives}
                placeholder="Select strategic objective(s)..."
                testIdPrefix="select-edit-university-objective"
              />
              {editUniversityObjectives.length > 0 && (
                <div className="rounded-md border border-input bg-muted/30 p-3 space-y-2" data-testid="edit-selected-objectives-display">
                  <p className="text-xs font-medium text-muted-foreground">Selected Objective(s):</p>
                  {editUniversityObjectives.map((item, idx) => (
                    <p key={idx} className="text-sm leading-relaxed" data-testid={`edit-selected-objective-text-${idx}`}>{item}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>University-Level Key Result(s) *</Label>
              <MultiSelectCheckboxes
                options={editKeyResultOptions}
                selected={editUniversityKeyResults}
                onChange={setEditUniversityKeyResults}
                placeholder="Select key result(s)..."
                testIdPrefix="select-edit-university-key-result"
              />
              {editUniversityKeyResults.length > 0 && (
                <div className="rounded-md border border-input bg-muted/30 p-3 space-y-2" data-testid="edit-selected-key-results-display">
                  <p className="text-xs font-medium text-muted-foreground">Selected Key Result(s):</p>
                  {editUniversityKeyResults.map((item, idx) => (
                    <p key={idx} className="text-sm leading-relaxed" data-testid={`edit-selected-key-result-text-${idx}`}>{item}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="edit-reason" className="text-destructive font-semibold">
                Reason for editing *
              </Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Please explain why this OKR is being edited..."
                rows={3}
                data-testid="input-edit-reason"
              />
              {editReason.length === 0 && (
                <p className="text-xs text-muted-foreground">A reason is required to save changes</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editReason.trim() || updateOkrMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateOkrMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingScoreUpdate} onOpenChange={(open) => { if (!open) closeEditScoreDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Score</DialogTitle>
            <DialogDescription>
              Correct the submitted score for {editingScoreOkr?.okrNumber} - {editingScoreUpdate ? formatPeriodLabel(editingScoreUpdate.quarter, editingScoreUpdate.year, planStartYear) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Key Result Scores</Label>
              {editScores.map((s, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                  <div className="flex-1 space-y-1">
                    <Badge variant="outline" className="text-xs no-default-active-elevate">KR {s.keyResultNumber}</Badge>
                    <p className="text-sm">{s.description}</p>
                  </div>
                  <div className="w-24 space-y-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.score}
                      onChange={(e) => updateEditScore(idx, parseInt(e.target.value) || 0)}
                      data-testid={`input-edit-score-${idx}`}
                    />
                    <p className="text-xs text-muted-foreground text-center">0-100%</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-score-notes">Notes</Label>
              <Textarea
                id="edit-score-notes"
                value={editScoreNotes}
                onChange={(e) => setEditScoreNotes(e.target.value)}
                rows={3}
                placeholder="Progress notes for this update..."
                data-testid="input-edit-score-notes"
              />
              {editScoreNotes.trim().length > 0 && editScoreNotes.trim().length < 10 && (
                <p className="text-xs text-destructive">Must be at least 10 characters</p>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="edit-score-reason" className="text-destructive font-semibold">
                Reason for editing *
              </Label>
              <Textarea
                id="edit-score-reason"
                value={editScoreReason}
                onChange={(e) => setEditScoreReason(e.target.value)}
                placeholder="Please explain why this score is being corrected..."
                rows={3}
                data-testid="input-edit-score-reason"
              />
              {editScoreReason.length === 0 && (
                <p className="text-xs text-muted-foreground">A reason is required to save changes</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditScoreDialog} data-testid="button-cancel-edit-score">
              Cancel
            </Button>
            <Button
              onClick={handleEditScoreSubmit}
              disabled={!editScoreReason.trim() || updateScoreMutation.isPending}
              data-testid="button-confirm-edit-score"
            >
              {updateScoreMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
