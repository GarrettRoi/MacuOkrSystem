import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Edit, Database } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OkrWithDetails, QuarterlyUpdate } from "@shared/schema";

interface AggregatedOkr extends OkrWithDetails {
  derivedProgress: number;
  quarterlyUpdates: Array<QuarterlyUpdate & { keyResultScoresParsed: any }>;
}

// Form schemas for editing
const editOkrSchema = z.object({
  objectiveStatement: z.string().min(20, "Objective must be at least 20 characters"),
  universityObjective: z.string(),
  universityKeyResult: z.string(),
  keyResults: z.string(),
  status: z.enum(["not_started", "in_progress", "at_risk", "completed"]),
});

const editQuarterlyUpdateSchema = z.object({
  keyResultScores: z.string(),
  averageScore: z.coerce.number().min(0).max(100),
  additionalKeyResults: z.string().optional(),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
});

type EditOkrFormValues = z.infer<typeof editOkrSchema>;
type EditQuarterlyUpdateFormValues = z.infer<typeof editQuarterlyUpdateSchema>;

export default function Data() {
  const { toast } = useToast();
  const [expandedOkrIds, setExpandedOkrIds] = useState<Set<string>>(new Set());
  const [editingOkr, setEditingOkr] = useState<AggregatedOkr | null>(null);
  const [editingUpdate, setEditingUpdate] = useState<(QuarterlyUpdate & { keyResultScoresParsed: any }) | null>(null);

  const { data: okrsWithUpdates, isLoading } = useQuery<AggregatedOkr[]>({
    queryKey: ["/api/okrs-with-updates"],
  });

  const toggleExpanded = (okrId: string) => {
    const newExpanded = new Set(expandedOkrIds);
    if (newExpanded.has(okrId)) {
      newExpanded.delete(okrId);
    } else {
      newExpanded.add(okrId);
    }
    setExpandedOkrIds(newExpanded);
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
    mutationFn: async (data: { id: string; updates: EditQuarterlyUpdateFormValues }) => {
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

  const handleEditOkr = (okr: AggregatedOkr) => {
    setEditingOkr(okr);
    okrForm.reset({
      objectiveStatement: okr.objectiveStatement,
      universityObjective: okr.universityObjective,
      universityKeyResult: okr.universityKeyResult,
      keyResults: okr.keyResults,
      status: okr.status as "not_started" | "in_progress" | "at_risk" | "completed",
    });
  };

  const handleEditUpdate = (update: QuarterlyUpdate & { keyResultScoresParsed: any }) => {
    setEditingUpdate(update);
    updateForm.reset({
      keyResultScores: update.keyResultScores || "[]",
      averageScore: update.averageScore || 0,
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
    if (editingUpdate) {
      updateQuarterlyUpdateMutation.mutate({ id: editingUpdate.id, updates: data });
    }
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
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-semibold">OKR Data Management</CardTitle>
              <CardDescription className="mt-1">
                View and edit all OKR submissions and quarterly updates
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
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
                {!okrsWithUpdates || okrsWithUpdates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No OKRs found
                    </TableCell>
                  </TableRow>
                ) : (
                  okrsWithUpdates.map((okr) => {
                    const isExpanded = expandedOkrIds.has(okr.id);
                    return (
                      <>
                        <TableRow key={okr.id} className="hover-elevate" data-testid={`row-okr-${okr.id}`}>
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
                            {okr.quarter} {okr.year}
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditOkr(okr)}
                              data-testid={`button-edit-okr-${okr.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
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
                                                {update.quarter} {update.year}
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
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              <FormField
                control={okrForm.control}
                name="universityObjective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University Objective</FormLabel>
                    <FormControl>
                      <Input {...field} disabled data-testid="input-university-objective" />
                    </FormControl>
                    <FormDescription>Read-only field</FormDescription>
                  </FormItem>
                )}
              />
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
              <FormField
                control={updateForm.control}
                name="averageScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Average Score</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} data-testid="input-average-score" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
