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
import { ChevronDown, ChevronRight, Edit, Database, Trash2, AlertTriangle, Filter, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OkrWithDetails, QuarterlyUpdate, Staff, Spu } from "@shared/schema";
import { getQuarterLabel } from "@shared/schema";

interface AggregatedOkr extends OkrWithDetails {
  derivedProgress: number;
  quarterlyUpdates: Array<QuarterlyUpdate & { keyResultScoresParsed: any }>;
}

const editOkrSchema = z.object({
  objectiveStatement: z.string().min(20, "Objective must be at least 20 characters"),
  status: z.enum(["not_started", "in_progress", "at_risk", "completed"]),
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

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const okrNumbers = ["OKR 1", "OKR 2", "OKR 3", "OKR 4", "OKR 5"];

export default function Data() {
  const { toast } = useToast();
  const [expandedOkrIds, setExpandedOkrIds] = useState<Set<string>>(new Set());
  const [editingOkr, setEditingOkr] = useState<AggregatedOkr | null>(null);
  const [editingUpdate, setEditingUpdate] = useState<(QuarterlyUpdate & { keyResultScoresParsed: any }) | null>(null);
  
  // Filter states
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [filterOkrNumber, setFilterOkrNumber] = useState<string>("all");
  const [filterSpu, setFilterSpu] = useState<string>("all");
  
  // Selection states
  const [selectedOkrIds, setSelectedOkrIds] = useState<Set<string>>(new Set());
  
  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const { data: okrsWithUpdates, isLoading } = useQuery<AggregatedOkr[]>({
    queryKey: ["/api/okrs-with-updates"],
  });

  const { data: allStaff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  // Filter the data
  const filteredOkrs = useMemo(() => {
    if (!okrsWithUpdates) return [];
    
    return okrsWithUpdates.filter((okr) => {
      if (filterStaff !== "all" && okr.staffId !== filterStaff) return false;
      if (filterYear !== "all" && okr.year.toString() !== filterYear) return false;
      if (filterQuarter !== "all" && okr.quarter !== filterQuarter) return false;
      if (filterOkrNumber !== "all" && okr.okrNumber !== filterOkrNumber) return false;
      if (filterSpu !== "all" && okr.spuId !== filterSpu) return false;
      return true;
    });
  }, [okrsWithUpdates, filterStaff, filterYear, filterQuarter, filterOkrNumber, filterSpu]);

  // Check if any filters are active
  const hasActiveFilters = filterStaff !== "all" || filterYear !== "all" || filterQuarter !== "all" || filterOkrNumber !== "all" || filterSpu !== "all";
  
  const clearAllFilters = () => {
    setFilterStaff("all");
    setFilterYear("all");
    setFilterQuarter("all");
    setFilterOkrNumber("all");
    setFilterSpu("all");
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
    mutationFn: async (data: { id: string; updates: EditOkrFormValues }) => {
      return await apiRequest("PUT", `/api/okrs/${data.id}`, data.updates);
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
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the OKR. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateQuarterlyUpdateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: { keyResultScores?: string; additionalKeyResults?: string; notes?: string } }) => {
      return await apiRequest("PUT", `/api/quarterly-updates/${data.id}`, data.updates);
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
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save the quarterly update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteOkrMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/okrs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the OKR. Please try again.",
        variant: "destructive",
      });
    },
  });

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

    try {
      if (deleteMode === "single" && singleDeleteId) {
        await deleteOkrMutation.mutateAsync(singleDeleteId);
        toast({
          title: "OKR Deleted",
          description: "The OKR has been permanently deleted.",
        });
      } else if (deleteMode === "bulk") {
        const deletePromises = Array.from(selectedOkrIds).map(id => deleteOkrMutation.mutateAsync(id));
        await Promise.all(deletePromises);
        setSelectedOkrIds(new Set());
        toast({
          title: "OKRs Deleted",
          description: `${selectedOkrIds.size} OKR(s) have been permanently deleted.`,
        });
      }
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      setSingleDeleteId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleEditOkr = (okr: AggregatedOkr) => {
    setEditingOkr(okr);
    okrForm.reset({
      objectiveStatement: okr.objectiveStatement,
      status: okr.status as "not_started" | "in_progress" | "at_risk" | "completed",
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
    if (editingOkr) {
      updateOkrMutation.mutate({ id: editingOkr.id, updates: data });
    }
  };

  const onSubmitUpdate = (data: EditQuarterlyUpdateFormValues) => {
    if (!editingUpdate) return;
    
    const updates = {
      keyResultScores: JSON.stringify(data.keyResultScores),
      additionalKeyResults: data.additionalKeyResults,
      notes: data.notes,
    };
    
    updateQuarterlyUpdateMutation.mutate({
      id: editingUpdate.id,
      updates,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      case "at_risk":
        return "bg-yellow-500";
      case "not_started":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Staff Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Staff</label>
                  <Select value={filterStaff} onValueChange={setFilterStaff}>
                    <SelectTrigger data-testid="select-filter-staff">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {allStaff?.map((staff) => (
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
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
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
                      <SelectValue placeholder="All Quarters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quarters</SelectItem>
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
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredOkrs.length} of {okrsWithUpdates?.length || 0} OKRs
            </span>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredOkrs || filteredOkrs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {hasActiveFilters ? "No OKRs match the selected filters" : "No OKRs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOkrs.map((okr) => {
                    const isExpanded = expandedOkrIds.has(okr.id);
                    const isSelected = selectedOkrIds.has(okr.id);
                    return (
                      <Fragment key={okr.id}>
                        <TableRow className={`hover-elevate ${isSelected ? 'bg-primary/5' : ''}`} data-testid={`row-okr-${okr.id}`}>
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
                          <TableCell className="max-w-xs truncate">{okr.objectiveStatement}</TableCell>
                          <TableCell>
                            <span className="font-semibold" data-testid={`text-progress-${okr.id}`}>
                              {okr.derivedProgress}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(okr.status)} data-testid={`badge-status-${okr.id}`}>
                              {okr.status.replace("_", " ")}
                            </Badge>
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
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm">Quarterly Updates ({okr.quarterlyUpdates.length})</h4>
                                {okr.quarterlyUpdates.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No quarterly updates yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {okr.quarterlyUpdates.map((update) => (
                                      <Card key={update.id} className="bg-background" data-testid={`card-update-${update.id}`}>
                                        <CardContent className="pt-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-sm font-medium">Quarter/Year</p>
                                              <p className="text-sm text-muted-foreground">
                                                {getQuarterLabel(update.quarter)} {update.year}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Average Score</p>
                                              <p className="text-sm text-muted-foreground" data-testid={`text-avg-score-${update.id}`}>
                                                {update.averageScore ?? "N/A"}%
                                              </p>
                                            </div>
                                            <div className="md:col-span-2">
                                              <p className="text-sm font-medium">Notes</p>
                                              <p className="text-sm text-muted-foreground">{update.notes}</p>
                                            </div>
                                            {update.keyResultScoresParsed && (
                                              <div className="md:col-span-2">
                                                <p className="text-sm font-medium">Key Result Scores</p>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                  {update.keyResultScoresParsed.map((kr: any, idx: number) => (
                                                    <div key={idx} className="text-sm">
                                                      <span className="font-medium">KR{kr.keyResultNumber}:</span>{" "}
                                                      <span className="text-muted-foreground">{kr.score}%</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            <div className="md:col-span-2 text-right">
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
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                )}
                              </div>
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
        </CardContent>
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
                deleteOkrMutation.isPending
              }
              data-testid="button-confirm-delete"
            >
              {deleteOkrMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit OKR Dialog */}
      <Dialog open={!!editingOkr} onOpenChange={(open) => !open && setEditingOkr(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit OKR</DialogTitle>
            <DialogDescription>
              Update the details for {editingOkr?.okrNumber} - {editingOkr?.quarter} {editingOkr?.year}
            </DialogDescription>
          </DialogHeader>
          <Form {...okrForm}>
            <form onSubmit={okrForm.handleSubmit(onSubmitOkr)} className="space-y-4">
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
              <div className="space-y-2">
                <p className="text-sm font-medium">University Objective (Read-only)</p>
                <p className="text-sm text-muted-foreground">{editingOkr?.universityObjective}</p>
              </div>
              <FormField
                control={okrForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="at_risk">At Risk</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              {/* Individual Key Result Scores */}
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
    </div>
  );
}
