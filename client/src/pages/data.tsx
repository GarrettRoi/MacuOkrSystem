import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Edit, Database, Trash2, AlertTriangle, Filter, X, Upload, FileUp, Plus, Minus, Search, Link, Unlink, Eye, FileText, Shuffle, CheckCircle, Clock, HardDriveDownload, RotateCcw, Shield } from "lucide-react";
import { apiRequest, queryClient, getErrorMessage, logClientError } from "@/lib/queryClient";
import type { OkrWithDetails, QuarterlyUpdate, Staff, Spu, SubUnit, Year, UniversityObjectiveWithKeyResults, EditLog, UnmatchedScore, DataBackupMeta, StaffWithDetails } from "@shared/schema";
import { getQuarterLabel, parseMultiSelectField, QUARTERS, getPlanningYear, PLANNING_YEARS, ALL_QUARTERS_LABEL } from "@shared/schema";
import { compareNames } from "@/lib/utils";
import { MultiSelectSpus } from "@/components/multi-select-spus";

interface AggregatedOkr extends OkrWithDetails {
  derivedProgress: number;
  quarterlyUpdates: Array<QuarterlyUpdate & { keyResultScoresParsed: any }>;
}

const editOkrSchema = z.object({
  objectiveStatement: z.string().min(20, "Objective must be at least 20 characters"),
  okrNumber: z.string().min(1, "OKR number is required"),
  quarter: z.string().min(1, "Quarter is required"),
  year: z.number().min(2020).max(2040),
  staffId: z.string().nullable(),
  spuId: z.string().min(1, "SPU is required"),
  subUnitId: z.string().nullable(),
  universityObjective: z.string(),
  universityKeyResult: z.string(),
  keyResults: z.string(),
  collaborationSpuIds: z.array(z.string()),
  collaborationSubUnitIds: z.array(z.string()).optional(),
});

const editQuarterlyUpdateSchema = z.object({
  keyResultScores: z.array(z.object({
    keyResultNumber: z.number(),
    description: z.string(),
    score: z.number().min(0).max(100),
  })),
  additionalKeyResults: z.string().optional(),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
});

type EditOkrFormValues = z.infer<typeof editOkrSchema>;
type EditQuarterlyUpdateFormValues = z.infer<typeof editQuarterlyUpdateSchema>;

const okrNumbers = ["OKR 1", "OKR 2", "OKR 3", "OKR 4", "OKR 5"];

export default function Data() {
  const { toast } = useToast();
  const [expandedOkrIds, setExpandedOkrIds] = useState<Set<string>>(new Set());
  const [expandedKrIds, setExpandedKrIds] = useState<Set<string>>(new Set());
  const [editingOkr, setEditingOkr] = useState<AggregatedOkr | null>(null);
  const [editingUpdate, setEditingUpdate] = useState<(QuarterlyUpdate & { keyResultScoresParsed: any }) | null>(null);
  
  // Filter states
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterPlanningYear, setFilterPlanningYear] = useState<string>("all");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [filterOkrNumber, setFilterOkrNumber] = useState<string>("all");
  const [filterSpu, setFilterSpu] = useState<string>("all");
  const [filterSubUnit, setFilterSubUnit] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Selection states
  const [selectedOkrIds, setSelectedOkrIds] = useState<Set<string>>(new Set());
  
  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  // Dismiss dialog states
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissingScoreId, setDismissingScoreId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  // Cell detail dialog (click to see full text)
  const [cellDetailDialog, setCellDetailDialog] = useState<{ open: boolean; label: string; content: string }>({ open: false, label: "", content: "" });
  const showCellDetail = (label: string, content: string) => {
    if (content && content !== "-") setCellDetailDialog({ open: true, label, content });
  };

  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing">("upload");
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [editingImportRow, setEditingImportRow] = useState<number | null>(null);

  // Score import states
  const [scoreImportDialogOpen, setScoreImportDialogOpen] = useState(false);
  const [scoreImportFile, setScoreImportFile] = useState<File | null>(null);
  const [scoreImportStep, setScoreImportStep] = useState<"upload" | "preview" | "importing">("upload");
  const [scoreImportPreviewData, setScoreImportPreviewData] = useState<any[]>([]);
  const [scoreImportSummary, setScoreImportSummary] = useState<any>(null);
  const [editingScoreRow, setEditingScoreRow] = useState<number | null>(null);
  const [linkingScoreRow, setLinkingScoreRow] = useState<number | null>(null);
  const [okrSearchQuery, setOkrSearchQuery] = useState("");
  const [okrSearchSpu, setOkrSearchSpu] = useState("all");
  const [okrSearchQuarter, setOkrSearchQuarter] = useState("all");
  const [okrSearchYear, setOkrSearchYear] = useState("all");

  // Section switcher (OKR Records vs Pending Matches vs Backups)
  const [activeDataSection, setActiveDataSection] = useState<"records" | "pending" | "backups">("records");

  // Backup state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<DataBackupMeta | null>(null);

  // Pending matches state — right column (unmatched scores)
  const [pendingFilterSpu, setPendingFilterSpu] = useState("all");
  const [pendingFilterQuarter, setPendingFilterQuarter] = useState("all");
  const [pendingFilterYear, setPendingFilterYear] = useState("all");

  // Pending matches state — left column (unscored OKRs)
  const [selectedUnscoredOkrId, setSelectedUnscoredOkrId] = useState<string | null>(null);
  const [unscoredFilterSpu, setUnscoredFilterSpu] = useState("all");
  const [unscoredFilterQuarter, setUnscoredFilterQuarter] = useState("all");
  const [unscoredFilterYear, setUnscoredFilterYear] = useState("all");
  const [unscoredSearch, setUnscoredSearch] = useState("");

  // Badge cycling state for import previews
  const [importCycleIndex, setImportCycleIndex] = useState<Record<string, number>>({});
  const [scoreCycleIndex, setScoreCycleIndex] = useState<Record<string, number>>({});

  const cycleToRow = (
    data: any[],
    filterFn: (r: any) => boolean,
    category: string,
    cycleState: Record<string, number>,
    setCycleState: (s: Record<string, number>) => void,
    rowPrefix: string
  ) => {
    const matchingIndices = data.map((r, i) => filterFn(r) ? i : -1).filter(i => i >= 0);
    if (matchingIndices.length === 0) return;
    const currentPos = cycleState[category] ?? -1;
    const nextIdx = matchingIndices.findIndex(i => i > currentPos);
    const targetIdx = nextIdx >= 0 ? matchingIndices[nextIdx] : matchingIndices[0];
    setCycleState({ ...cycleState, [category]: targetIdx });
    const el = document.querySelector(`[data-testid="${rowPrefix}-${targetIdx}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
    }
  };

  // Edit reason dialog
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [pendingOkrEdit, setPendingOkrEdit] = useState<{ id: string; updates: any } | null>(null);
  const [pendingUpdateEdit, setPendingUpdateEdit] = useState<{ id: string; updates: any } | null>(null);

  // Edit OKR key results state
  const [editKeyResults, setEditKeyResults] = useState<Array<{ description: string; percentage?: number }>>([]);

  const { data: okrsWithUpdates, isLoading } = useQuery<AggregatedOkr[]>({
    queryKey: ["/api/okrs-with-updates"],
  });

  const { data: allStaff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: years } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  const { data: subUnits } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: universityObjectives } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const { data: editLogsData } = useQuery<EditLog[]>({
    queryKey: ["/api/edit-logs"],
  });

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const { data: sessionData } = useQuery<{ authenticated: boolean; isAdmin?: boolean; selectedStaff?: StaffWithDetails }>({
    queryKey: ["/api/auth/session"],
  });
  const isSuperAdmin = sessionData?.selectedStaff?.role === "super_admin";

  const { data: backups, isLoading: backupsLoading } = useQuery<DataBackupMeta[]>({
    queryKey: ["/api/backups"],
    enabled: isSuperAdmin,
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/backups", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "Backup Created", description: "A manual backup has been created successfully." });
    },
    onError: () => {
      toast({ title: "Backup Failed", description: "Failed to create backup. Please try again.", variant: "destructive" });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/backups/${id}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unmatched-scores"] });
      setRestoreDialogOpen(false);
      setRestoringBackup(null);
      toast({ title: "Restore Complete", description: "The system has been restored to the selected backup." });
    },
    onError: (error: any) => {
      toast({ title: "Restore Failed", description: error?.message || "Failed to restore backup. Please try again.", variant: "destructive" });
    },
  });

  const [showEditLogs, setShowEditLogs] = useState(false);

  const okrSearchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (okrSearchSpu !== "all") params.append("spuId", okrSearchSpu);
    if (okrSearchQuarter !== "all") params.append("quarter", okrSearchQuarter);
    if (okrSearchYear !== "all") params.append("year", okrSearchYear);
    if (okrSearchQuery.trim()) params.append("q", okrSearchQuery.trim());
    return params.toString();
  }, [okrSearchSpu, okrSearchQuarter, okrSearchYear, okrSearchQuery]);

  const { data: searchedOkrs, isLoading: isSearchingOkrs } = useQuery<any[]>({
    queryKey: ["/api/okrs/search", okrSearchParams],
    queryFn: async () => {
      const res = await fetch(`/api/okrs/search?${okrSearchParams}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: linkingScoreRow !== null,
  });

  const { data: pendingUnmatchedScores, isLoading: isPendingLoading } = useQuery<UnmatchedScore[]>({
    queryKey: ["/api/unmatched-scores"],
  });

  const linkOkrToScoreRow = (rowIdx: number, okr: any) => {
    setScoreImportPreviewData(prev => {
      const updated = [...prev];
      const row = updated[rowIdx];
      const cleanErrors = row.errors.filter((e: string) => !e.startsWith('No matching OKR') && !e.startsWith('Duplicate:'));

      const existingOkr = okrsWithUpdates?.find(o => o.id === okr.id);
      const hasExistingScore = existingOkr?.quarterlyUpdates?.some(
        (u: any) => u.quarter === row.quarter && u.year === row.year
      );
      const hasCsvDuplicate = updated.some(
        (r, i) => i !== rowIdx && r.matchedOkrId === okr.id && r.quarter === row.quarter && r.year === row.year
      );

      const isDuplicate = hasExistingScore || hasCsvDuplicate;
      let duplicateOfRow: number | null = null;
      if (isDuplicate) {
        if (hasExistingScore) {
          cleanErrors.push('Duplicate: A score for this OKR already exists in the database for this period');
        } else {
          const origRow = updated.find(
            (r, i) => i !== rowIdx && r.matchedOkrId === okr.id && r.quarter === row.quarter && r.year === row.year
          );
          duplicateOfRow = origRow?.rowIndex || null;
          cleanErrors.push(`Duplicate: Same OKR score as row ${duplicateOfRow || '?'} in this file`);
        }
      }

      updated[rowIdx] = {
        ...row,
        matchedOkrId: okr.id,
        matchedOkrInfo: `Manually linked to ${okr.okrNumber}`,
        matchedOkrDetails: okr,
        errors: cleanErrors,
        include: !isDuplicate && cleanErrors.length === 0,
        isDuplicate,
        duplicateType: hasExistingScore ? 'existing' : hasCsvDuplicate ? 'csv' : null,
        duplicateOfRow,
      };
      return updated;
    });
    setLinkingScoreRow(null);
    if (okr.objectiveStatement) {
      toast({ title: "OKR Linked", description: `Linked to ${okr.okrNumber}: ${okr.objectiveStatement.substring(0, 60)}...` });
    } else {
      toast({ title: "OKR Linked", description: `Linked to ${okr.okrNumber}` });
    }
  };

  const unlinkOkrFromScoreRow = (rowIdx: number) => {
    setScoreImportPreviewData(prev => {
      const updated = [...prev];
      updated[rowIdx] = {
        ...updated[rowIdx],
        matchedOkrId: null,
        matchedOkrInfo: '',
        matchedOkrDetails: null,
        errors: [...updated[rowIdx].errors, `No matching OKR found for ${updated[rowIdx].okrNumber} in ${updated[rowIdx].quarter} ${updated[rowIdx].year}`],
        include: false,
      };
      return updated;
    });
  };

  const parseKeyResultsForDisplay = (krText: any): string[] => {
    if (!krText) return [];
    if (Array.isArray(krText)) return krText.map((kr: any) => typeof kr === 'string' ? kr : kr.description || '');
    if (typeof krText === 'string') {
      try {
        const parsed = JSON.parse(krText);
        if (Array.isArray(parsed)) return parsed.map((kr: any) => typeof kr === 'string' ? kr : kr.description || '');
      } catch {}
      return [krText];
    }
    return [];
  };

  const getOkrStatus = (okr: AggregatedOkr): "unscored" | "collab" | "ok" => {
    if (!okr.quarterlyUpdates || okr.quarterlyUpdates.length === 0) return "unscored";
    if (okr.quarterlyUpdates.some((u: any) => u.isCollaborativeScore || u.isPrimaryScore === false)) return "collab";
    return "ok";
  };

  // Filter the data
  const filteredOkrs = useMemo(() => {
    if (!okrsWithUpdates) return [];
    
    return okrsWithUpdates.filter((okr) => {
      if (filterStaff !== "all" && okr.staffId !== filterStaff) return false;
      if (filterYear !== "all" && okr.year.toString() !== filterYear) return false;
      if (filterPlanningYear !== "all" && getPlanningYear(okr.quarter, okr.year, planStartYear) !== parseInt(filterPlanningYear)) return false;
      if (filterQuarter !== "all" && okr.quarter !== filterQuarter) return false;
      if (filterOkrNumber !== "all" && okr.okrNumber !== filterOkrNumber) return false;
      if (filterSpu !== "all" && okr.spuId !== filterSpu) return false;
      if (filterSubUnit !== "all" && okr.subUnitId !== filterSubUnit) return false;
      if (filterStatus !== "all") {
        const status = getOkrStatus(okr);
        if (filterStatus === "unscored" && status !== "unscored") return false;
        if (filterStatus === "collab" && status !== "collab") return false;
        if (filterStatus === "scored" && status === "unscored") return false;
      }
      return true;
    });
  }, [okrsWithUpdates, filterStaff, filterYear, filterPlanningYear, filterQuarter, filterOkrNumber, filterSpu, filterSubUnit, filterStatus, planStartYear]);

  // OKRs with no quarterly update — used in left column of Pending Matches tab
  const unscoredOkrs = useMemo(() => {
    if (!okrsWithUpdates) return [];
    return okrsWithUpdates.filter(okr => {
      if (unscoredFilterSpu !== "all" && okr.spuId !== unscoredFilterSpu) return false;
      if (unscoredFilterQuarter !== "all" && okr.quarter !== unscoredFilterQuarter) return false;
      if (unscoredFilterYear !== "all" && String(okr.year) !== unscoredFilterYear) return false;
      if (unscoredSearch.trim()) {
        const s = unscoredSearch.toLowerCase();
        if (
          !okr.objectiveStatement?.toLowerCase().includes(s) &&
          !okr.staff?.name?.toLowerCase().includes(s) &&
          !okr.spu?.name?.toLowerCase().includes(s) &&
          !okr.okrNumber?.toLowerCase().includes(s)
        ) return false;
      }
      return getOkrStatus(okr) === "unscored";
    });
  }, [okrsWithUpdates, unscoredFilterSpu, unscoredFilterQuarter, unscoredFilterYear, unscoredSearch]);

  // Check if any filters are active
  const hasActiveFilters = filterStaff !== "all" || filterYear !== "all" || filterPlanningYear !== "all" || filterQuarter !== "all" || filterOkrNumber !== "all" || filterSpu !== "all" || filterSubUnit !== "all" || filterStatus !== "all";
  
  const clearAllFilters = () => {
    setFilterStaff("all");
    setFilterYear("all");
    setFilterPlanningYear("all");
    setFilterQuarter("all");
    setFilterOkrNumber("all");
    setFilterSpu("all");
    setFilterSubUnit("all");
    setFilterStatus("all");
  };

  const toggleExpanded = (okrId: string) => {
    const newExpanded = new Set(expandedOkrIds);
    if (newExpanded.has(okrId)) {
      newExpanded.delete(okrId);
    } else {
      newExpanded.add(okrId);
    }
    setExpandedOkrIds(newExpanded);
  };

  const toggleKrExpand = (key: string) => {
    setExpandedKrIds(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const toggleSelection = (okrId: string) => {
    const newSelected = new Set(selectedOkrIds);
    if (newSelected.has(okrId)) {
      newSelected.delete(okrId);
    } else {
      newSelected.add(okrId);
    }
    setSelectedOkrIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOkrIds.size === filteredOkrs.length) {
      setSelectedOkrIds(new Set());
    } else {
      setSelectedOkrIds(new Set(filteredOkrs.map(okr => okr.id)));
    }
  };

  const okrForm = useForm<EditOkrFormValues>({
    resolver: zodResolver(editOkrSchema),
  });

  const updateForm = useForm<EditQuarterlyUpdateFormValues>({
    resolver: zodResolver(editQuarterlyUpdateSchema),
  });

  const updateOkrMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any; reason: string }) => {
      return await apiRequest("PUT", `/api/okrs/${data.id}`, {
        ...data.updates,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      setEditingOkr(null);
      toast({
        title: "OKR Updated",
        description: "The OKR has been successfully updated.",
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("data:okr-update", error);
      toast({
        title: "Update Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const updateQuarterlyUpdateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any; reason: string }) => {
      return await apiRequest("PUT", `/api/quarterly-updates/${data.id}`, {
        ...data.updates,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quarterly-updates"] });
      setEditingUpdate(null);
      toast({
        title: "Update Saved",
        description: "The quarterly update has been successfully saved.",
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("data:quarterly-update-save", error);
      toast({
        title: "Save Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const deleteOkrMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest("DELETE", `/api/okrs/${id}`, { reason, deletedByName: "Admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edit-logs"] });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("data:okr-delete", error);
      toast({
        title: "Delete Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const previewCsvMutation = useMutation({
    mutationFn: async (tsvData: string) => {
      const res = await apiRequest("POST", "/api/import/csv/preview", { tsvData });
      return await res.json();
    },
    onSuccess: (data: any) => {
      const rows = (data.rows || []).slice().sort((a: any, b: any) => {
        return (a.rowIndex || 0) - (b.rowIndex || 0);
      });
      setImportPreviewData(rows);
      setImportSummary({
        totalRows: data.totalRows,
        parsedRows: data.parsedRows,
        skippedEmpty: data.skippedEmpty,
        detectedHeaders: data.detectedHeaders,
      });
      setImportStep("preview");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Parse TSV",
        description: error?.message || "Could not parse the TSV file. Make sure it is a tab-separated export from the OKR form.",
        variant: "destructive",
      });
    },
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await apiRequest("POST", "/api/import/csv/confirm", { rows });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/years"] });
      setImportDialogOpen(false);
      resetImportState();

      const errors = data.results?.errors || [];
      if (errors.length > 0) {
        toast({
          title: "Import Completed with Issues",
          description: data.message,
          variant: "default",
        });
        console.error("Import errors:", errors);
      } else {
        toast({
          title: "Import Successful",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error?.message || "Failed to import data.",
        variant: "destructive",
      });
      setImportStep("preview");
    },
  });

  const previewScoreMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/import/scores/preview", { csvData });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setScoreImportPreviewData(data.rows || []);
      setScoreImportSummary({
        totalRows: data.totalRows,
        parsedRows: data.parsedRows,
        skippedEmpty: data.skippedEmpty,
        matchedRows: data.matchedRows,
        unmatchedRows: data.unmatchedRows,
        detectedHeaders: data.detectedHeaders,
      });
      setScoreImportStep("preview");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Parse Score CSV",
        description: error?.message || "Could not parse the score CSV file. Please check the format.",
        variant: "destructive",
      });
    },
  });

  const confirmScoreImportMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await apiRequest("POST", "/api/import/scores/confirm", { rows });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quarterly-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unmatched-scores"] });
      setScoreImportDialogOpen(false);
      resetScoreImportState();

      const errors = data.results?.errors || [];
      if (errors.length > 0) {
        toast({
          title: "Score Import Completed with Issues",
          description: data.message,
          variant: "default",
        });
        console.error("Score import errors:", errors);
      } else {
        toast({
          title: "Score Import Successful",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Score Import Failed",
        description: error?.message || "Failed to import scores.",
        variant: "destructive",
      });
      setScoreImportStep("preview");
    },
  });

  const matchUnmatchedScoreMutation = useMutation({
    mutationFn: async ({ id, okrId }: { id: string; okrId: string }) => {
      const res = await apiRequest("POST", `/api/unmatched-scores/${id}/match`, { okrId });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to match score");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unmatched-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      toast({ title: "Score Matched", description: "The score has been linked to the OKR and a quarterly update was created." });
    },
    onError: (error: any) => {
      toast({ title: "Match Failed", description: error.message, variant: "destructive" });
    },
  });

  const dismissUnmatchedScoreMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("DELETE", `/api/unmatched-scores/${id}?action=dismiss`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unmatched-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edit-logs"] });
      toast({ title: "Score Dismissed", description: "The unmatched score has been dismissed." });
    },
    onError: () => {
      toast({ title: "Dismiss Failed", description: "Could not dismiss this score.", variant: "destructive" });
    },
  });

  const handleDismissScore = (scoreId: string) => {
    setDismissingScoreId(scoreId);
    setDismissReason("");
    setDismissDialogOpen(true);
  };

  const confirmDismiss = () => {
    if (!dismissReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for dismissing this score.", variant: "destructive" });
      return;
    }
    if (!dismissingScoreId) return;
    dismissUnmatchedScoreMutation.mutate({ id: dismissingScoreId, reason: dismissReason.trim() });
    setDismissDialogOpen(false);
    setDismissingScoreId(null);
    setDismissReason("");
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportStep("upload");
    setImportPreviewData([]);
    setImportSummary(null);
    setEditingImportRow(null);
    setImportCycleIndex({});
  };

  const resetScoreImportState = () => {
    setScoreImportFile(null);
    setScoreImportStep("upload");
    setScoreImportPreviewData([]);
    setScoreImportSummary(null);
    setEditingScoreRow(null);
    setLinkingScoreRow(null);
    setScoreCycleIndex({});
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFile(file);
  };

  const handlePreviewCsv = async () => {
    if (!importFile) return;
    const tsvData = await importFile.text();
    previewCsvMutation.mutate(tsvData);
  };

  const handleConfirmImport = async () => {
    const includedRows = importPreviewData.filter(r => r.include);
    if (includedRows.length === 0) {
      toast({ title: "No Rows Selected", description: "Please include at least one row to import.", variant: "destructive" });
      return;
    }
    setImportStep("importing");
    confirmImportMutation.mutate(includedRows);
  };

  const handleScoreFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScoreImportFile(file);
  };

  const handlePreviewScores = async () => {
    if (!scoreImportFile) return;
    const csvData = await scoreImportFile.text();
    previewScoreMutation.mutate(csvData);
  };

  const handleConfirmScoreImport = async () => {
    const includedRows = scoreImportPreviewData.filter(r => r.include);
    const unmatchedRows = scoreImportPreviewData.filter(r => !r.matchedOkrId && !r.isDuplicate);
    if (includedRows.length === 0 && unmatchedRows.length === 0) {
      toast({ title: "Nothing to Import", description: "No matched rows selected and no unmatched rows to save for manual matching.", variant: "destructive" });
      return;
    }
    setScoreImportStep("importing");
    // Send ALL rows — server handles matched (include=true) vs unmatched (no matchedOkrId) appropriately
    confirmScoreImportMutation.mutate(scoreImportPreviewData);
  };

  const updateScoreRow = (index: number, field: string, value: any) => {
    setScoreImportPreviewData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleScoreRow = (index: number) => {
    setScoreImportPreviewData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], include: !updated[index].include };
      return updated;
    });
  };

  const updateScoreKrScore = (rowIndex: number, krIndex: number, newScore: number) => {
    setScoreImportPreviewData(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const krScores = [...(row.krScores || [])];
      krScores[krIndex] = { ...krScores[krIndex], score: Math.min(100, Math.max(0, newScore)) };
      row.krScores = krScores;
      row.averageScore = krScores.length > 0
        ? Math.round(krScores.reduce((sum: number, kr: any) => sum + kr.score, 0) / krScores.length)
        : row.averageScore;
      updated[rowIndex] = row;
      return updated;
    });
  };

  const updateImportRow = (index: number, field: string, value: any) => {
    setImportPreviewData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleImportRow = (index: number) => {
    setImportPreviewData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], include: !updated[index].include };
      return updated;
    });
  };

  const handleDeleteSingle = (okrId: string) => {
    setDeleteMode("single");
    setSingleDeleteId(okrId);
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteBulk = () => {
    if (selectedOkrIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one OKR to delete.",
        variant: "destructive",
      });
      return;
    }
    setDeleteMode("bulk");
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const expectedText = deleteMode === "single" ? "DELETE" : `DELETE ${selectedOkrIds.size}`;
    
    if (deleteConfirmText !== expectedText) {
      toast({
        title: "Confirmation Required",
        description: `Please type "${expectedText}" to confirm deletion.`,
        variant: "destructive",
      });
      return;
    }

    const reason = deleteReason.trim() || "No reason provided";

    try {
      if (deleteMode === "single" && singleDeleteId) {
        await deleteOkrMutation.mutateAsync({ id: singleDeleteId, reason });
        toast({
          title: "OKR Deleted",
          description: "The OKR has been permanently deleted.",
        });
      } else if (deleteMode === "bulk") {
        const deletePromises = Array.from(selectedOkrIds).map(id => deleteOkrMutation.mutateAsync({ id, reason }));
        await Promise.all(deletePromises);
        setSelectedOkrIds(new Set());
        toast({
          title: "OKRs Deleted",
          description: `${selectedOkrIds.size} OKR(s) have been permanently deleted.`,
        });
      }
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      setDeleteReason("");
      setSingleDeleteId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const parseKeyResultsJson = (json: any): Array<{ description: string; percentage?: number }> => {
    let arr: any[] = [];
    if (!json) return [];
    if (Array.isArray(json)) {
      arr = json;
    } else if (typeof json === 'string') {
      try { arr = JSON.parse(json); } catch { return []; }
    } else {
      return [];
    }
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) =>
      typeof item === 'string' ? { description: item } : item
    );
  };

  const handleEditOkr = (okr: AggregatedOkr) => {
    setEditingOkr(okr);
    const krs = parseKeyResultsJson(okr.keyResults);
    setEditKeyResults(krs);
    okrForm.reset({
      objectiveStatement: okr.objectiveStatement,
      okrNumber: okr.okrNumber,
      quarter: okr.quarter,
      year: okr.year,
      staffId: okr.staffId,
      spuId: okr.spuId,
      subUnitId: okr.subUnitId || null,
      universityObjective: okr.universityObjective,
      universityKeyResult: okr.universityKeyResult,
      keyResults: okr.keyResults,
      collaborationSpuIds: (() => {
        // Encode each existing collaborator as "spu:UUID" or "sub:UUID" so the
        // shared picker can render both kinds and the submit handler can split
        // them back into the right server arrays.
        const ids: string[] = [];
        const spuList: any[] = (okr as any).collaborationSpus || [];
        const subUnitList: any[] = (okr as any).collaborationSubUnits || [];
        for (const s of spuList) ids.push(`spu:${s.id}`);
        for (const su of subUnitList) ids.push(`sub:${su.id}`);
        if (ids.length === 0) {
          const legacyArr = (okr.collaborationSpuIds as string[] | null) || [];
          if (legacyArr.length > 0) {
            for (const id of legacyArr) ids.push(`spu:${id}`);
          } else if (okr.collaborationSpuId) {
            ids.push(`spu:${okr.collaborationSpuId}`);
          }
        }
        return ids;
      })(),
      collaborationSubUnitIds: [],
    });
  };

  const handleEditUpdate = (update: QuarterlyUpdate & { keyResultScoresParsed: any }) => {
    setEditingUpdate(update);
    updateForm.reset({
      keyResultScores: update.keyResultScoresParsed || [],
      additionalKeyResults: update.additionalKeyResults || "",
      notes: update.notes,
    });
  };

  const onSubmitOkr = (data: EditOkrFormValues) => {
    if (!editingOkr) return;
    // Split the prefixed picker values ("spu:UUID" / "sub:UUID") into the two
    // server-side arrays so SPU collaborators and sub-unit collaborators land
    // in the correct columns / join-table rows.
    const prefixed = data.collaborationSpuIds || [];
    const collaborationSpuIds = prefixed
      .filter((v) => v.startsWith("spu:"))
      .map((v) => v.slice(4));
    const collaborationSubUnitIds = prefixed
      .filter((v) => v.startsWith("sub:"))
      .map((v) => v.slice(4));
    const updates = {
      ...data,
      collaborationSpuIds,
      collaborationSubUnitIds,
      keyResults: JSON.stringify(editKeyResults),
    };
    setPendingOkrEdit({ id: editingOkr.id, updates });
    setEditReason("");
    setReasonDialogOpen(true);
  };

  const onSubmitUpdate = (data: EditQuarterlyUpdateFormValues) => {
    if (!editingUpdate) return;
    const updates = {
      keyResultScores: JSON.stringify(data.keyResultScores),
      additionalKeyResults: data.additionalKeyResults,
      notes: data.notes,
    };
    setPendingUpdateEdit({ id: editingUpdate.id, updates });
    setEditReason("");
    setReasonDialogOpen(true);
  };

  const confirmReasonAndSave = () => {
    if (!editReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for this edit.", variant: "destructive" });
      return;
    }
    if (pendingOkrEdit) {
      updateOkrMutation.mutate({ id: pendingOkrEdit.id, updates: pendingOkrEdit.updates, reason: editReason });
      setPendingOkrEdit(null);
    } else if (pendingUpdateEdit) {
      updateQuarterlyUpdateMutation.mutate({ id: pendingUpdateEdit.id, updates: pendingUpdateEdit.updates, reason: editReason });
      setPendingUpdateEdit(null);
    }
    setReasonDialogOpen(false);
    setEditReason("");
  };

  const updateKeyResult = (index: number, field: string, value: string | number) => {
    const updated = [...editKeyResults];
    (updated[index] as any)[field] = value;
    setEditKeyResults(updated);
  };

  const addKeyResult = () => {
    setEditKeyResults([...editKeyResults, { description: "", percentage: undefined }]);
  };

  const removeKeyResult = (index: number) => {
    setEditKeyResults(editKeyResults.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl font-semibold">OKR Data Management</CardTitle>
                <CardDescription className="mt-1">
                  View, filter, edit, and delete OKR submissions and quarterly updates
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedOkrIds.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteBulk}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedOkrIds.size})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                data-testid="button-import-csv"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import OKRs
              </Button>
              <Button
                variant="outline"
                onClick={() => setScoreImportDialogOpen(true)}
                data-testid="button-import-scores"
              >
                <FileUp className="h-4 w-4 mr-2" />
                Import Scores
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Section Tab Navigation */}
          <div className="flex items-center gap-1 border-b pb-3 flex-wrap">
            <Button
              variant={activeDataSection === "records" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveDataSection("records")}
              data-testid="tab-okr-records"
            >
              <Database className="h-4 w-4 mr-2" />
              OKR Records
            </Button>
            <Button
              variant={activeDataSection === "pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveDataSection("pending")}
              data-testid="tab-pending-matches"
              className="relative"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Pending Matches
              {pendingUnmatchedScores && pendingUnmatchedScores.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                  {pendingUnmatchedScores.length}
                </Badge>
              )}
            </Button>
            {isSuperAdmin && (
              <Button
                variant={activeDataSection === "backups" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveDataSection("backups")}
                data-testid="tab-backups"
              >
                <HardDriveDownload className="h-4 w-4 mr-2" />
                Backups & Restore
              </Button>
            )}
          </div>

          {/* OKR Records Section */}
          {activeDataSection === "records" && <>

          {/* Filter Section */}
          <Card className="bg-muted/30">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      Active
                    </Badge>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {/* Staff Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Staff</label>
                  <Select value={filterStaff} onValueChange={setFilterStaff}>
                    <SelectTrigger data-testid="select-filter-staff">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {allStaff?.slice().sort((a, b) => compareNames(a.name, b.name)).map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger data-testid="select-filter-year">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years?.sort((a, b) => b.year - a.year).map((yearItem) => (
                        <SelectItem key={yearItem.id} value={yearItem.year.toString()}>
                          {yearItem.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Planning Year Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Plan Year</label>
                  <Select value={filterPlanningYear} onValueChange={setFilterPlanningYear}>
                    <SelectTrigger data-testid="select-filter-planning-year">
                      <SelectValue placeholder="All Plan Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plan Years</SelectItem>
                      {PLANNING_YEARS.map((py) => (
                        <SelectItem key={py} value={String(py)}>
                          Year {py}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quarter Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Quarter</label>
                  <Select value={filterQuarter} onValueChange={setFilterQuarter}>
                    <SelectTrigger data-testid="select-filter-quarter">
                      <SelectValue placeholder={ALL_QUARTERS_LABEL} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ALL_QUARTERS_LABEL}</SelectItem>
                      <SelectItem value="Q1">{getQuarterLabel("Q1")}</SelectItem>
                      <SelectItem value="Q2">{getQuarterLabel("Q2")}</SelectItem>
                      <SelectItem value="Q3">{getQuarterLabel("Q3")}</SelectItem>
                      <SelectItem value="Q4">{getQuarterLabel("Q4")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* OKR Number Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">OKR Number</label>
                  <Select value={filterOkrNumber} onValueChange={setFilterOkrNumber}>
                    <SelectTrigger data-testid="select-filter-okr">
                      <SelectValue placeholder="All OKRs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All OKRs</SelectItem>
                      {okrNumbers.map((okrNum) => (
                        <SelectItem key={okrNum} value={okrNum}>
                          {okrNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SPU Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">SPU</label>
                  <Select value={filterSpu} onValueChange={setFilterSpu}>
                    <SelectTrigger data-testid="select-filter-spu">
                      <SelectValue placeholder="All SPUs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All SPUs</SelectItem>
                      {spus?.map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>
                          {spu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub-unit Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Sub-unit</label>
                  <Select value={filterSubUnit} onValueChange={setFilterSubUnit}>
                    <SelectTrigger data-testid="select-filter-sub-unit">
                      <SelectValue placeholder="All Sub-units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-units</SelectItem>
                      {(filterSpu !== "all" ? subUnits?.filter(su => su.spuId === filterSpu) : subUnits)?.map((su) => (
                        <SelectItem key={su.id} value={su.id}>
                          {su.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Score Status Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Score Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="unscored">No Score</SelectItem>
                      <SelectItem value="scored">Has Score</SelectItem>
                      <SelectItem value="collab">Collaborative Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Showing {filteredOkrs.length} of {okrsWithUpdates?.length || 0} OKRs
              </span>
              {okrsWithUpdates && (() => {
                const unscoredCount = okrsWithUpdates.filter(o => getOkrStatus(o) === "unscored").length;
                const collabCount = okrsWithUpdates.filter(o => getOkrStatus(o) === "collab").length;
                return (
                  <>
                    {unscoredCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterStatus(filterStatus === "unscored" ? "all" : "unscored")}
                        className={filterStatus === "unscored" ? "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300" : ""}
                        data-testid="button-filter-unscored"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {unscoredCount} No Score
                      </Button>
                    )}
                    {collabCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterStatus(filterStatus === "collab" ? "all" : "collab")}
                        className={filterStatus === "collab" ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300" : ""}
                        data-testid="button-filter-collab"
                      >
                        {collabCount} Collaborative
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
            {selectedOkrIds.size > 0 && (
              <span className="font-medium text-foreground">
                {selectedOkrIds.size} selected
              </span>
            )}
          </div>

          {/* Data Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredOkrs.length > 0 && selectedOkrIds.size === filteredOkrs.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>SPU</TableHead>
                  <TableHead>OKR Number</TableHead>
                  <TableHead>Quarter/Year</TableHead>
                  <TableHead>Objective</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredOkrs || filteredOkrs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {hasActiveFilters ? "No OKRs match the selected filters" : "No OKRs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOkrs.map((okr) => {
                    const isExpanded = expandedOkrIds.has(okr.id);
                    const isSelected = selectedOkrIds.has(okr.id);
                    const okrStatus = getOkrStatus(okr);
                    const rowBg = isSelected
                      ? 'bg-primary/5'
                      : okrStatus === "unscored"
                      ? 'bg-amber-50 dark:bg-amber-950/30'
                      : '';
                    return (
                      <Fragment key={okr.id}>
                        <TableRow className={`hover-elevate ${rowBg}`} data-testid={`row-okr-${okr.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(okr.id)}
                              data-testid={`checkbox-select-${okr.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleExpanded(okr.id)}
                              data-testid={`button-expand-${okr.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{okr.staff.name}</TableCell>
                          <TableCell>{okr.spu?.name || "N/A"}</TableCell>
                          <TableCell>{okr.okrNumber}</TableCell>
                          <TableCell>
                            {getQuarterLabel(okr.quarter)} {okr.year}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={okr.objectiveStatement}>{okr.objectiveStatement}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {okrStatus === "unscored" ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 w-fit text-xs" data-testid={`badge-status-${okr.id}`}>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  No Score
                                </Badge>
                              ) : okrStatus === "collab" ? (
                                <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 w-fit text-xs" data-testid={`badge-status-${okr.id}`}>
                                  Collaborative
                                </Badge>
                              ) : null}
                              <span className="font-semibold" data-testid={`text-progress-${okr.id}`}>
                                {okr.derivedProgress}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditOkr(okr)}
                                data-testid={`button-edit-okr-${okr.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteSingle(okr.id)}
                                data-testid={`button-delete-okr-${okr.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/30 p-0">
                              {(() => {
                                const krs = parseKeyResultsJson(okr.keyResults);
                                return (
                                  <div className="px-6 py-4 space-y-4">
                                    {/* Key Results accordion */}
                                    {(() => {
                                      // Collect all KR numbers that appear in any update score
                                      const scoredKrNums = new Set<number>();
                                      okr.quarterlyUpdates.forEach((update: any) => {
                                        (update.keyResultScoresParsed || []).forEach((s: any) => {
                                          scoredKrNums.add(Number(s.keyResultNumber));
                                        });
                                      });
                                      // Build unified KR list: defined KRs first, then any extra scored KRs not in definition
                                      const extraKrNums = Array.from(scoredKrNums)
                                        .filter(n => n > krs.length)
                                        .sort((a, b) => a - b);
                                      const allKrNums = [
                                        ...krs.map((_: any, i: number) => i + 1),
                                        ...extraKrNums,
                                      ];

                                      return (
                                        <div>
                                          <h4 className="font-semibold text-sm mb-2">Key Results</h4>
                                          {allKrNums.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No key results defined for this OKR.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {allKrNums.map((krNum) => {
                                                const krIdx = krNum - 1;
                                                const krDef = krs[krIdx] as { description: string } | undefined;
                                                const krKey = `${okr.id}-kr-${krIdx}`;
                                                const isKrExpanded = expandedKrIds.has(krKey);
                                                const submissions = okr.quarterlyUpdates.flatMap((update: any) => {
                                                  if (!update.keyResultScoresParsed) return [];
                                                  const krScore = update.keyResultScoresParsed.find((s: any) => Number(s.keyResultNumber) === krNum);
                                                  if (!krScore) return [];
                                                  return [{ update, krScore }];
                                                });
                                                return (
                                                  <div key={krNum} className="border rounded-md bg-background overflow-hidden" data-testid={`kr-item-${okr.id}-${krIdx}`}>
                                                    <button
                                                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                                                      onClick={() => toggleKrExpand(krKey)}
                                                      data-testid={`button-expand-kr-${okr.id}-${krIdx}`}
                                                    >
                                                      <div className="shrink-0 mt-0.5 text-muted-foreground">
                                                        {isKrExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KR {krNum}</span>
                                                          {!krDef && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-1.5 py-0 rounded">Score only</span>
                                                          )}
                                                        </div>
                                                        {krDef ? (
                                                          <p className="text-sm text-foreground leading-snug mt-0.5">{krDef.description}</p>
                                                        ) : (
                                                          <p className="text-sm text-muted-foreground italic mt-0.5">No description — scored via import</p>
                                                        )}
                                                      </div>
                                                      <div className="shrink-0 text-right ml-3">
                                                        {submissions.length > 0 ? (
                                                          <span className="text-sm font-bold tabular-nums">{submissions[0].krScore.score}%</span>
                                                        ) : (
                                                          <span className="text-xs text-muted-foreground italic">No score</span>
                                                        )}
                                                      </div>
                                                    </button>
                                                    {isKrExpanded && (
                                                      <div className="border-t bg-primary/5 px-4 py-3 space-y-3">
                                                        {submissions.length === 0 ? (
                                                          <p className="text-sm text-muted-foreground italic">No score submissions for this key result yet.</p>
                                                        ) : (
                                                          submissions.map(({ update, krScore }: any) => (
                                                            <div key={update.id} className="space-y-2" data-testid={`kr-submission-${update.id}-${krIdx}`}>
                                                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                  <span className="text-sm font-semibold">{getQuarterLabel(update.quarter)} {update.year}</span>
                                                                  <span className="text-sm font-bold text-foreground">— {krScore.score}%</span>
                                                                  {update.isPrimaryScore === false && (
                                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Secondary</Badge>
                                                                  )}
                                                                  {update.isCollaborativeScore && (
                                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0">Collab</Badge>
                                                                  )}
                                                                </div>
                                                                {update.scorerName && (
                                                                  <span className="text-xs text-muted-foreground">Scored by {update.scorerName}</span>
                                                                )}
                                                              </div>
                                                              {update.notes && (
                                                                <div className="bg-background border rounded px-3 py-2">
                                                                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Response / Notes</p>
                                                                  <p className="text-sm text-foreground leading-relaxed">{update.notes}</p>
                                                                </div>
                                                              )}
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Update actions row */}
                                    {okr.quarterlyUpdates.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold text-sm mb-2">Score Submissions ({okr.quarterlyUpdates.length})</h4>
                                        <div className="space-y-1.5">
                                          {okr.quarterlyUpdates.map((update: any) => (
                                            <div
                                              key={update.id}
                                              className={`flex items-center justify-between gap-3 flex-wrap bg-background border rounded-md px-3 py-2 ${update.isCollaborativeScore ? 'border-blue-300 dark:border-blue-700' : ''}`}
                                              data-testid={`card-update-${update.id}`}
                                            >
                                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                                <span className="font-medium">{getQuarterLabel(update.quarter)} {update.year}</span>
                                                <span className="font-bold tabular-nums" data-testid={`text-avg-score-${update.id}`}>{update.averageScore ?? "—"}%</span>
                                                {update.isPrimaryScore === false && (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Secondary</Badge>
                                                )}
                                                {update.isPrimaryScore !== false && update.isCollaborativeScore && (
                                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0">Primary</Badge>
                                                )}
                                                {update.isCollaborativeScore && (
                                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0">Collab</Badge>
                                                )}
                                                {update.scorerName && (
                                                  <span className="text-xs text-muted-foreground">by {update.scorerName}</span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {update.isPrimaryScore === false && (
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      try {
                                                        await apiRequest("PUT", `/api/quarterly-updates/${update.id}/set-primary`);
                                                        queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
                                                        queryClient.invalidateQueries({ queryKey: ["/api/quarterly-updates"] });
                                                        toast({ title: "Primary score updated" });
                                                      } catch (e: any) {
                                                        toast({ title: "Error", description: e.message, variant: "destructive" });
                                                      }
                                                    }}
                                                    data-testid={`button-set-primary-${update.id}`}
                                                  >
                                                    Set as Primary
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => handleEditUpdate(update)}
                                                  data-testid={`button-edit-update-${update.id}`}
                                                >
                                                  <Edit className="h-4 w-4 mr-1" />
                                                  Edit Update
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {okr.quarterlyUpdates.length === 0 && (
                                      <p className="text-sm text-muted-foreground">No score submissions yet.</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          </>}

          {/* Pending Matches Section */}
          {activeDataSection === "pending" && (
            <div className="grid grid-cols-2 gap-6 min-h-[600px]">

              {/* LEFT column — OKRs without scores */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    OKRs Without Scores
                    {okrsWithUpdates && (
                      <Badge variant="secondary" className="text-xs">{unscoredOkrs.length}</Badge>
                    )}
                  </h3>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1 flex-wrap">
                  <div className="relative flex-1 min-w-[120px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-7 h-8 text-xs"
                      placeholder="Search OKRs..."
                      value={unscoredSearch}
                      onChange={e => setUnscoredSearch(e.target.value)}
                      data-testid="input-unscored-search"
                    />
                  </div>
                  <Select value={unscoredFilterSpu} onValueChange={setUnscoredFilterSpu}>
                    <SelectTrigger className="h-8 text-xs w-[110px]" data-testid="select-unscored-spu">
                      <SelectValue placeholder="SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All SPUs</SelectItem>
                      {spus?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={unscoredFilterQuarter} onValueChange={setUnscoredFilterQuarter}>
                    <SelectTrigger className="h-8 text-xs w-32" data-testid="select-unscored-quarter">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ALL_QUARTERS_LABEL}</SelectItem>
                      {QUARTERS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={unscoredFilterYear} onValueChange={setUnscoredFilterYear}>
                    <SelectTrigger className="h-8 text-xs w-[80px]" data-testid="select-unscored-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Yrs</SelectItem>
                      {years?.map(y => <SelectItem key={y.id} value={String(y.year)}>{y.year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(unscoredSearch || unscoredFilterSpu !== "all" || unscoredFilterQuarter !== "all" || unscoredFilterYear !== "all") && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setUnscoredSearch(""); setUnscoredFilterSpu("all"); setUnscoredFilterQuarter("all"); setUnscoredFilterYear("all"); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* OKR list */}
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[560px] pr-1">
                  {isLoading ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Loading OKRs...</div>
                  ) : unscoredOkrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border rounded-md bg-muted/20">
                      <CheckCircle className="h-8 w-8 text-muted-foreground/40" />
                      <p className="font-medium text-muted-foreground text-sm">All OKRs are scored</p>
                      <p className="text-xs text-muted-foreground/70 max-w-xs">No unscored OKRs match the current filters.</p>
                    </div>
                  ) : (
                    unscoredOkrs.map(okr => {
                      const isSelected = selectedUnscoredOkrId === okr.id;
                      return (
                        <Card
                          key={okr.id}
                          data-testid={`card-unscored-okr-${okr.id}`}
                          className={`cursor-pointer hover-elevate ${isSelected ? "border-primary ring-1 ring-primary" : ""}`}
                          onClick={() => setSelectedUnscoredOkrId(prev => prev === okr.id ? null : okr.id)}
                        >
                          <CardContent className="p-3 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] px-1.5 font-mono">{okr.okrNumber}</Badge>
                              <span>{okr.spu?.name || "—"}</span>
                              <span>{okr.quarter} {okr.year}</span>
                            </div>
                            <p className="text-xs font-medium line-clamp-2">{okr.objectiveStatement}</p>
                            {okr.staff?.name && (
                              <p className="text-xs text-muted-foreground">{okr.staff.name}</p>
                            )}
                            {isSelected && (
                              <Badge variant="default" className="text-[10px]">Selected — match a score on the right</Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT column — unmatched/pending scores */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Unmatched Scores
                    {pendingUnmatchedScores && (
                      <Badge variant="secondary" className="text-xs">
                        {pendingUnmatchedScores.filter(s => {
                          if (pendingFilterQuarter !== "all" && s.quarter !== pendingFilterQuarter) return false;
                          if (pendingFilterYear !== "all" && String(s.year) !== pendingFilterYear) return false;
                          if (pendingFilterSpu !== "all" && s.spuName !== pendingFilterSpu) return false;
                          return true;
                        }).length}
                      </Badge>
                    )}
                  </h3>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Select value={pendingFilterQuarter} onValueChange={setPendingFilterQuarter}>
                    <SelectTrigger className="h-8 text-xs w-32" data-testid="select-pending-quarter">
                      <SelectValue placeholder="Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ALL_QUARTERS_LABEL}</SelectItem>
                      {QUARTERS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pendingFilterYear} onValueChange={setPendingFilterYear}>
                    <SelectTrigger className="h-8 text-xs w-[80px]" data-testid="select-pending-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Yrs</SelectItem>
                      {pendingUnmatchedScores && Array.from(new Set(pendingUnmatchedScores.map(s => s.year))).sort().map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pendingFilterSpu} onValueChange={setPendingFilterSpu}>
                    <SelectTrigger className="h-8 text-xs w-[120px]" data-testid="select-pending-spu">
                      <SelectValue placeholder="SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All SPUs</SelectItem>
                      {pendingUnmatchedScores && Array.from(new Set(pendingUnmatchedScores.map(s => s.spuName).filter(Boolean))).sort().map(spu => (
                        <SelectItem key={spu!} value={spu!}>{spu}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(pendingFilterQuarter !== "all" || pendingFilterYear !== "all" || pendingFilterSpu !== "all") && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setPendingFilterQuarter("all"); setPendingFilterYear("all"); setPendingFilterSpu("all"); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Score list */}
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[560px] pr-1">
                  {isPendingLoading ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Loading scores...</div>
                  ) : !pendingUnmatchedScores || pendingUnmatchedScores.filter(s => {
                    if (pendingFilterQuarter !== "all" && s.quarter !== pendingFilterQuarter) return false;
                    if (pendingFilterYear !== "all" && String(s.year) !== pendingFilterYear) return false;
                    if (pendingFilterSpu !== "all" && s.spuName !== pendingFilterSpu) return false;
                    return true;
                  }).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border rounded-md bg-muted/20">
                      <Shuffle className="h-8 w-8 text-muted-foreground/40" />
                      <p className="font-medium text-muted-foreground text-sm">No unmatched scores</p>
                      <p className="text-xs text-muted-foreground/70 max-w-xs">Import a score CSV to populate this list. Rows that couldn't be auto-matched will appear here.</p>
                    </div>
                  ) : (
                    pendingUnmatchedScores
                      .filter(s => {
                        if (pendingFilterQuarter !== "all" && s.quarter !== pendingFilterQuarter) return false;
                        if (pendingFilterYear !== "all" && String(s.year) !== pendingFilterYear) return false;
                        if (pendingFilterSpu !== "all" && s.spuName !== pendingFilterSpu) return false;
                        return true;
                      })
                      .map(score => {
                        let krList: { keyResultNumber: number; score: number }[] = [];
                        if (score.krScores) {
                          if (Array.isArray(score.krScores)) {
                            krList = score.krScores;
                          } else if (typeof score.krScores === 'string') {
                            try { krList = JSON.parse(score.krScores); } catch {}
                          }
                        }
                        return (
                          <Card key={score.id} data-testid={`card-unmatched-score-${score.id}`}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs font-mono">{score.okrNumber || "?"}</Badge>
                                  <span className="text-xs text-muted-foreground">{score.quarter} {score.year}</span>
                                  {score.isCollaborativeScore && <Badge variant="secondary" className="text-[10px] px-1">COLLAB</Badge>}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground shrink-0"
                                  data-testid={`button-dismiss-unmatched-${score.id}`}
                                  onClick={() => handleDismissScore(score.id)}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Dismiss
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                {score.spuName && <span className="font-medium">{score.spuName}</span>}
                                {score.subUnitName && <span className="text-muted-foreground">/ {score.subUnitName}</span>}
                              </div>
                              {score.scorerName && (
                                <p className="text-xs text-muted-foreground">Scorer: {score.scorerName}</p>
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {krList.map(kr => (
                                  <Badge key={kr.keyResultNumber} variant="outline" className="text-[10px] px-1.5 py-0">
                                    KR{kr.keyResultNumber}: {kr.score}
                                  </Badge>
                                ))}
                                {score.averageScore !== null && score.averageScore !== undefined && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Avg: {score.averageScore}
                                  </Badge>
                                )}
                              </div>
                              {score.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-2 italic">{score.notes}</p>
                              )}
                              <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                data-testid={`button-match-score-${score.id}`}
                                disabled={!selectedUnscoredOkrId || matchUnmatchedScoreMutation.isPending}
                                onClick={() => matchUnmatchedScoreMutation.mutate({ id: score.id, okrId: selectedUnscoredOkrId! })}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                {selectedUnscoredOkrId ? "Match to Selected OKR" : "Select an OKR on the left first"}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Backups & Restore Section */}
          {activeDataSection === "backups" && isSuperAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Data Backups</span>
                  <span className="text-xs text-muted-foreground">
                    ({backups?.length ?? 0} backup{backups?.length === 1 ? "" : "s"}, up to 30 retained automatically)
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending}
                  data-testid="button-create-backup"
                >
                  <HardDriveDownload className="h-4 w-4 mr-2" />
                  {createBackupMutation.isPending ? "Creating..." : "Create Backup Now"}
                </Button>
              </div>

              {backupsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading backups...</div>
              ) : !backups || backups.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No backups yet. Create one now or wait for the daily automatic backup.
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-28 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.map((backup) => (
                        <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(backup.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{backup.label}</TableCell>
                          <TableCell>
                            <Badge
                              variant={backup.backupType === "automatic" ? "secondary" : "outline"}
                              data-testid={`badge-backup-type-${backup.id}`}
                            >
                              {backup.backupType === "automatic" ? "Automatic" : "Manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRestoringBackup(backup);
                                setRestoreDialogOpen(true);
                              }}
                              data-testid={`button-restore-${backup.id}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={(open) => { if (!restoreBackupMutation.isPending) { setRestoreDialogOpen(open); if (!open) setRestoringBackup(null); } }}>
        <DialogContent data-testid="dialog-restore-backup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">
                You are about to restore the system to:
              </span>
              <span className="block font-medium text-foreground">
                {restoringBackup?.label}
              </span>
              <span className="block text-destructive font-medium">
                This will overwrite all current data including OKRs, staff, SPUs, objectives, dashboards, and settings. This action cannot be undone.
              </span>
              <span className="block">
                Since all other backups are preserved, you can roll forward at any time by restoring a more recent backup.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRestoreDialogOpen(false); setRestoringBackup(null); }}
              disabled={restoreBackupMutation.isPending}
              data-testid="button-cancel-restore"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restoringBackup && restoreBackupMutation.mutate(restoringBackup.id)}
              disabled={restoreBackupMutation.isPending}
              data-testid="button-confirm-restore"
            >
              {restoreBackupMutation.isPending ? "Restoring..." : "Yes, Restore This Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Audit Log */}
      <Card className="mt-6">
        <CardHeader className="cursor-pointer" onClick={() => setShowEditLogs(!showEditLogs)}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Edit className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Audit Log</CardTitle>
                <CardDescription>
                  Review all edits and deletions of OKRs and quarterly updates ({editLogsData?.length || 0} entries)
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" data-testid="button-toggle-edit-logs">
              {showEditLogs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showEditLogs && (
          <CardContent>
            {!editLogsData || editLogsData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No edit logs found</p>
            ) : (
              <div className="space-y-3">
                {editLogsData.map((log) => {
                  let changedFields: string[] = [];
                  let previousValues: Record<string, any> = {};
                  let newValues: Record<string, any> = {};
                  try { changedFields = JSON.parse(log.changedFields); } catch {}
                  try { previousValues = JSON.parse(log.previousValues); } catch {}
                  try { newValues = JSON.parse(log.newValues); } catch {}

                  const isDelete = log.actionType === "delete";

                  return (
                    <Card key={log.id} className={isDelete ? "bg-destructive/5 border-destructive/20" : "bg-muted/30"} data-testid={`card-edit-log-${log.id}`}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <p className="text-sm font-medium flex items-center gap-2">
                              {isDelete ? (
                                <Badge variant="destructive" className="text-xs">Deleted</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Edited</Badge>
                              )}
                              by: {log.editedByName || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.editedAt).toLocaleString()}
                            </p>
                          </div>
                          {log.okrId && (
                            <Badge variant="outline" className="text-xs">
                              OKR: {log.okrId.slice(0, 8)}...
                            </Badge>
                          )}
                        </div>
                        <div className="bg-background border rounded-md p-3">
                          <p className="text-sm font-medium mb-1">Reason:</p>
                          <p className="text-sm text-muted-foreground">{log.reason}</p>
                        </div>
                        {isDelete ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Deleted Record Details:</p>
                            {changedFields.map((field) => (
                              <div key={field} className="bg-background border rounded-md p-3 text-sm space-y-1">
                                <p className="font-medium text-xs text-muted-foreground uppercase">{field}</p>
                                <p className="text-sm break-all">{typeof previousValues[field] === 'string' ? previousValues[field]?.slice(0, 300) : JSON.stringify(previousValues[field])?.slice(0, 300)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Changes ({changedFields.length} field{changedFields.length !== 1 ? "s" : ""}):</p>
                            {changedFields.map((field) => (
                              <div key={field} className="bg-background border rounded-md p-3 text-sm space-y-1">
                                <p className="font-medium text-xs text-muted-foreground uppercase">{field}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-xs text-muted-foreground">Before:</span>
                                    <p className="text-sm break-all">{typeof previousValues[field] === 'string' ? previousValues[field]?.slice(0, 200) : JSON.stringify(previousValues[field])?.slice(0, 200)}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">After:</span>
                                    <p className="text-sm break-all">{typeof newValues[field] === 'string' ? newValues[field]?.slice(0, 200) : JSON.stringify(newValues[field])?.slice(0, 200)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              {deleteMode === "single" 
                ? "This action cannot be undone. This will permanently delete the OKR and all associated quarterly updates."
                : `This action cannot be undone. This will permanently delete ${selectedOkrIds.size} OKR(s) and all associated quarterly updates.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for deletion <span className="text-destructive">*</span></label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Why are you deleting this record? (recorded in audit log)"
                rows={2}
                data-testid="input-delete-reason"
              />
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
              <p className="text-sm font-medium text-destructive">
                To confirm, type "{deleteMode === "single" ? "DELETE" : `DELETE ${selectedOkrIds.size}`}" below:
              </p>
            </div>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteMode === "single" ? "Type DELETE" : `Type DELETE ${selectedOkrIds.size}`}
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
                setDeleteReason("");
                setSingleDeleteId(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={
                deleteConfirmText !== (deleteMode === "single" ? "DELETE" : `DELETE ${selectedOkrIds.size}`) ||
                !deleteReason.trim() ||
                deleteOkrMutation.isPending
              }
              data-testid="button-confirm-delete"
            >
              {deleteOkrMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cell Detail Dialog */}
      <Dialog open={cellDetailDialog.open} onOpenChange={(open) => !open && setCellDetailDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{cellDetailDialog.label}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm whitespace-pre-wrap break-words">{cellDetailDialog.content}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCellDetailDialog(d => ({ ...d, open: false }))} data-testid="button-close-cell-detail">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Unmatched Score Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={(open) => { if (!open) { setDismissDialogOpen(false); setDismissingScoreId(null); setDismissReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Dismiss Unmatched Score
            </DialogTitle>
            <DialogDescription>
              This score will be dismissed and removed from the pending queue. This action is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for dismissal <span className="text-destructive">*</span></label>
              <Textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this score? (recorded in audit log)"
                rows={3}
                data-testid="input-dismiss-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDismissDialogOpen(false); setDismissingScoreId(null); setDismissReason(""); }}
              data-testid="button-cancel-dismiss"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDismiss}
              disabled={!dismissReason.trim() || dismissUnmatchedScoreMutation.isPending}
              data-testid="button-confirm-dismiss"
            >
              {dismissUnmatchedScoreMutation.isPending ? "Dismissing..." : "Dismiss Score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit OKR Dialog */}
      <Dialog open={!!editingOkr} onOpenChange={(open) => !open && setEditingOkr(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit OKR</DialogTitle>
            <DialogDescription>
              Update all details for {editingOkr?.okrNumber} - {editingOkr?.quarter} {editingOkr?.year}
            </DialogDescription>
          </DialogHeader>
          <Form {...okrForm}>
            <form onSubmit={okrForm.handleSubmit(onSubmitOkr)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={okrForm.control}
                  name="okrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OKR Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-okr-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={okrForm.control}
                  name="quarter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quarter</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-quarter">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {QUARTERS.map((q) => (
                            <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={okrForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-edit-year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={okrForm.control}
                  name="staffId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submitted By</FormLabel>
                      <Select value={field.value || ""} onValueChange={(val) => field.onChange(val || null)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-staff">
                            <SelectValue placeholder="Select staff" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allStaff?.slice().sort((a, b) => compareNames(a.name, b.name)).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={okrForm.control}
                  name="spuId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SPU</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          const currentSubUnitId = okrForm.getValues("subUnitId");
                          const stillValid = (subUnits || []).some(
                            (su) => su.id === currentSubUnitId && su.spuId === val
                          );
                          if (!stillValid) {
                            okrForm.setValue("subUnitId", null);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-spu">
                            <SelectValue placeholder="Select SPU" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {spus?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={okrForm.control}
                  name="subUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-Unit (Optional)</FormLabel>
                      <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? null : val)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-subunit">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {subUnits?.filter((su) => su.spuId === okrForm.watch("spuId")).map((su) => (
                            <SelectItem key={su.id} value={su.id}>{su.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={okrForm.control}
                  name="collaborationSpuIds"
                  render={({ field }) => {
                    const primarySpuId = okrForm.watch("spuId");
                    const primarySubUnitId = okrForm.watch("subUnitId");
                    const allSpus = spus || [];
                    const allSubUnits = subUnits || [];
                    const spuNameById = new Map(allSpus.map((s) => [s.id, s.name]));
                    // Encode option ids as "spu:UUID" / "sub:UUID" so the submit
                    // handler can split them into the right server arrays.
                    const spuOptions = allSpus
                      .filter((s) => s.id !== primarySpuId)
                      .map((s) => ({ id: `spu:${s.id}`, name: s.name }));
                    const subUnitOptions = allSubUnits
                      .filter((su) => su.id !== primarySubUnitId)
                      .map((su) => ({
                        id: `sub:${su.id}`,
                        name: `${spuNameById.get(su.spuId) ?? "SPU"} — ${su.name}`,
                      }));
                    const collaborationOptions = [...spuOptions, ...subUnitOptions].sort((a, b) =>
                      a.name.localeCompare(b.name)
                    );
                    return (
                      <FormItem>
                        <FormLabel>Collaboration SPU(s) or Sub-Unit(s) (Optional)</FormLabel>
                        <FormControl>
                          <MultiSelectSpus
                            options={collaborationOptions}
                            selectedIds={field.value || []}
                            onChange={field.onChange}
                            placeholder="None"
                            testIdPrefix="select-edit-collab-spu"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={okrForm.control}
                name="objectiveStatement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objective Statement</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="input-objective-statement" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={okrForm.control}
                name="universityObjective"
                render={({ field }) => {
                  const selectedObjectives = parseMultiSelectField(field.value);
                  const allObjectiveLabels = universityObjectives?.flatMap(obj => [`${obj.label}: ${obj.description}`]) || [];
                  return (
                    <FormItem>
                      <FormLabel>University Strategic Objective(s)</FormLabel>
                      <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                        {allObjectiveLabels.map((label) => (
                          <div key={label} className="flex items-start gap-2">
                            <Checkbox
                              checked={selectedObjectives.includes(label)}
                              onCheckedChange={(checked) => {
                                const updated = checked
                                  ? [...selectedObjectives, label]
                                  : selectedObjectives.filter((o) => o !== label);
                                field.onChange(JSON.stringify(updated));
                              }}
                              data-testid={`checkbox-obj-${label.slice(0, 20)}`}
                            />
                            <span className="text-sm">{label}</span>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={okrForm.control}
                name="universityKeyResult"
                render={({ field }) => {
                  const selectedKRs = parseMultiSelectField(field.value);
                  const allKRLabels = universityObjectives?.flatMap(obj =>
                    obj.keyResults.map(kr => `${kr.label}: ${kr.description}`)
                  ) || [];
                  return (
                    <FormItem>
                      <FormLabel>University Key Result(s)</FormLabel>
                      <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                        {allKRLabels.map((label) => (
                          <div key={label} className="flex items-start gap-2">
                            <Checkbox
                              checked={selectedKRs.includes(label)}
                              onCheckedChange={(checked) => {
                                const updated = checked
                                  ? [...selectedKRs, label]
                                  : selectedKRs.filter((k) => k !== label);
                                field.onChange(JSON.stringify(updated));
                              }}
                              data-testid={`checkbox-kr-${label.slice(0, 20)}`}
                            />
                            <span className="text-sm">{label}</span>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Key Results</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addKeyResult} data-testid="button-add-kr">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {editKeyResults.map((kr, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 border rounded-md">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">KR {index + 1}</Badge>
                        <Input
                          type="number"
                          placeholder="Weight %"
                          value={kr.percentage ?? ""}
                          onChange={(e) => updateKeyResult(index, "percentage", e.target.value ? parseInt(e.target.value) : undefined as any)}
                          className="w-24"
                          data-testid={`input-edit-kr-weight-${index}`}
                        />
                      </div>
                      <Textarea
                        value={kr.description}
                        onChange={(e) => updateKeyResult(index, "description", e.target.value)}
                        rows={2}
                        placeholder="Key result description..."
                        data-testid={`input-edit-kr-desc-${index}`}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyResult(index)} data-testid={`button-remove-kr-${index}`}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingOkr(null)} data-testid="button-cancel-okr">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateOkrMutation.isPending} data-testid="button-save-okr">
                  {updateOkrMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Quarterly Update Dialog */}
      <Dialog open={!!editingUpdate} onOpenChange={(open) => !open && setEditingUpdate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Quarterly Update</DialogTitle>
            <DialogDescription>
              Update the quarterly update for {editingUpdate?.quarter} {editingUpdate?.year}
            </DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(onSubmitUpdate)} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Key Result Scores (0-100)</FormLabel>
                  <div className="text-sm font-medium text-muted-foreground">
                    Average:{" "}
                    {updateForm.watch("keyResultScores")?.length > 0
                      ? Math.round(
                          updateForm.watch("keyResultScores").reduce((sum, kr) => sum + kr.score, 0) /
                            updateForm.watch("keyResultScores").length
                        )
                      : 0}
                    %
                  </div>
                </div>
                {updateForm.watch("keyResultScores")?.map((kr, index) => (
                  <FormField
                    key={`kr-${kr.keyResultNumber}-${index}`}
                    control={updateForm.control}
                    name={`keyResultScores.${index}.score`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          KR{updateForm.watch(`keyResultScores.${index}.keyResultNumber`)}: {updateForm.watch(`keyResultScores.${index}.description`)}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid={`input-kr-score-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              
              <FormField
                control={updateForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="additionalKeyResults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Key Results (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} data-testid="input-additional-kr" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUpdate(null)} data-testid="button-cancel-update">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateQuarterlyUpdateMutation.isPending} data-testid="button-save-update">
                  {updateQuarterlyUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Edit</DialogTitle>
            <DialogDescription>
              Please explain why this data is being edited. This will be logged for admin review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Enter the reason for this edit..."
              rows={3}
              data-testid="input-edit-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReasonDialogOpen(false);
                setPendingOkrEdit(null);
                setPendingUpdateEdit(null);
              }}
              data-testid="button-cancel-reason"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReasonAndSave}
              disabled={!editReason.trim() || updateOkrMutation.isPending || updateQuarterlyUpdateMutation.isPending}
              data-testid="button-confirm-reason"
            >
              {updateOkrMutation.isPending || updateQuarterlyUpdateMutation.isPending ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); resetImportState(); } }}>
        <DialogContent className={importStep === "preview" ? "max-w-[95vw] max-h-[90vh] overflow-y-auto" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              {importStep === "upload" && "Import OKR Data from TSV"}
              {importStep === "preview" && "Review Import Data"}
              {importStep === "importing" && "Importing..."}
            </DialogTitle>
            <DialogDescription>
              {importStep === "upload" && "Upload a TSV file exported from the OKR submission Google Form. Scores and comments in the file will be imported as quarterly updates automatically."}
              {importStep === "preview" && `${importPreviewData.filter(r => r.include).length} of ${importPreviewData.length} rows selected for import. Click a row to edit, or uncheck to exclude.`}
              {importStep === "importing" && "Please wait while the data is being imported..."}
            </DialogDescription>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file-input"
                  data-testid="input-csv-file"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {importFile ? (
                      <span className="text-foreground font-medium">{importFile.name}</span>
                    ) : (
                      <>Click to select a TSV file</>
                    )}
                  </p>
                </label>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-800 dark:text-amber-300 text-xs">Future imports must use <strong>TSV (tab-separated values)</strong> format, not CSV. Export directly from the OKR submission Google Form.</p>
              </div>
              <div className="bg-muted/50 rounded-md p-4 text-sm">
                <p className="font-medium mb-2">Expected TSV columns (24 columns):</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Timestamp, Email Address, Your Name</li>
                  <li>Year and Quarter, Numbered OKR</li>
                  <li>Parent SPU, Sub-unit, Collaboration SPU</li>
                  <li>University Strategic Objective, University Key Result</li>
                  <li>Objective Statement, Key Result Statements (1–6)</li>
                  <li>Scores: KR1–KR6 (0–100 % progress per key result)</li>
                  <li>Comments (imported as quarterly update notes)</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); resetImportState(); }} data-testid="button-cancel-import">
                  Cancel
                </Button>
                <Button onClick={handlePreviewCsv} disabled={!importFile || previewCsvMutation.isPending} data-testid="button-preview-csv">
                  {previewCsvMutation.isPending ? "Parsing..." : "Preview TSV Data"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === "preview" && (
            <div className="space-y-4">
              {importSummary && (
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <Badge variant="outline">{importSummary.totalRows} total rows</Badge>
                  <Badge variant="outline">{importPreviewData.length} parsed</Badge>
                  {importSummary.skippedEmpty > 0 && (
                    <Badge variant="secondary">{importSummary.skippedEmpty} empty rows skipped</Badge>
                  )}
                  <Badge className="bg-primary text-primary-foreground">{importPreviewData.filter(r => r.include).length} selected for import</Badge>
                  {importPreviewData.some(r => r.isDuplicate) && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 cursor-pointer"
                      onClick={() => cycleToRow(importPreviewData, r => r.isDuplicate, "duplicates", importCycleIndex, setImportCycleIndex, "row-import")}
                      data-testid="badge-cycle-import-duplicates"
                    >{importPreviewData.filter(r => r.isDuplicate).length} duplicate(s)</Badge>
                  )}
                  {importPreviewData.some(r => r.errors.length > 0 && !r.isDuplicate) && (
                    <Badge
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => cycleToRow(importPreviewData, r => r.errors.length > 0 && !r.isDuplicate, "warnings", importCycleIndex, setImportCycleIndex, "row-import")}
                      data-testid="badge-cycle-import-warnings"
                    >{importPreviewData.filter(r => r.errors.length > 0 && !r.isDuplicate).length} with warnings</Badge>
                  )}
                </div>
              )}

              <div className="border rounded-md overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-50">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={importPreviewData.every(r => r.include)}
                          onChange={(e) => {
                            setImportPreviewData(prev => prev.map(r => ({ ...r, include: e.target.checked })));
                          }}
                          data-testid="checkbox-select-all-import"
                        />
                      </TableHead>
                      <TableHead className="w-10">Row</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>OKR #</TableHead>
                      <TableHead>SPU</TableHead>
                      <TableHead>Sub-unit</TableHead>
                      <TableHead>Objective Statement</TableHead>
                      <TableHead>KRs</TableHead>
                      <TableHead>Scores</TableHead>
                      <TableHead className="w-10">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreviewData.map((row, idx) => (
                      <>
                        <TableRow
                          key={`row-${idx}`}
                          className={`${!row.include ? "opacity-40" : ""} ${row.isDuplicate ? "bg-amber-500/10" : row.errors.length > 0 ? "bg-destructive/5" : ""}`}
                          data-testid={`row-import-${idx}`}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={() => toggleImportRow(idx)}
                              data-testid={`checkbox-import-row-${idx}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {row.rowIndex}
                              {row.isDuplicate && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1 py-0">DUP</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={row.timestamp || "-"}>{row.timestamp ? new Date(row.timestamp).toLocaleDateString() : "-"}</TableCell>
                          <TableCell
                            className="text-sm font-medium max-w-[120px] truncate cursor-pointer hover:text-primary"
                            title="Click to see full name"
                            onClick={() => showCellDetail("Staff Name", row.staffName)}
                          >{row.staffName}</TableCell>
                          <TableCell className="text-sm">{row.quarter}</TableCell>
                          <TableCell className="text-sm">{row.year}</TableCell>
                          <TableCell className="text-sm">{row.okrNumber}</TableCell>
                          <TableCell
                            className="text-sm max-w-[150px] truncate cursor-pointer hover:text-primary"
                            title="Click to see full SPU name"
                            onClick={() => showCellDetail("SPU", row.spuName)}
                          >{row.spuName}</TableCell>
                          <TableCell
                            className="text-sm max-w-[100px] truncate cursor-pointer hover:text-primary"
                            title="Click to see full sub-unit name"
                            onClick={() => showCellDetail("Sub-unit", row.subUnitName || "-")}
                          >{row.subUnitName || "-"}</TableCell>
                          <TableCell
                            className="text-sm max-w-[200px] truncate cursor-pointer hover:text-primary"
                            title="Click to see full objective statement"
                            onClick={() => showCellDetail("Objective Statement", row.objectiveStatement || "-")}
                          >{row.objectiveStatement || "-"}</TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer hover:text-primary"
                            title="Click to see all key results"
                            onClick={() => {
                              const krs = [row.keyResult1, row.keyResult2, row.keyResult3, row.keyResult4, row.keyResult5, row.keyResult6].filter(Boolean);
                              showCellDetail("Key Results", krs.map((kr, i) => `KR${i + 1}: ${kr}`).join("\n\n"));
                            }}
                          >
                            {[row.keyResult1, row.keyResult2, row.keyResult3, row.keyResult4, row.keyResult5, row.keyResult6].filter(Boolean).length} KR(s)
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {row.hasScores ? (
                              <span className="text-green-700 dark:text-green-400 font-medium">
                                avg {row.averageScore}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingImportRow(editingImportRow === idx ? null : idx)}
                              data-testid={`button-edit-import-row-${idx}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {editingImportRow === idx && (
                          <TableRow key={`edit-${idx}`}>
                            <TableCell colSpan={13} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Submitted</label>
                                  <p className="text-sm py-2 px-3 border rounded-md bg-muted/50 text-muted-foreground">
                                    {row.timestamp ? new Date(row.timestamp).toLocaleString() : "No date"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Staff Name</label>
                                  <Input
                                    value={row.staffName}
                                    onChange={(e) => updateImportRow(idx, "staffName", e.target.value)}
                                    data-testid={`input-import-name-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Quarter</label>
                                  <Select value={row.quarter} onValueChange={(v) => updateImportRow(idx, "quarter", v)}>
                                    <SelectTrigger data-testid={`select-import-quarter-${idx}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Q1">Q1</SelectItem>
                                      <SelectItem value="Q2">Q2</SelectItem>
                                      <SelectItem value="Q3">Q3</SelectItem>
                                      <SelectItem value="Q4">Q4</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                                  <Input
                                    type="number"
                                    value={row.year}
                                    onChange={(e) => updateImportRow(idx, "year", parseInt(e.target.value) || 2024)}
                                    data-testid={`input-import-year-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">OKR Number</label>
                                  <Select value={row.okrNumber} onValueChange={(v) => updateImportRow(idx, "okrNumber", v)}>
                                    <SelectTrigger data-testid={`select-import-okr-${idx}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {okrNumbers.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Parent SPU</label>
                                  <Input
                                    value={row.spuName}
                                    onChange={(e) => updateImportRow(idx, "spuName", e.target.value)}
                                    data-testid={`input-import-spu-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Sub-unit</label>
                                  <Input
                                    value={row.subUnitName}
                                    onChange={(e) => updateImportRow(idx, "subUnitName", e.target.value)}
                                    data-testid={`input-import-subunit-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2 lg:col-span-2">
                                  <label className="text-xs font-medium text-muted-foreground">Collaboration SPU</label>
                                  <Input
                                    value={row.collaborationSpu}
                                    onChange={(e) => updateImportRow(idx, "collaborationSpu", e.target.value)}
                                    data-testid={`input-import-collab-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                  <label className="text-xs font-medium text-muted-foreground">University Objective</label>
                                  <Textarea
                                    value={row.universityObjective}
                                    onChange={(e) => updateImportRow(idx, "universityObjective", e.target.value)}
                                    rows={2}
                                    data-testid={`input-import-uni-obj-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                  <label className="text-xs font-medium text-muted-foreground">University Key Result</label>
                                  <Textarea
                                    value={row.universityKeyResult}
                                    onChange={(e) => updateImportRow(idx, "universityKeyResult", e.target.value)}
                                    rows={2}
                                    data-testid={`input-import-uni-kr-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                  <label className="text-xs font-medium text-muted-foreground">Objective Statement</label>
                                  <Textarea
                                    value={row.objectiveStatement}
                                    onChange={(e) => updateImportRow(idx, "objectiveStatement", e.target.value)}
                                    rows={3}
                                    data-testid={`input-import-obj-stmt-${idx}`}
                                  />
                                </div>
                                {[
                                  { field: "keyResult1", label: "Key Result 1" },
                                  { field: "keyResult2", label: "Key Result 2" },
                                  { field: "keyResult3", label: "Key Result 3" },
                                  { field: "keyResult4", label: "Key Result 4" },
                                  { field: "keyResult5", label: "Key Result 5" },
                                  { field: "keyResult6", label: "Key Result 6" },
                                ].map(({ field, label }, krIdx) => (row[field] || krIdx === 0) ? (
                                  <div key={field} className="space-y-1 md:col-span-2 lg:col-span-3">
                                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                                    <Textarea
                                      value={row[field] || ""}
                                      onChange={(e) => updateImportRow(idx, field, e.target.value)}
                                      rows={2}
                                      data-testid={`input-import-${field}-${idx}`}
                                    />
                                  </div>
                                ) : null)}
                                {row.hasScores && (
                                  <div className="md:col-span-2 lg:col-span-3 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Scores from TSV (read-only, will create a quarterly update)</label>
                                    <div className="flex flex-wrap gap-2 py-2">
                                      {[
                                        { label: "KR1", val: row.scoreKr1 },
                                        { label: "KR2", val: row.scoreKr2 },
                                        { label: "KR3", val: row.scoreKr3 },
                                        { label: "KR4", val: row.scoreKr4 },
                                        { label: "KR5", val: row.scoreKr5 },
                                        { label: "KR6", val: row.scoreKr6 },
                                      ].filter(s => s.val !== null && s.val !== undefined).map(s => (
                                        <Badge key={s.label} variant="secondary" className="text-xs">{s.label}: {s.val}%</Badge>
                                      ))}
                                      <Badge variant="outline" className="text-xs font-semibold">Avg: {row.averageScore}%</Badge>
                                    </div>
                                  </div>
                                )}
                                {row.comments && (
                                  <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                    <label className="text-xs font-medium text-muted-foreground">Comments (will be imported as quarterly update notes)</label>
                                    <Textarea
                                      value={row.comments}
                                      onChange={(e) => updateImportRow(idx, "comments", e.target.value)}
                                      rows={2}
                                      data-testid={`input-import-comments-${idx}`}
                                    />
                                  </div>
                                )}
                                {row.errors.length > 0 && (
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-destructive text-xs">
                                      <AlertTriangle className="h-3 w-3" />
                                      {row.errors.join(", ")}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end mt-3">
                                <Button variant="outline" size="sm" onClick={() => setEditingImportRow(null)} data-testid={`button-close-edit-import-${idx}`}>
                                  Done Editing
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => { setImportStep("upload"); setImportPreviewData([]); setImportSummary(null); }} data-testid="button-back-to-upload">
                  Back
                </Button>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); resetImportState(); }} data-testid="button-cancel-import">
                  Cancel
                </Button>
                <Button onClick={handleConfirmImport} disabled={confirmImportMutation.isPending || importPreviewData.filter(r => r.include).length === 0} data-testid="button-confirm-import">
                  Import {importPreviewData.filter(r => r.include).length} Row{importPreviewData.filter(r => r.include).length !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === "importing" && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Processing {importPreviewData.filter(r => r.include).length} rows...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Score Import Dialog */}
      <Dialog open={scoreImportDialogOpen} onOpenChange={(open) => { if (!open) { setScoreImportDialogOpen(false); resetScoreImportState(); } }}>
        <DialogContent className={scoreImportStep === "preview" ? "max-w-[95vw] max-h-[90vh] overflow-y-auto" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              {scoreImportStep === "upload" && "Import OKR Scores from CSV"}
              {scoreImportStep === "preview" && "Review Score Import Data"}
              {scoreImportStep === "importing" && "Importing Scores..."}
            </DialogTitle>
            <DialogDescription>
              {scoreImportStep === "upload" && "Upload a CSV file from the OKR scoring form responses. Scores will be matched to existing OKRs by SPU, quarter, year, and OKR number."}
              {scoreImportStep === "preview" && `${scoreImportPreviewData.filter(r => r.include).length} of ${scoreImportPreviewData.length} rows selected for import. Click a row to edit scores, or uncheck to exclude.`}
              {scoreImportStep === "importing" && "Please wait while the scores are being imported..."}
            </DialogDescription>
          </DialogHeader>

          {scoreImportStep === "upload" && (
            <div className="space-y-4 py-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={handleScoreFileSelect}
                  className="hidden"
                  id="score-csv-file-input"
                  data-testid="input-score-csv-file"
                />
                <label htmlFor="score-csv-file-input" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {scoreImportFile ? (
                      <span className="text-foreground font-medium">{scoreImportFile.name}</span>
                    ) : (
                      <>Click to select a score CSV file</>
                    )}
                  </p>
                </label>
              </div>
              <div className="bg-muted/50 rounded-md p-4 text-sm">
                <p className="font-medium mb-2">Expected CSV columns:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Timestamp, Your Name</li>
                  <li>Year and Quarter, Which numbered OKR</li>
                  <li>Parent SPU, Sub-unit</li>
                  <li>Key Result Scores (1-4)</li>
                  <li>Overflow Key Results (KR5+)</li>
                  <li>Average Score, Qualitative Notes</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setScoreImportDialogOpen(false); resetScoreImportState(); }} data-testid="button-cancel-score-import">
                  Cancel
                </Button>
                <Button onClick={handlePreviewScores} disabled={!scoreImportFile || previewScoreMutation.isPending} data-testid="button-preview-scores">
                  {previewScoreMutation.isPending ? "Parsing..." : "Preview Scores"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {scoreImportStep === "preview" && (
            <div className="space-y-4">
              {scoreImportSummary && (
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <Badge variant="outline">{scoreImportSummary.totalRows} total rows</Badge>
                  <Badge variant="outline">{scoreImportPreviewData.length} parsed</Badge>
                  {scoreImportSummary.skippedEmpty > 0 && (
                    <Badge variant="secondary">{scoreImportSummary.skippedEmpty} empty rows skipped</Badge>
                  )}
                  <Badge className="bg-green-600 text-white">{scoreImportSummary.matchedRows} matched to OKRs</Badge>
                  {scoreImportSummary.unmatchedRows > 0 && (
                    <Badge
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => cycleToRow(scoreImportPreviewData, r => !r.matchedOkrId && !r.isDuplicate, "unmatched", scoreCycleIndex, setScoreCycleIndex, "row-score-import")}
                      data-testid="badge-cycle-score-unmatched"
                    >{scoreImportSummary.unmatchedRows} unmatched</Badge>
                  )}
                  <Badge className="bg-primary text-primary-foreground">{scoreImportPreviewData.filter(r => r.include).length} selected for import</Badge>
                  {scoreImportPreviewData.some(r => r.isDuplicate) && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 cursor-pointer"
                      onClick={() => cycleToRow(scoreImportPreviewData, r => r.isDuplicate, "duplicates", scoreCycleIndex, setScoreCycleIndex, "row-score-import")}
                      data-testid="badge-cycle-score-duplicates"
                    >{scoreImportPreviewData.filter(r => r.isDuplicate).length} duplicate(s)</Badge>
                  )}
                  {scoreImportPreviewData.some(r => r.isCollaborativeScore && !r.isDuplicate) && (
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer"
                      onClick={() => cycleToRow(scoreImportPreviewData, r => r.isCollaborativeScore && !r.isDuplicate, "collaborative", scoreCycleIndex, setScoreCycleIndex, "row-score-import")}
                      data-testid="badge-cycle-score-collaborative"
                    >{scoreImportPreviewData.filter(r => r.isCollaborativeScore && !r.isDuplicate).length} collaborative</Badge>
                  )}
                </div>
              )}

              <div className="border rounded-md overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-50">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={scoreImportPreviewData.every(r => r.include)}
                          onChange={(e) => {
                            setScoreImportPreviewData(prev => prev.map(r => ({ ...r, include: e.target.checked })));
                          }}
                          data-testid="checkbox-select-all-scores"
                        />
                      </TableHead>
                      <TableHead className="w-10">Row</TableHead>
                      <TableHead>Scorer</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>OKR #</TableHead>
                      <TableHead>SPU</TableHead>
                      <TableHead>Sub-unit</TableHead>
                      <TableHead>KR Scores</TableHead>
                      <TableHead>Avg</TableHead>
                      <TableHead>Objective</TableHead>
                      <TableHead>Match Status</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoreImportPreviewData.map((row, idx) => (
                      <Fragment key={`score-row-${idx}`}>
                        <TableRow
                          className={`${!row.include ? "opacity-40" : ""} ${row.isDuplicate ? "bg-amber-500/10" : row.isCollaborativeScore ? "bg-blue-500/10" : row.errors.length > 0 ? "bg-destructive/5" : ""} ${!row.isDuplicate && !row.isCollaborativeScore && row.matchedOkrId ? "" : !row.isDuplicate && !row.isCollaborativeScore ? "bg-amber-500/5" : ""}`}
                          data-testid={`row-score-import-${idx}`}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={() => toggleScoreRow(idx)}
                              data-testid={`checkbox-score-row-${idx}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {row.rowIndex}
                              {row.isDuplicate && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1 py-0">DUP</Badge>
                              )}
                              {row.isCollaborativeScore && !row.isDuplicate && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1 py-0">COLLAB</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[120px] truncate" title={row.scorerName}>{row.scorerName}</TableCell>
                          <TableCell className="text-sm">{row.quarter}</TableCell>
                          <TableCell className="text-sm">{row.year}</TableCell>
                          <TableCell className="text-sm">{row.okrNumber}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate" title={row.spuName}>{row.spuName}</TableCell>
                          <TableCell className="text-sm max-w-[100px] truncate" title={row.subUnitName || "-"}>{row.subUnitName || "-"}</TableCell>
                          <TableCell className="text-sm">
                            {row.krScores && row.krScores.length > 0
                              ? row.krScores.map((kr: any) => `KR${kr.krNumber}: ${kr.score}`).join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{row.averageScore != null ? `${row.averageScore}%` : "-"}</TableCell>
                          <TableCell className="text-sm max-w-[200px]">
                            {row.matchedOkrDetails ? (
                              <span className="text-xs text-muted-foreground line-clamp-2" title={row.matchedOkrDetails.objectiveStatement}>
                                {row.matchedOkrDetails.objectiveStatement}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.matchedOkrId ? (
                              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">Matched</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">No Match</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingScoreRow(editingScoreRow === idx ? null : idx)}
                                title="View/Edit details"
                                data-testid={`button-edit-score-row-${idx}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!row.matchedOkrId ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setLinkingScoreRow(idx);
                                    const matchedSpu = spus?.find(s => s.name.toLowerCase() === row.spuName?.toLowerCase());
                                    setOkrSearchSpu(matchedSpu?.id || "all");
                                    setOkrSearchQuarter(row.quarter || "all");
                                    setOkrSearchYear(row.year ? String(row.year) : "all");
                                    setOkrSearchQuery("");
                                  }}
                                  title="Link to OKR"
                                  data-testid={`button-link-score-row-${idx}`}
                                >
                                  <Link className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => unlinkOkrFromScoreRow(idx)}
                                  title="Unlink OKR"
                                  data-testid={`button-unlink-score-row-${idx}`}
                                >
                                  <Unlink className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {editingScoreRow === idx && (
                          <TableRow key={`score-edit-${idx}`}>
                            <TableCell colSpan={13} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Scorer Name</label>
                                  <Input
                                    value={row.scorerName}
                                    onChange={(e) => updateScoreRow(idx, "scorerName", e.target.value)}
                                    data-testid={`input-score-name-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Quarter</label>
                                  <Select value={row.quarter} onValueChange={(v) => updateScoreRow(idx, "quarter", v)}>
                                    <SelectTrigger data-testid={`select-score-quarter-${idx}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Q1">Q1</SelectItem>
                                      <SelectItem value="Q2">Q2</SelectItem>
                                      <SelectItem value="Q3">Q3</SelectItem>
                                      <SelectItem value="Q4">Q4</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                                  <Input
                                    type="number"
                                    value={row.year}
                                    onChange={(e) => updateScoreRow(idx, "year", parseInt(e.target.value) || 2024)}
                                    data-testid={`input-score-year-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">OKR Number</label>
                                  <Select value={row.okrNumber} onValueChange={(v) => updateScoreRow(idx, "okrNumber", v)}>
                                    <SelectTrigger data-testid={`select-score-okr-${idx}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {okrNumbers.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">SPU</label>
                                  <Input
                                    value={row.spuName}
                                    onChange={(e) => updateScoreRow(idx, "spuName", e.target.value)}
                                    data-testid={`input-score-spu-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Sub-unit</label>
                                  <Input
                                    value={row.subUnitName}
                                    onChange={(e) => updateScoreRow(idx, "subUnitName", e.target.value)}
                                    data-testid={`input-score-subunit-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                  <label className="text-xs font-medium text-muted-foreground">Key Result Scores</label>
                                  <div className="flex flex-wrap gap-3">
                                    {row.krScores && row.krScores.map((kr: any, krIdx: number) => (
                                      <div key={krIdx} className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">KR{kr.krNumber}:</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={kr.score}
                                          onChange={(e) => updateScoreKrScore(idx, krIdx, parseInt(e.target.value) || 0)}
                                          className="w-20"
                                          data-testid={`input-score-kr-${idx}-${krIdx}`}
                                        />
                                      </div>
                                    ))}
                                    {(!row.krScores || row.krScores.length === 0) && (
                                      <span className="text-xs text-muted-foreground">No key result scores found</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-muted-foreground">Average Score (%)</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={row.averageScore ?? ""}
                                    onChange={(e) => updateScoreRow(idx, "averageScore", parseInt(e.target.value) || 0)}
                                    data-testid={`input-score-avg-${idx}`}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-medium text-muted-foreground">Match Info</label>
                                  <p className="text-xs text-muted-foreground">{row.matchedOkrInfo || "No match found"}</p>
                                </div>
                                {row.matchedOkrDetails && (
                                  <div className="space-y-2 md:col-span-2 lg:col-span-3 border rounded-md p-3 bg-green-50/50 dark:bg-green-950/20">
                                    <label className="text-xs font-medium text-green-700 dark:text-green-300">Matched OKR Details</label>
                                    <div className="text-xs space-y-1">
                                      <p><span className="font-medium">OKR:</span> {row.matchedOkrDetails.okrNumber} ({row.matchedOkrDetails.quarter} {row.matchedOkrDetails.year})</p>
                                      <p><span className="font-medium">SPU:</span> {row.matchedOkrDetails.spuName}{row.matchedOkrDetails.subUnitName ? ` / ${row.matchedOkrDetails.subUnitName}` : ''}</p>
                                      <p><span className="font-medium">Staff:</span> {row.matchedOkrDetails.staffName || 'N/A'}</p>
                                      <p><span className="font-medium">Objective:</span> {row.matchedOkrDetails.objectiveStatement}</p>
                                      {row.matchedOkrDetails.keyResults && (
                                        <div>
                                          <span className="font-medium">Key Results:</span>
                                          <ul className="list-disc list-inside ml-2 mt-1">
                                            {parseKeyResultsForDisplay(row.matchedOkrDetails.keyResults).map((kr: string, kri: number) => (
                                              <li key={kri}>{kr}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {row.isDuplicate && row.duplicateType === 'csv' && row.duplicateOfRow && (
                                  (() => {
                                    const origRow = scoreImportPreviewData.find((r: any) => r.rowIndex === row.duplicateOfRow);
                                    return (
                                      <div className="space-y-2 md:col-span-2 lg:col-span-3 border rounded-md p-3 bg-amber-50/50 dark:bg-amber-950/20">
                                        <label className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                          Duplicate Comparison - This row and Row {row.duplicateOfRow} both matched the same database OKR
                                        </label>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                          <div className="space-y-1 border rounded p-2 bg-background">
                                            <p className="font-medium text-amber-700 dark:text-amber-300">This Row ({row.rowIndex})</p>
                                            <p><span className="font-medium">Scorer:</span> {row.scorerName}</p>
                                            <p><span className="font-medium">SPU:</span> {row.spuName}</p>
                                            <p><span className="font-medium">OKR#:</span> {row.okrNumber} | {row.quarter} {row.year}</p>
                                            <p><span className="font-medium">Scores:</span> {row.krScores?.map((kr: any) => `KR${kr.krNumber}: ${kr.score}`).join(', ') || '-'}</p>
                                            <p><span className="font-medium">Avg:</span> {row.averageScore != null ? `${row.averageScore}%` : '-'}</p>
                                            <p><span className="font-medium">Match:</span> {row.matchedOkrInfo}</p>
                                          </div>
                                          <div className="space-y-1 border rounded p-2 bg-background">
                                            <p className="font-medium text-green-700 dark:text-green-300">Row {row.duplicateOfRow} (original)</p>
                                            {origRow ? (
                                              <>
                                                <p><span className="font-medium">Scorer:</span> {origRow.scorerName}</p>
                                                <p><span className="font-medium">SPU:</span> {origRow.spuName}</p>
                                                <p><span className="font-medium">OKR#:</span> {origRow.okrNumber} | {origRow.quarter} {origRow.year}</p>
                                                <p><span className="font-medium">Scores:</span> {origRow.krScores?.map((kr: any) => `KR${kr.krNumber}: ${kr.score}`).join(', ') || '-'}</p>
                                                <p><span className="font-medium">Avg:</span> {origRow.averageScore != null ? `${origRow.averageScore}%` : '-'}</p>
                                                <p><span className="font-medium">Match:</span> {origRow.matchedOkrInfo}</p>
                                              </>
                                            ) : (
                                              <p className="text-muted-foreground">Could not find original row</p>
                                            )}
                                          </div>
                                        </div>
                                        {origRow && row.matchedOkrDetails && (
                                          <div className="border rounded p-2 bg-background mt-2">
                                            <p className="font-medium text-xs mb-1">Shared Matched OKR:</p>
                                            <p className="text-xs"><span className="font-medium">Staff:</span> {row.matchedOkrDetails.staffName}</p>
                                            <p className="text-xs"><span className="font-medium">Objective:</span> {row.matchedOkrDetails.objectiveStatement}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                                {!row.matchedOkrId && row.candidateOkrs && row.candidateOkrs.length > 0 && (
                                  <div className="space-y-2 md:col-span-2 lg:col-span-3 border rounded-md p-3 bg-amber-50/50 dark:bg-amber-950/20">
                                    <label className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                      Nearby OKRs in same SPU ({row.candidateOkrs.length} found for {row.quarter} {row.year})
                                    </label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                      {row.candidateOkrs.map((candidate: any, ci: number) => (
                                        <div key={ci} className="flex items-start gap-2 text-xs border-b pb-2 last:border-0">
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium">{candidate.okrNumber}{candidate.subUnitName ? ` (${candidate.subUnitName})` : ''} - {candidate.staffName}</p>
                                            <p className="text-muted-foreground truncate" title={candidate.objectiveStatement}>{candidate.objectiveStatement}</p>
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => linkOkrToScoreRow(idx, candidate)}
                                            data-testid={`button-link-candidate-${idx}-${ci}`}
                                          >
                                            <Link className="h-3 w-3 mr-1" />
                                            Link
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {!row.matchedOkrId && (
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setLinkingScoreRow(idx);
                                        const matchedSpu = spus?.find(s => s.name.toLowerCase() === row.spuName?.toLowerCase());
                                        setOkrSearchSpu(matchedSpu?.id || "all");
                                        setOkrSearchQuarter(row.quarter || "all");
                                        setOkrSearchYear(row.year ? String(row.year) : "all");
                                        setOkrSearchQuery("");
                                      }}
                                      data-testid={`button-search-link-${idx}`}
                                    >
                                      <Search className="h-3 w-3 mr-1" />
                                      Search all OKRs to link
                                    </Button>
                                  </div>
                                )}
                                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                                  <label className="text-xs font-medium text-muted-foreground">Qualitative Notes</label>
                                  <Textarea
                                    value={row.notes}
                                    onChange={(e) => updateScoreRow(idx, "notes", e.target.value)}
                                    rows={3}
                                    data-testid={`input-score-notes-${idx}`}
                                  />
                                </div>
                                {row.errors.length > 0 && (
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-destructive text-xs">
                                      <AlertTriangle className="h-3 w-3" />
                                      {row.errors.join(", ")}
                                    </div>
                                  </div>
                                )}
                                {row.warnings && row.warnings.length > 0 && (
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                                      <AlertTriangle className="h-3 w-3" />
                                      {row.warnings.join(", ")}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end mt-3">
                                <Button variant="outline" size="sm" onClick={() => setEditingScoreRow(null)} data-testid={`button-close-edit-score-${idx}`}>
                                  Done Editing
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => { setScoreImportStep("upload"); setScoreImportPreviewData([]); setScoreImportSummary(null); }} data-testid="button-back-to-score-upload">
                  Back
                </Button>
                <Button variant="outline" onClick={() => { setScoreImportDialogOpen(false); resetScoreImportState(); }} data-testid="button-cancel-score-import">
                  Cancel
                </Button>
                {(() => {
                  const matchedCount = scoreImportPreviewData.filter(r => r.include).length;
                  const unmatchedCount = scoreImportPreviewData.filter(r => !r.matchedOkrId && !r.isDuplicate).length;
                  const label = matchedCount > 0
                    ? `Import ${matchedCount} Score${matchedCount !== 1 ? "s" : ""}${unmatchedCount > 0 ? ` + Save ${unmatchedCount} Pending` : ""}`
                    : unmatchedCount > 0
                      ? `Save ${unmatchedCount} Pending Score${unmatchedCount !== 1 ? "s" : ""}`
                      : "Nothing to Import";
                  return (
                    <Button
                      onClick={handleConfirmScoreImport}
                      disabled={confirmScoreImportMutation.isPending || (matchedCount === 0 && unmatchedCount === 0)}
                      data-testid="button-confirm-score-import"
                    >
                      {label}
                    </Button>
                  );
                })()}
              </DialogFooter>
            </div>
          )}

          {scoreImportStep === "importing" && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Processing {scoreImportPreviewData.length} rows...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={linkingScoreRow !== null} onOpenChange={(open) => { if (!open) setLinkingScoreRow(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search and Link OKR
            </DialogTitle>
            <DialogDescription>
              {linkingScoreRow !== null && scoreImportPreviewData[linkingScoreRow] && (
                <>
                  Finding an OKR to link to Row {scoreImportPreviewData[linkingScoreRow].rowIndex}: {scoreImportPreviewData[linkingScoreRow].okrNumber} - {scoreImportPreviewData[linkingScoreRow].spuName} ({scoreImportPreviewData[linkingScoreRow].quarter} {scoreImportPreviewData[linkingScoreRow].year})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {linkingScoreRow !== null && scoreImportPreviewData[linkingScoreRow] && (() => {
            const row = scoreImportPreviewData[linkingScoreRow];
            return (
              <Card className="bg-muted/30" data-testid="card-score-row-details">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">Score Row Details</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Scorer:</span> <span className="font-medium">{row.scorerName || "—"}</span></div>
                    <div><span className="text-muted-foreground">SPU:</span> <span className="font-medium">{row.spuName || "—"}</span></div>
                    <div><span className="text-muted-foreground">Sub-unit:</span> <span className="font-medium">{row.subUnitName || "—"}</span></div>
                    <div><span className="text-muted-foreground">Period:</span> <span className="font-medium">{row.quarter} {row.year}</span></div>
                  </div>
                  {row.krScores && row.krScores.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">KR Scores:</span>
                      {row.krScores.map((kr: any, ki: number) => (
                        <Badge key={ki} variant="outline" className="text-xs">KR{kr.krNumber}: {kr.score}</Badge>
                      ))}
                      {row.averageScore != null && (
                        <Badge variant="secondary" className="text-xs">Avg: {row.averageScore}</Badge>
                      )}
                    </div>
                  )}
                  {row.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Notes:</span>{" "}
                      <span className="italic text-xs">{row.notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input
                  placeholder="Search objectives..."
                  value={okrSearchQuery}
                  onChange={(e) => setOkrSearchQuery(e.target.value)}
                  data-testid="input-okr-search-query"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">SPU</label>
                <Select value={okrSearchSpu} onValueChange={setOkrSearchSpu}>
                  <SelectTrigger data-testid="select-okr-search-spu"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SPUs</SelectItem>
                    {spus?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Quarter</label>
                <Select value={okrSearchQuarter} onValueChange={setOkrSearchQuarter}>
                  <SelectTrigger data-testid="select-okr-search-quarter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ALL_QUARTERS_LABEL}</SelectItem>
                    {QUARTERS.map(q => <SelectItem key={q.value} value={q.value}>{q.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Year</label>
                <Select value={okrSearchYear} onValueChange={setOkrSearchYear}>
                  <SelectTrigger data-testid="select-okr-search-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years?.map(y => <SelectItem key={y.year} value={String(y.year)}>{y.year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md overflow-y-auto max-h-[40vh]">
              {isSearchingOkrs ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Searching...</div>
              ) : searchedOkrs && searchedOkrs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-50">
                      <TableHead>OKR #</TableHead>
                      <TableHead>SPU / Sub-unit</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Objective Statement</TableHead>
                      <TableHead>Key Results</TableHead>
                      <TableHead className="w-16">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchedOkrs.map((okr: any, oi: number) => (
                      <TableRow key={okr.id} data-testid={`row-okr-search-${oi}`}>
                        <TableCell className="text-sm font-medium">{okr.okrNumber}</TableCell>
                        <TableCell className="text-sm">{okr.spuName}{okr.subUnitName ? ` / ${okr.subUnitName}` : ''}</TableCell>
                        <TableCell className="text-sm">{okr.quarter} {okr.year}</TableCell>
                        <TableCell className="text-sm">{okr.staffName}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          <span className="line-clamp-3" title={okr.objectiveStatement}>{okr.objectiveStatement}</span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px]">
                          <ul className="list-disc list-inside">
                            {parseKeyResultsForDisplay(okr.keyResults).slice(0, 3).map((kr: string, ki: number) => (
                              <li key={ki} className="truncate" title={kr}>{kr}</li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => linkingScoreRow !== null && linkOkrToScoreRow(linkingScoreRow, okr)}
                            data-testid={`button-select-okr-${oi}`}
                          >
                            Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {searchedOkrs && searchedOkrs.length === 0 ? "No OKRs found matching filters" : "Use the filters above to search for OKRs"}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingScoreRow(null)} data-testid="button-cancel-link">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
