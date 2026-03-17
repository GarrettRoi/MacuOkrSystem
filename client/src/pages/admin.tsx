import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Settings, Pencil, Merge, Users, UserPlus, Lock, Target, ChevronDown, ChevronRight, ArrowUpFromLine, ArrowDownToLine, MoveHorizontal, TriangleAlert, Loader2, RefreshCw } from "lucide-react";
import type { Staff, Spu, SubUnit, Year, StaffWithDetails, UniversityObjectiveWithKeyResults, StrategicAdvancementData } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { compareNames } from "@/lib/utils";

interface AdminProps {
  staff: StaffWithDetails;
}

export default function Admin({ staff }: AdminProps) {
  const { toast } = useToast();
  
  const [spuDialogOpen, setSpuDialogOpen] = useState(false);
  const [subUnitDialogOpen, setSubUnitDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  
  const [editSpuDialogOpen, setEditSpuDialogOpen] = useState(false);
  const [editSubUnitDialogOpen, setEditSubUnitDialogOpen] = useState(false);
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  
  const [newSpuName, setNewSpuName] = useState("");
  const [newSubUnitName, setNewSubUnitName] = useState("");
  const [newSubUnitParent, setNewSubUnitParent] = useState("");
  
  const [newStaffIdNumber, setNewStaffIdNumber] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffSpu, setNewStaffSpu] = useState("");
  const [newStaffSubUnit, setNewStaffSubUnit] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"super_admin" | "leader" | "basic">("basic");
  const [newYear, setNewYear] = useState("");
  
  const [editingSpu, setEditingSpu] = useState<Spu | null>(null);
  const [editingSubUnit, setEditingSubUnit] = useState<SubUnit | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [staffNameFilter, setStaffNameFilter] = useState("");
  const [deleteStaffDialogOpen, setDeleteStaffDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  
  const [spuAssignmentsDialogOpen, setSpuAssignmentsDialogOpen] = useState(false);
  const [spuAssignmentsStaff, setSpuAssignmentsStaff] = useState<Staff | null>(null);
  const [newAssignmentSpuId, setNewAssignmentSpuId] = useState("");
  const [newAssignmentSubUnitId, setNewAssignmentSubUnitId] = useState("");

  const [mergeSpuDialogOpen, setMergeSpuDialogOpen] = useState(false);
  const [mergeSpuSourceId, setMergeSpuSourceId] = useState("");
  const [mergeSpuTargetId, setMergeSpuTargetId] = useState("");
  const [convertSpuDialogOpen, setConvertSpuDialogOpen] = useState(false);
  const [convertSpuSource, setConvertSpuSource] = useState<Spu | null>(null);
  const [convertSpuTargetId, setConvertSpuTargetId] = useState("");
  const [promoteSubUnitDialogOpen, setPromoteSubUnitDialogOpen] = useState(false);
  const [promoteSubUnit, setPromoteSubUnit] = useState<SubUnit | null>(null);
  const [promoteSubUnitIdsToMove, setPromoteSubUnitIdsToMove] = useState<string[]>([]);
  const [expandedSpus, setExpandedSpus] = useState<Set<string>>(new Set());
  const [moveSubUnitDialogOpen, setMoveSubUnitDialogOpen] = useState(false);
  const [moveSubUnit, setMoveSubUnit] = useState<SubUnit | null>(null);
  const [moveSubUnitTargetSpuId, setMoveSubUnitTargetSpuId] = useState("");
  const [addSubUnitForSpuId, setAddSubUnitForSpuId] = useState("");

  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [newObjLabel, setNewObjLabel] = useState("");
  const [newObjDescription, setNewObjDescription] = useState("");
  const [newObjYears, setNewObjYears] = useState<number[]>([]);
  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [krParentObjId, setKrParentObjId] = useState("");
  const [newKrLabel, setNewKrLabel] = useState("");
  const [newKrDescription, setNewKrDescription] = useState("");
  const [editObjDialogOpen, setEditObjDialogOpen] = useState(false);
  const [editingObj, setEditingObj] = useState<{ id: string; label: string; description: string; applicableYears: number[]; isActive: boolean } | null>(null);
  const [editKrDialogOpen, setEditKrDialogOpen] = useState(false);
  const [editingKr, setEditingKr] = useState<{ id: string; label: string; description: string } | null>(null);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  const { data: spus, isLoading: spusLoading } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: subUnits, isLoading: subUnitsLoading } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: years, isLoading: yearsLoading } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  // Fetch all SPU assignments for display in staff table
  const { data: allSpuAssignments } = useQuery<any[]>({
    queryKey: ["/api/spu-assignments"],
  });

  // Helper to get additional SPU names for a staff member
  const getAdditionalSpuNames = (memberId: string): string[] => {
    if (!allSpuAssignments || !spus) return [];
    const assignments = allSpuAssignments.filter(a => a.staffId === memberId);
    return assignments.map(a => {
      const spuName = a.spu?.name || getSpuName(a.spuId);
      const subUnitName = a.subUnit?.name || (a.subUnitId ? getSubUnitName(a.subUnitId) : null);
      return subUnitName ? `${spuName} - ${subUnitName}` : spuName;
    });
  };

  // Fetch basic users for leaders
  const { data: myTeam, isLoading: myTeamLoading } = useQuery<StaffWithDetails[]>({
    queryKey: ["/api/staff", staff.id, "basic-users"],
    queryFn: async () => {
      const response = await fetch(`/api/staff/${staff.id}/basic-users`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: staff.role === "leader" || staff.role === "super_admin",
  });

  const { data: passwordLoginSetting } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/password-login"],
    enabled: staff.role === "super_admin",
  });

  const { data: ssoSetting, refetch: refetchSso } = useQuery<{
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    hasClientSecret: boolean;
  }>({
    queryKey: ["/api/settings/sso"],
    enabled: staff.role === "super_admin",
  });
  const [ssoIssuerUrl, setSsoIssuerUrl] = useState("");
  const [ssoClientId, setSsoClientId] = useState("");
  const [ssoClientSecret, setSsoClientSecret] = useState("");

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
    enabled: staff.role === "super_admin",
  });
  const [editingStartYear, setEditingStartYear] = useState<string>("");
  const planStartYear = planStartYearData?.startYear || 2024;

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", "/api/setup/reset", {}),
    onSuccess: () => {
      toast({ title: "System Reset Complete", description: "All data has been cleared. Redirecting to setup…" });
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err: any) => toast({ title: "Reset Failed", description: err.message, variant: "destructive" }),
  });

  const { data: universityObjectives, isLoading: objectivesLoading } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
    enabled: staff.role === "super_admin",
  });

  const { data: advancementData, isLoading: advancementLoading } = useQuery<StrategicAdvancementData>({
    queryKey: ["/api/strategic-advancement"],
    enabled: staff.role === "super_admin",
  });

  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});
  const [localComments, setLocalComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (advancementData) {
      const progress: Record<string, number> = {};
      const comments: Record<string, string> = {};
      for (const obj of advancementData.objectives) {
        comments[obj.id] = obj.comment;
        for (const kr of obj.keyResults) {
          progress[kr.id] = kr.progressPercent;
        }
      }
      setLocalProgress((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(progress)) {
          if (!(k in prev)) merged[k] = v;
        }
        return merged;
      });
      setLocalComments((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(comments)) {
          if (!(k in prev)) merged[k] = v;
        }
        return merged;
      });
    }
  }, [advancementData]);

  const saveProgressMutation = useMutation({
    mutationFn: async ({ keyResultId, progressPercent }: { keyResultId: string; progressPercent: number }) => {
      return await apiRequest("PUT", `/api/strategic-advancement/progress/${keyResultId}`, { progressPercent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategic-advancement"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save progress.", variant: "destructive" }),
  });

  const saveCommentMutation = useMutation({
    mutationFn: async ({ objectiveId, comment }: { objectiveId: string; comment: string }) => {
      return await apiRequest("PUT", `/api/strategic-advancement/comment/${objectiveId}`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategic-advancement"] });
      toast({ title: "Comment Saved", description: "The objective comment has been updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save comment.", variant: "destructive" }),
  });

  const updateAdvancementDateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/strategic-advancement/update-date", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategic-advancement"] });
      toast({ title: "Date Updated", description: "The last updated date has been refreshed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to update date.", variant: "destructive" }),
  });

  const addObjectiveMutation = useMutation({
    mutationFn: async (data: { label: string; description: string; sortOrder?: number; applicableYears?: number[] }) => {
      return await apiRequest("POST", "/api/university-objectives", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      setObjDialogOpen(false);
      setNewObjLabel("");
      setNewObjDescription("");
      setNewObjYears([]);
      toast({ title: "Objective Added", description: "The university objective has been created." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Add Objective", description: error?.message || "Could not create the university objective.", variant: "destructive" });
    },
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; label: string; description: string; applicableYears: number[]; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/university-objectives/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      setEditObjDialogOpen(false);
      setEditingObj(null);
      toast({ title: "Objective Updated", description: "The university objective has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Update Objective", description: error?.message || "Could not update the university objective.", variant: "destructive" });
    },
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/university-objectives/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      toast({ title: "Objective Deleted", description: "The university objective and its key results have been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Delete Objective", description: error?.message || "Could not delete the university objective.", variant: "destructive" });
    },
  });

  const addKeyResultMutation = useMutation({
    mutationFn: async (data: { objectiveId: string; label: string; description: string; sortOrder?: number }) => {
      return await apiRequest("POST", "/api/university-key-results", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      setKrDialogOpen(false);
      setKrParentObjId("");
      setNewKrLabel("");
      setNewKrDescription("");
      toast({ title: "Key Result Added", description: "The university key result has been created." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Add Key Result", description: error?.message || "Could not create the key result.", variant: "destructive" });
    },
  });

  const updateKeyResultMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; label: string; description: string }) => {
      return await apiRequest("PATCH", `/api/university-key-results/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      setEditKrDialogOpen(false);
      setEditingKr(null);
      toast({ title: "Key Result Updated", description: "The university key result has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Update Key Result", description: error?.message || "Could not update the key result.", variant: "destructive" });
    },
  });

  const deleteKeyResultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/university-key-results/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university-objectives"] });
      toast({ title: "Key Result Deleted", description: "The university key result has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to Delete Key Result", description: error?.message || "Could not delete the key result.", variant: "destructive" });
    },
  });

  const toggleObjectiveExpanded = (objId: string) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(objId)) {
        next.delete(objId);
      } else {
        next.add(objId);
      }
      return next;
    });
  };

  const togglePasswordLoginMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest("PUT", "/api/settings/password-login", { enabled });
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/password-login"] });
      toast({
        title: enabled ? "Password Login Enabled" : "Password Login Disabled",
        description: enabled
          ? "Users must now enter a password to access the system."
          : "Users can now enter without a password by selecting Admin or Staff access.",
      });
    },
  });

  const updateSsoMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; issuerUrl?: string; clientId?: string; clientSecret?: string }) => {
      return await apiRequest("PUT", "/api/settings/sso", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sso"] });
      setSsoClientSecret("");
      toast({ title: "SSO Settings Saved", description: "Single Sign-On configuration has been updated." });
    },
  });

  const updateStartYearMutation = useMutation({
    mutationFn: async (startYear: number) => {
      return await apiRequest("PUT", "/api/settings/strategic-plan-start-year", { startYear });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/strategic-plan-start-year"] });
      toast({
        title: "Strategic Plan Start Year Updated",
        description: "The planning year calculations have been updated across the system.",
      });
    },
  });

  const addSpuMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/spus", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      setSpuDialogOpen(false);
      setNewSpuName("");
      toast({ title: "SPU Added", description: "The SPU has been created successfully." });
    },
  });

  const deleteSpuMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/spus/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      toast({ title: "SPU Deleted", description: "The SPU has been removed." });
    },
  });

  const addSubUnitMutation = useMutation({
    mutationFn: async (data: { name: string; spuId: string }) => {
      return await apiRequest("POST", "/api/sub-units", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      setSubUnitDialogOpen(false);
      setNewSubUnitName("");
      setNewSubUnitParent("");
      toast({ title: "Sub-Unit Added", description: "The sub-unit has been created successfully." });
    },
  });

  const deleteSubUnitMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sub-units/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      toast({ title: "Sub-Unit Deleted", description: "The sub-unit has been removed." });
    },
  });

  const addYearMutation = useMutation({
    mutationFn: async (year: number) => {
      return await apiRequest("POST", "/api/years", { year });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/years"] });
      setYearDialogOpen(false);
      setNewYear("");
      toast({ title: "Year Added", description: "The year has been added successfully." });
    },
  });

  const deleteYearMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/years/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/years"] });
      toast({ title: "Year Deleted", description: "The year has been removed." });
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async (data: { staffIdNumber?: string; name: string; email: string; spuId: string; subUnitId?: string; role: string }) => {
      return await apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setNewStaffIdNumber("");
      setNewStaffRole("basic");
      setStaffDialogOpen(false);
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffSpu("");
      setNewStaffSubUnit("");
      toast({ title: "Staff Member Added", description: "The staff member has been created successfully." });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/staff/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setDeleteStaffDialogOpen(false);
      setStaffToDelete(null);
      toast({ title: "Staff Member Deleted", description: "The staff member has been removed." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to Delete", 
        description: error.message || "Could not delete staff member. Please try again.",
        variant: "destructive"
      });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { id: string; staffIdNumber?: string | null; name?: string; email?: string; role?: string; spuId?: string; subUnitId?: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/staff/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setEditStaffDialogOpen(false);
      setEditingStaff(null);
      toast({ title: "Staff Member Updated", description: "The staff member has been updated successfully." });
    },
  });

  const mergeStaffMutation = useMutation({
    mutationFn: async (data: { sourceId: string; targetId: string }) => {
      return await apiRequest("POST", "/api/staff/merge", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs-with-updates"] });
      setMergeDialogOpen(false);
      setMergeSourceId("");
      setMergeTargetId("");
      toast({ 
        title: "Staff Accounts Merged", 
        description: data.message || "Staff accounts have been merged successfully." 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Merge Failed", 
        description: error?.message || "Failed to merge staff accounts.",
        variant: "destructive"
      });
    },
  });

  // Query for staff SPU assignments
  const { data: staffSpuAssignments } = useQuery<any[]>({
    queryKey: ["/api/staff", spuAssignmentsStaff?.id, "spu-assignments"],
    enabled: !!spuAssignmentsStaff?.id,
  });

  const addSpuAssignmentMutation = useMutation({
    mutationFn: async (data: { staffId: string; spuId: string; subUnitId?: string }) => {
      return await apiRequest("POST", `/api/staff/${data.staffId}/spu-assignments`, { 
        spuId: data.spuId, 
        subUnitId: data.subUnitId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      if (spuAssignmentsStaff) {
        queryClient.invalidateQueries({ queryKey: ["/api/staff", spuAssignmentsStaff.id, "spu-assignments"] });
      }
      setNewAssignmentSpuId("");
      setNewAssignmentSubUnitId("");
      toast({ title: "SPU Assignment Added", description: "The SPU assignment has been added." });
    },
    onError: () => {
      toast({ title: "Failed", description: "Failed to add SPU assignment.", variant: "destructive" });
    },
  });

  const deleteSpuAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/staff/spu-assignments/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      if (spuAssignmentsStaff) {
        queryClient.invalidateQueries({ queryKey: ["/api/staff", spuAssignmentsStaff.id, "spu-assignments"] });
      }
      toast({ title: "SPU Assignment Removed", description: "The SPU assignment has been removed." });
    },
    onError: () => {
      toast({ title: "Failed", description: "Failed to remove SPU assignment.", variant: "destructive" });
    },
  });

  const updateSpuMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/spus/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      setEditSpuDialogOpen(false);
      setEditingSpu(null);
      toast({ title: "SPU Updated", description: "The SPU has been updated successfully." });
    },
  });

  const updateSubUnitMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; spuId?: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/sub-units/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      setEditSubUnitDialogOpen(false);
      setEditingSubUnit(null);
      toast({ title: "Sub-Unit Updated", description: "The sub-unit has been updated successfully." });
    },
  });

  const mergeSpuMutation = useMutation({
    mutationFn: async (data: { sourceId: string; targetId: string }) => {
      const res = await apiRequest("POST", "/api/spus/merge", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      setMergeSpuDialogOpen(false);
      setMergeSpuSourceId("");
      setMergeSpuTargetId("");
      toast({ title: "SPUs Merged", description: data.message || "SPUs have been merged successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Merge Failed", description: error?.message || "Failed to merge SPUs.", variant: "destructive" });
    },
  });

  const convertSpuToSubUnitMutation = useMutation({
    mutationFn: async (data: { sourceId: string; targetSpuId: string }) => {
      const res = await apiRequest("POST", `/api/spus/${data.sourceId}/convert-to-subunit`, { targetSpuId: data.targetSpuId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      setConvertSpuDialogOpen(false);
      setConvertSpuSource(null);
      setConvertSpuTargetId("");
      toast({ title: "SPU Converted", description: data.message || "SPU has been converted to a sub-unit." });
    },
    onError: (error: any) => {
      toast({ title: "Conversion Failed", description: error?.message || "Failed to convert SPU.", variant: "destructive" });
    },
  });

  const promoteSubUnitToSpuMutation = useMutation({
    mutationFn: async (data: { subUnitId: string; subUnitIdsToMove: string[] }) => {
      const res = await apiRequest("POST", `/api/sub-units/${data.subUnitId}/promote-to-spu`, { subUnitIdsToMove: data.subUnitIdsToMove });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      setPromoteSubUnitDialogOpen(false);
      setPromoteSubUnit(null);
      setPromoteSubUnitIdsToMove([]);
      toast({ title: "Sub-Unit Promoted", description: data.message || "Sub-unit has been promoted to a full SPU." });
    },
    onError: (error: any) => {
      toast({ title: "Promotion Failed", description: error?.message || "Failed to promote sub-unit.", variant: "destructive" });
    },
  });

  const moveSubUnitMutation = useMutation({
    mutationFn: async (data: { subUnitId: string; targetSpuId: string }) => {
      const res = await apiRequest("POST", `/api/sub-units/${data.subUnitId}/move`, { targetSpuId: data.targetSpuId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spu-assignments"] });
      setMoveSubUnitDialogOpen(false);
      setMoveSubUnit(null);
      setMoveSubUnitTargetSpuId("");
      toast({ title: "Sub-Unit Moved", description: data.message || "Sub-unit has been moved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Move Failed", description: error?.message || "Failed to move sub-unit.", variant: "destructive" });
    },
  });

  const toggleSpuExpanded = (spuId: string) => {
    setExpandedSpus(prev => {
      const next = new Set(prev);
      if (next.has(spuId)) next.delete(spuId);
      else next.add(spuId);
      return next;
    });
  };

  const getSubUnitsForSpu = (spuId: string) => {
    return subUnits?.filter(su => su.spuId === spuId) || [];
  };

  const getSpuName = (spuId: string) => {
    return spus?.find((s) => s.id === spuId)?.name || "Unknown";
  };

  const getSubUnitName = (subUnitId: string | null) => {
    if (!subUnitId) return "—";
    return subUnits?.find((su) => su.id === subUnitId)?.name || "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage staff, SPUs (Schools, Departments, Units), and system settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList>
          {(staff.role === "leader" || staff.role === "super_admin") && (
            <TabsTrigger value="myteam" data-testid="tab-myteam">
              <Users className="h-4 w-4 mr-2" />
              My Team
            </TabsTrigger>
          )}
          <TabsTrigger value="staff" data-testid="tab-staff">Staff Management</TabsTrigger>
          <TabsTrigger value="spus" data-testid="tab-spus">SPUs & Sub-Units</TabsTrigger>
          <TabsTrigger value="years" data-testid="tab-years">Years</TabsTrigger>
          {staff.role === "super_admin" && (
            <TabsTrigger value="strategic" data-testid="tab-strategic">
              <Target className="h-4 w-4 mr-2" />
              Strategic Planning
            </TabsTrigger>
          )}
          {staff.role === "super_admin" && (
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Lock className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        {(staff.role === "leader" || staff.role === "super_admin") && (
          <TabsContent value="myteam">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      My Team
                    </CardTitle>
                    <CardDescription>All staff members in your SPUs (regardless of sub-unit)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {myTeamLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !myTeam || myTeam.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No team members yet.</p>
                    <p className="text-sm">Basic users you create or are assigned to you will appear here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Primary SPU</TableHead>
                        <TableHead>Sub-Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myTeam.sort((a, b) => compareNames(a.name, b.name)).map((member) => (
                        <TableRow key={member.id} data-testid={`row-team-${member.id}`}>
                          <TableCell className="text-muted-foreground">{member.staffIdNumber || "-"}</TableCell>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{member.spu?.name || "-"}</Badge>
                          </TableCell>
                          <TableCell>
                            {member.subUnit?.name ? (
                              <Badge variant="outline">{member.subUnit.name}</Badge>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Staff Members</CardTitle>
                  <CardDescription>Manage university staff and their SPU assignments</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-merge-staff">
                        <Merge className="h-4 w-4 mr-2" />
                        Merge Accounts
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Merge Staff Accounts</DialogTitle>
                        <DialogDescription>
                          Transfer all OKRs, updates, and responsibilities from one account to another. The source account will be deleted.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Source Account (will be deleted)</Label>
                          <Select value={mergeSourceId} onValueChange={setMergeSourceId}>
                            <SelectTrigger data-testid="select-merge-source">
                              <SelectValue placeholder="Select account to merge from" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffList?.slice().sort((a, b) => compareNames(a.name, b.name)).map((s) => (
                                <SelectItem key={s.id} value={s.id} disabled={s.id === mergeTargetId}>
                                  {s.name} ({s.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Target Account (will receive all data)</Label>
                          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                            <SelectTrigger data-testid="select-merge-target">
                              <SelectValue placeholder="Select account to merge into" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffList?.slice().sort((a, b) => compareNames(a.name, b.name)).map((s) => (
                                <SelectItem key={s.id} value={s.id} disabled={s.id === mergeSourceId}>
                                  {s.name} ({s.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {mergeSourceId && mergeTargetId && (
                          <div className="p-3 bg-muted rounded-md text-sm">
                            <strong>Preview:</strong> All OKRs, quarterly updates, and responsibilities from "{staffList?.find(s => s.id === mergeSourceId)?.name}" will be transferred to "{staffList?.find(s => s.id === mergeTargetId)?.name}". The source account will be permanently deleted.
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (mergeSourceId && mergeTargetId) {
                              mergeStaffMutation.mutate({ sourceId: mergeSourceId, targetId: mergeTargetId });
                            }
                          }}
                          disabled={!mergeSourceId || !mergeTargetId || mergeStaffMutation.isPending}
                          data-testid="button-confirm-merge"
                        >
                          {mergeStaffMutation.isPending ? "Merging..." : "Merge Accounts"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-staff">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Staff
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Staff Member</DialogTitle>
                      <DialogDescription>Create a new staff member profile</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="staff-id-number">Staff ID Number</Label>
                        <Input
                          id="staff-id-number"
                          value={newStaffIdNumber}
                          onChange={(e) => setNewStaffIdNumber(e.target.value)}
                          placeholder="e.g., 322503"
                          data-testid="input-staff-id-number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-name">Name *</Label>
                        <Input
                          id="staff-name"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          placeholder="e.g., John Doe"
                          data-testid="input-staff-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-email">Email *</Label>
                        <Input
                          id="staff-email"
                          type="email"
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          placeholder="e.g., john@macu.edu"
                          data-testid="input-staff-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-role">Role *</Label>
                        <Select value={newStaffRole} onValueChange={(v) => setNewStaffRole(v as "super_admin" | "leader" | "basic")}>
                          <SelectTrigger data-testid="select-staff-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic User</SelectItem>
                            <SelectItem value="leader">Leader User</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-spu">Primary SPU (School, Department, Unit) *</Label>
                        <Select value={newStaffSpu} onValueChange={setNewStaffSpu}>
                          <SelectTrigger data-testid="select-staff-spu">
                            <SelectValue placeholder="Select primary SPU" />
                          </SelectTrigger>
                          <SelectContent>
                            {spus?.map((spu) => (
                              <SelectItem key={spu.id} value={spu.id}>
                                {spu.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-subunit">Sub-Unit or Division (Optional)</Label>
                        <Select value={newStaffSubUnit} onValueChange={setNewStaffSubUnit}>
                          <SelectTrigger data-testid="select-staff-subunit">
                            <SelectValue placeholder="None (Optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {subUnits?.filter((su) => su.spuId === newStaffSpu).map((subUnit) => (
                              <SelectItem key={subUnit.id} value={subUnit.id}>
                                {subUnit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (newStaffName && newStaffEmail && newStaffSpu) {
                            addStaffMutation.mutate({
                              staffIdNumber: newStaffIdNumber || undefined,
                              name: newStaffName,
                              email: newStaffEmail,
                              spuId: newStaffSpu,
                              subUnitId: newStaffSubUnit || undefined,
                              role: newStaffRole,
                            });
                          }
                        }}
                        disabled={!newStaffName || !newStaffEmail || !newStaffSpu || addStaffMutation.isPending}
                        data-testid="button-save-staff"
                      >
                        {addStaffMutation.isPending ? "Adding..." : "Add Staff"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Search by name..."
                  value={staffNameFilter}
                  onChange={(e) => setStaffNameFilter(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-staff-name-filter"
                />
              </div>
              {staffLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Primary SPU</TableHead>
                      <TableHead>Sub-Unit</TableHead>
                      <TableHead>Additional SPUs</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No staff members yet. Add your first staff member above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      staffList?.slice()
                        .filter((member) => 
                          staffNameFilter === "" || 
                          member.name.toLowerCase().includes(staffNameFilter.toLowerCase())
                        )
                        .sort((a, b) => compareNames(a.name, b.name))
                        .map((member) => (
                        <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                          <TableCell className="text-muted-foreground">{member.staffIdNumber || "-"}</TableCell>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              member.role === "super_admin" 
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" 
                                : member.role === "leader" 
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}>
                              {member.role === "super_admin" ? "Super Admin" : member.role === "leader" ? "Leader" : "Basic"}
                            </span>
                          </TableCell>
                          <TableCell>{getSpuName(member.spuId)}</TableCell>
                          <TableCell>{getSubUnitName(member.subUnitId)}</TableCell>
                          <TableCell data-testid={`cell-additional-spus-${member.id}`}>
                            {(member.role === "leader" || member.role === "super_admin") ? (
                              <div className="flex flex-wrap gap-1">
                                {getAdditionalSpuNames(member.id).length > 0 ? (
                                  getAdditionalSpuNames(member.id).map((spuName, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                      {spuName}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingStaff(member);
                                  setEditStaffDialogOpen(true);
                                }}
                                data-testid={`button-edit-staff-${member.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {(member.role === "leader" || member.role === "super_admin") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSpuAssignmentsStaff(member);
                                    setSpuAssignmentsDialogOpen(true);
                                  }}
                                  title="Manage SPU Assignments"
                                  data-testid={`button-spu-assignments-${member.id}`}
                                >
                                  <Settings className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setStaffToDelete(member);
                                  setDeleteStaffDialogOpen(true);
                                }}
                                data-testid={`button-delete-staff-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Staff Member</DialogTitle>
                <DialogDescription>Update staff member details and SPU assignments</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-id-number">Staff ID Number</Label>
                  <Input
                    id="edit-staff-id-number"
                    value={editingStaff?.staffIdNumber || ""}
                    onChange={(e) => setEditingStaff(editingStaff ? { ...editingStaff, staffIdNumber: e.target.value || null } : null)}
                    placeholder="e.g., 322503"
                    data-testid="input-edit-staff-id-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-name">Name *</Label>
                  <Input
                    id="edit-staff-name"
                    value={editingStaff?.name || ""}
                    onChange={(e) => setEditingStaff(editingStaff ? { ...editingStaff, name: e.target.value } : null)}
                    placeholder="e.g., John Doe"
                    data-testid="input-edit-staff-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-email">Email *</Label>
                  <Input
                    id="edit-staff-email"
                    type="email"
                    value={editingStaff?.email || ""}
                    onChange={(e) => setEditingStaff(editingStaff ? { ...editingStaff, email: e.target.value } : null)}
                    placeholder="e.g., john@macu.edu"
                    data-testid="input-edit-staff-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-role">Role *</Label>
                  <Select 
                    value={editingStaff?.role || "basic"} 
                    onValueChange={(value) => setEditingStaff(editingStaff ? { ...editingStaff, role: value } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-staff-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic User</SelectItem>
                      <SelectItem value="leader">Leader User</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-spu">Primary SPU (School, Department, Unit) *</Label>
                  <Select 
                    value={editingStaff?.spuId || ""} 
                    onValueChange={(value) => setEditingStaff(editingStaff ? { ...editingStaff, spuId: value } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-staff-spu">
                      <SelectValue placeholder="Select primary SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>
                          {spu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-subunit">Sub-Unit or Division (Optional)</Label>
                  <Select 
                    value={editingStaff?.subUnitId || ""} 
                    onValueChange={(value) => setEditingStaff(editingStaff ? { ...editingStaff, subUnitId: value || null } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-staff-subunit">
                      <SelectValue placeholder="None (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subUnits?.filter((su) => su.spuId === editingStaff?.spuId).map((subUnit) => (
                        <SelectItem key={subUnit.id} value={subUnit.id}>
                          {subUnit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditStaffDialogOpen(false);
                    setEditingStaff(null);
                  }}
                  data-testid="button-cancel-edit-staff"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingStaff && editingStaff.name && editingStaff.email && editingStaff.spuId) {
                      updateStaffMutation.mutate({
                        id: editingStaff.id,
                        staffIdNumber: editingStaff.staffIdNumber,
                        name: editingStaff.name,
                        email: editingStaff.email,
                        role: editingStaff.role,
                        spuId: editingStaff.spuId,
                        subUnitId: editingStaff.subUnitId || undefined,
                      });
                    }
                  }}
                  disabled={!editingStaff?.name || !editingStaff?.email || !editingStaff?.spuId || updateStaffMutation.isPending}
                  data-testid="button-save-edit-staff"
                >
                  {updateStaffMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteStaffDialogOpen} onOpenChange={setDeleteStaffDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Staff Member</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteStaffDialogOpen(false);
                    setStaffToDelete(null);
                  }}
                  data-testid="button-cancel-delete-staff"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (staffToDelete) {
                      deleteStaffMutation.mutate(staffToDelete.id);
                    }
                  }}
                  disabled={deleteStaffMutation.isPending}
                  data-testid="button-confirm-delete-staff"
                >
                  {deleteStaffMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={spuAssignmentsDialogOpen} onOpenChange={(open) => {
            setSpuAssignmentsDialogOpen(open);
            if (!open) {
              setSpuAssignmentsStaff(null);
              setNewAssignmentSpuId("");
              setNewAssignmentSubUnitId("");
            }
          }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>SPU Assignments for {spuAssignmentsStaff?.name}</DialogTitle>
                <DialogDescription>
                  Manage which SPUs/Sub-Units this leader can access and submit OKRs for
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Current Assignments</Label>
                  {staffSpuAssignments && staffSpuAssignments.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {staffSpuAssignments.map((assignment: any) => (
                        <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <span className="text-sm">
                            {getSpuName(assignment.spuId)}
                            {assignment.subUnitId && ` - ${getSubUnitName(assignment.subUnitId)}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSpuAssignmentMutation.mutate(assignment.id)}
                            data-testid={`button-remove-assignment-${assignment.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional SPU assignments</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label>Add New Assignment</Label>
                  <div className="space-y-2 mt-2">
                    <Select value={newAssignmentSpuId} onValueChange={(val) => {
                      setNewAssignmentSpuId(val);
                      setNewAssignmentSubUnitId("");
                    }}>
                      <SelectTrigger data-testid="select-assignment-spu">
                        <SelectValue placeholder="Select SPU" />
                      </SelectTrigger>
                      <SelectContent>
                        {spus?.map((spu) => (
                          <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {newAssignmentSpuId && (
                      <Select value={newAssignmentSubUnitId || "none"} onValueChange={(val) => setNewAssignmentSubUnitId(val === "none" ? "" : val)}>
                        <SelectTrigger data-testid="select-assignment-subunit">
                          <SelectValue placeholder="Select Sub-Unit (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Sub-Unit (SPU Only)</SelectItem>
                          {subUnits?.filter((su) => su.spuId === newAssignmentSpuId).map((subUnit) => (
                            <SelectItem key={subUnit.id} value={subUnit.id}>{subUnit.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <Button
                      onClick={() => {
                        if (spuAssignmentsStaff && newAssignmentSpuId) {
                          addSpuAssignmentMutation.mutate({
                            staffId: spuAssignmentsStaff.id,
                            spuId: newAssignmentSpuId,
                            subUnitId: newAssignmentSubUnitId && newAssignmentSubUnitId !== "none" ? newAssignmentSubUnitId : undefined,
                          });
                        }
                      }}
                      disabled={!newAssignmentSpuId || addSpuAssignmentMutation.isPending}
                      className="w-full"
                      data-testid="button-add-assignment"
                    >
                      {addSpuAssignmentMutation.isPending ? "Adding..." : "Add Assignment"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="spus">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>SPUs & Sub-Units</CardTitle>
                  <CardDescription>Manage university SPUs and their nested sub-units</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setMergeSpuDialogOpen(true)}
                    data-testid="button-merge-spu"
                  >
                    <Merge className="h-4 w-4 mr-2" />
                    Merge SPUs
                  </Button>
                  <Dialog open={spuDialogOpen} onOpenChange={setSpuDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-spu">
                        <Plus className="h-4 w-4 mr-2" />
                        Add SPU
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New SPU</DialogTitle>
                        <DialogDescription>Create a new SPU (School, Department, or Unit)</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="spu-name">SPU Name *</Label>
                          <Input
                            id="spu-name"
                            value={newSpuName}
                            onChange={(e) => setNewSpuName(e.target.value)}
                            placeholder="e.g., Academic Affairs"
                            data-testid="input-spu-name"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => newSpuName && addSpuMutation.mutate(newSpuName)}
                          disabled={!newSpuName || addSpuMutation.isPending}
                          data-testid="button-save-spu"
                        >
                          {addSpuMutation.isPending ? "Adding..." : "Add SPU"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(spusLoading || subUnitsLoading) ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {spus?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No SPUs yet. Add your first SPU above.</p>
                  ) : (
                    spus?.map((spu) => {
                      const spuSubUnits = getSubUnitsForSpu(spu.id);
                      const isExpanded = expandedSpus.has(spu.id);
                      return (
                        <div key={spu.id} data-testid={`row-spu-${spu.id}`}>
                          <div className="flex items-center justify-between gap-2 py-2 px-2 rounded-md hover-elevate">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleSpuExpanded(spu.id)}
                                data-testid={`button-toggle-spu-${spu.id}`}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                              <span className="font-medium truncate">{spu.name}</span>
                              {spuSubUnits.length > 0 && (
                                <Badge variant="secondary" className="no-default-active-elevate">{spuSubUnits.length} sub-unit{spuSubUnits.length !== 1 ? "s" : ""}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setAddSubUnitForSpuId(spu.id);
                                  setNewSubUnitParent(spu.id);
                                  setNewSubUnitName("");
                                  setSubUnitDialogOpen(true);
                                }}
                                title="Add Sub-Unit"
                                data-testid={`button-add-subunit-to-spu-${spu.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingSpu(spu);
                                  setEditSpuDialogOpen(true);
                                }}
                                title="Edit SPU"
                                data-testid={`button-edit-spu-${spu.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setConvertSpuSource(spu);
                                  setConvertSpuTargetId("");
                                  setConvertSpuDialogOpen(true);
                                }}
                                title="Downgrade to Sub-Unit"
                                data-testid={`button-convert-spu-${spu.id}`}
                              >
                                <ArrowDownToLine className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSpuMutation.mutate(spu.id)}
                                title="Delete SPU"
                                data-testid={`button-delete-spu-${spu.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="ml-10 border-l pl-4 space-y-1 mb-2">
                              {spuSubUnits.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No sub-units</p>
                              ) : (
                                spuSubUnits.map((subUnit) => (
                                  <div
                                    key={subUnit.id}
                                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover-elevate"
                                    data-testid={`row-subunit-${subUnit.id}`}
                                  >
                                    <span className="text-sm truncate">{subUnit.name}</span>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setEditingSubUnit(subUnit);
                                          setEditSubUnitDialogOpen(true);
                                        }}
                                        title="Edit Sub-Unit"
                                        data-testid={`button-edit-subunit-${subUnit.id}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setPromoteSubUnit(subUnit);
                                          setPromoteSubUnitIdsToMove([]);
                                          setPromoteSubUnitDialogOpen(true);
                                        }}
                                        title="Promote to SPU"
                                        data-testid={`button-promote-subunit-${subUnit.id}`}
                                      >
                                        <ArrowUpFromLine className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setMoveSubUnit(subUnit);
                                          setMoveSubUnitTargetSpuId("");
                                          setMoveSubUnitDialogOpen(true);
                                        }}
                                        title="Move to another SPU"
                                        data-testid={`button-move-subunit-${subUnit.id}`}
                                      >
                                        <MoveHorizontal className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteSubUnitMutation.mutate(subUnit.id)}
                                        title="Delete Sub-Unit"
                                        data-testid={`button-delete-subunit-${subUnit.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={subUnitDialogOpen} onOpenChange={setSubUnitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Sub-Unit</DialogTitle>
                <DialogDescription>Create a new sub-unit{addSubUnitForSpuId && spus ? ` under ${spus.find(s => s.id === addSubUnitForSpuId)?.name || ""}` : ""}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subunit-name">Sub-Unit Name *</Label>
                  <Input
                    id="subunit-name"
                    value={newSubUnitName}
                    onChange={(e) => setNewSubUnitName(e.target.value)}
                    placeholder="e.g., Undergraduate Studies"
                    data-testid="input-subunit-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subunit-parent">Parent SPU *</Label>
                  <Select value={newSubUnitParent} onValueChange={setNewSubUnitParent}>
                    <SelectTrigger data-testid="select-subunit-parent">
                      <SelectValue placeholder="Select parent SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>
                          {spu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (newSubUnitName && newSubUnitParent) {
                      addSubUnitMutation.mutate({
                        name: newSubUnitName,
                        spuId: newSubUnitParent,
                      });
                    }
                  }}
                  disabled={!newSubUnitName || !newSubUnitParent || addSubUnitMutation.isPending}
                  data-testid="button-save-subunit"
                >
                  {addSubUnitMutation.isPending ? "Adding..." : "Add Sub-Unit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editSpuDialogOpen} onOpenChange={setEditSpuDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit SPU</DialogTitle>
                <DialogDescription>Update the SPU name</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-spu-name">SPU Name *</Label>
                  <Input
                    id="edit-spu-name"
                    value={editingSpu?.name || ""}
                    onChange={(e) => setEditingSpu(editingSpu ? { ...editingSpu, name: e.target.value } : null)}
                    placeholder="e.g., Academic Affairs"
                    data-testid="input-edit-spu-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditSpuDialogOpen(false);
                    setEditingSpu(null);
                  }}
                  data-testid="button-cancel-edit-spu"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingSpu && editingSpu.name) {
                      updateSpuMutation.mutate({ id: editingSpu.id, name: editingSpu.name });
                    }
                  }}
                  disabled={!editingSpu?.name || updateSpuMutation.isPending}
                  data-testid="button-save-edit-spu"
                >
                  {updateSpuMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editSubUnitDialogOpen} onOpenChange={setEditSubUnitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Sub-Unit</DialogTitle>
                <DialogDescription>Update the sub-unit name</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subunit-name">Sub-Unit Name *</Label>
                  <Input
                    id="edit-subunit-name"
                    value={editingSubUnit?.name || ""}
                    onChange={(e) => setEditingSubUnit(editingSubUnit ? { ...editingSubUnit, name: e.target.value } : null)}
                    placeholder="e.g., Undergraduate Studies"
                    data-testid="input-edit-subunit-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditSubUnitDialogOpen(false);
                    setEditingSubUnit(null);
                  }}
                  data-testid="button-cancel-edit-subunit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingSubUnit && editingSubUnit.name && editingSubUnit.spuId) {
                      updateSubUnitMutation.mutate({ 
                        id: editingSubUnit.id, 
                        name: editingSubUnit.name,
                        spuId: editingSubUnit.spuId 
                      });
                    }
                  }}
                  disabled={!editingSubUnit?.name || updateSubUnitMutation.isPending}
                  data-testid="button-save-edit-subunit"
                >
                  {updateSubUnitMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={mergeSpuDialogOpen} onOpenChange={setMergeSpuDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Merge SPUs</DialogTitle>
                <DialogDescription>
                  Combine two SPUs into one. All staff, OKRs, sub-units, and assignments from the source will be moved to the target. The source SPU will be deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Source SPU (will be deleted)</Label>
                  <Select value={mergeSpuSourceId} onValueChange={setMergeSpuSourceId}>
                    <SelectTrigger data-testid="select-merge-spu-source">
                      <SelectValue placeholder="Select source SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.filter(s => s.id !== mergeSpuTargetId).map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target SPU (will receive everything)</Label>
                  <Select value={mergeSpuTargetId} onValueChange={setMergeSpuTargetId}>
                    <SelectTrigger data-testid="select-merge-spu-target">
                      <SelectValue placeholder="Select target SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.filter(s => s.id !== mergeSpuSourceId).map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {mergeSpuSourceId && mergeSpuTargetId && (
                  <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/50">
                    <p className="font-medium">Preview:</p>
                    <p>Staff in "{spus?.find(s => s.id === mergeSpuSourceId)?.name}" will be moved to "{spus?.find(s => s.id === mergeSpuTargetId)?.name}"</p>
                    <p>All OKRs, sub-units, and SPU assignments will be transferred</p>
                    <p className="text-destructive font-medium">"{spus?.find(s => s.id === mergeSpuSourceId)?.name}" will be permanently deleted</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setMergeSpuDialogOpen(false); setMergeSpuSourceId(""); setMergeSpuTargetId(""); }} data-testid="button-cancel-merge-spu">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => mergeSpuMutation.mutate({ sourceId: mergeSpuSourceId, targetId: mergeSpuTargetId })}
                  disabled={!mergeSpuSourceId || !mergeSpuTargetId || mergeSpuMutation.isPending}
                  data-testid="button-confirm-merge-spu"
                >
                  {mergeSpuMutation.isPending ? "Merging..." : "Merge SPUs"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={convertSpuDialogOpen} onOpenChange={setConvertSpuDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Downgrade SPU to Sub-Unit</DialogTitle>
                <DialogDescription>
                  Demote "{convertSpuSource?.name}" into a sub-unit under another SPU. All its child sub-units will join the new parent SPU.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Target Parent SPU</Label>
                  <Select value={convertSpuTargetId} onValueChange={setConvertSpuTargetId}>
                    <SelectTrigger data-testid="select-convert-spu-target">
                      <SelectValue placeholder="Select parent SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.filter(s => s.id !== convertSpuSource?.id).map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {convertSpuSource && convertSpuTargetId && (
                  <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/50">
                    <p className="font-medium">What will happen:</p>
                    <p>All staff and OKRs under "{convertSpuSource.name}" will be reassigned to "{spus?.find(s => s.id === convertSpuTargetId)?.name}"</p>
                    <p>Existing child sub-units of "{convertSpuSource.name}" will become sub-units of "{spus?.find(s => s.id === convertSpuTargetId)?.name}"</p>
                    <p>A new sub-unit named "{convertSpuSource.name}" will be created under "{spus?.find(s => s.id === convertSpuTargetId)?.name}"</p>
                    <p className="text-destructive font-medium">The SPU "{convertSpuSource.name}" will be permanently deleted</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setConvertSpuDialogOpen(false); setConvertSpuSource(null); setConvertSpuTargetId(""); }} data-testid="button-cancel-convert-spu">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => convertSpuSource && convertSpuToSubUnitMutation.mutate({ sourceId: convertSpuSource.id, targetSpuId: convertSpuTargetId })}
                  disabled={!convertSpuSource || !convertSpuTargetId || convertSpuToSubUnitMutation.isPending}
                  data-testid="button-confirm-convert-spu"
                >
                  {convertSpuToSubUnitMutation.isPending ? "Converting..." : "Downgrade to Sub-Unit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={promoteSubUnitDialogOpen} onOpenChange={setPromoteSubUnitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Promote Sub-Unit to SPU</DialogTitle>
                <DialogDescription>
                  Promote "{promoteSubUnit?.name}" to a full, standalone SPU.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {promoteSubUnit && (
                  <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/50">
                    <p className="font-medium">What will happen:</p>
                    <p>A new SPU named "{promoteSubUnit.name}" will be created</p>
                    <p>All staff and OKRs assigned to this sub-unit will be moved to the new SPU</p>
                    <p className="text-destructive font-medium">The sub-unit "{promoteSubUnit.name}" will be deleted</p>
                  </div>
                )}
                {promoteSubUnit && subUnits && subUnits.filter(su => su.id !== promoteSubUnit.id && su.spuId === promoteSubUnit.spuId).length > 0 && (
                  <div className="space-y-2">
                    <Label>Optionally move sibling sub-units under the new SPU:</Label>
                    <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-3">
                      {subUnits.filter(su => su.id !== promoteSubUnit.id && su.spuId === promoteSubUnit.spuId).map((su) => (
                        <div key={su.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`promote-move-${su.id}`}
                            checked={promoteSubUnitIdsToMove.includes(su.id)}
                            onCheckedChange={(checked) => {
                              setPromoteSubUnitIdsToMove(prev =>
                                checked ? [...prev, su.id] : prev.filter(id => id !== su.id)
                              );
                            }}
                            data-testid={`checkbox-promote-move-${su.id}`}
                          />
                          <label htmlFor={`promote-move-${su.id}`} className="text-sm cursor-pointer">
                            {su.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPromoteSubUnitDialogOpen(false); setPromoteSubUnit(null); setPromoteSubUnitIdsToMove([]); }} data-testid="button-cancel-promote-subunit">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => promoteSubUnit && promoteSubUnitToSpuMutation.mutate({ subUnitId: promoteSubUnit.id, subUnitIdsToMove: promoteSubUnitIdsToMove })}
                  disabled={!promoteSubUnit || promoteSubUnitToSpuMutation.isPending}
                  data-testid="button-confirm-promote-subunit"
                >
                  {promoteSubUnitToSpuMutation.isPending ? "Promoting..." : "Promote to SPU"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={moveSubUnitDialogOpen} onOpenChange={setMoveSubUnitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Move Sub-Unit</DialogTitle>
                <DialogDescription>
                  Move "{moveSubUnit?.name}" to a different SPU. All associated staff and OKRs will be reassigned.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Target SPU</Label>
                  <Select value={moveSubUnitTargetSpuId} onValueChange={setMoveSubUnitTargetSpuId}>
                    <SelectTrigger data-testid="select-move-subunit-target">
                      <SelectValue placeholder="Select target SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {spus?.filter(s => s.id !== moveSubUnit?.spuId).map((spu) => (
                        <SelectItem key={spu.id} value={spu.id}>{spu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {moveSubUnit && moveSubUnitTargetSpuId && (
                  <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/50">
                    <p className="font-medium">What will happen:</p>
                    <p>"{moveSubUnit.name}" will move from "{getSpuName(moveSubUnit.spuId)}" to "{spus?.find(s => s.id === moveSubUnitTargetSpuId)?.name}"</p>
                    <p>All staff and OKRs in this sub-unit will be reassigned to the new SPU</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setMoveSubUnitDialogOpen(false); setMoveSubUnit(null); setMoveSubUnitTargetSpuId(""); }} data-testid="button-cancel-move-subunit">
                  Cancel
                </Button>
                <Button
                  onClick={() => moveSubUnit && moveSubUnitMutation.mutate({ subUnitId: moveSubUnit.id, targetSpuId: moveSubUnitTargetSpuId })}
                  disabled={!moveSubUnit || !moveSubUnitTargetSpuId || moveSubUnitMutation.isPending}
                  data-testid="button-confirm-move-subunit"
                >
                  {moveSubUnitMutation.isPending ? "Moving..." : "Move Sub-Unit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="years">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Years</CardTitle>
                  <CardDescription>Manage available years for OKR submission</CardDescription>
                </div>
                <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-year">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Year
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Year</DialogTitle>
                      <DialogDescription>
                        Add a year that will be available for OKR submission
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year *</Label>
                      <Input
                        id="year"
                        type="number"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        placeholder="e.g., 2025"
                        data-testid="input-year"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setYearDialogOpen(false);
                          setNewYear("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (newYear) {
                            addYearMutation.mutate(Number(newYear));
                          }
                        }}
                        disabled={!newYear || addYearMutation.isPending}
                        data-testid="button-save-year"
                      >
                        {addYearMutation.isPending ? "Adding..." : "Add Year"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {yearsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {years && years.length > 0 ? (
                      years.sort((a, b) => b.year - a.year).map((year) => (
                        <TableRow key={year.id}>
                          <TableCell className="font-medium">{year.year}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteYearMutation.mutate(year.id)}
                              disabled={deleteYearMutation.isPending}
                              data-testid={`button-delete-year-${year.year}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No years added yet. Click "Add Year" to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {staff.role === "super_admin" && (
          <TabsContent value="strategic">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      University Strategic Planning
                    </CardTitle>
                    <CardDescription>Manage University Level Strategic Objectives and their Key Results</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={krDialogOpen} onOpenChange={setKrDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="button-add-key-result-strategic">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Key Result
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add University Key Result</DialogTitle>
                          <DialogDescription>Add a new key result under an existing objective</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Parent Objective *</Label>
                            <Select value={krParentObjId} onValueChange={setKrParentObjId}>
                              <SelectTrigger data-testid="select-kr-parent-objective">
                                <SelectValue placeholder="Select parent objective" />
                              </SelectTrigger>
                              <SelectContent>
                                {universityObjectives?.map((obj) => (
                                  <SelectItem key={obj.id} value={obj.id}>
                                    {obj.label}: {obj.description.substring(0, 60)}...
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Label *</Label>
                            <Input
                              value={newKrLabel}
                              onChange={(e) => setNewKrLabel(e.target.value)}
                              placeholder="e.g., KR 1.E"
                              data-testid="input-kr-label"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description *</Label>
                            <Textarea
                              value={newKrDescription}
                              onChange={(e) => setNewKrDescription(e.target.value)}
                              placeholder="Describe the key result..."
                              className="min-h-20 resize-none"
                              data-testid="input-kr-description"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (krParentObjId && newKrLabel && newKrDescription) {
                                const parentObj = universityObjectives?.find(o => o.id === krParentObjId);
                                const sortOrder = parentObj ? parentObj.keyResults.length + 1 : 1;
                                addKeyResultMutation.mutate({
                                  objectiveId: krParentObjId,
                                  label: newKrLabel,
                                  description: newKrDescription,
                                  sortOrder,
                                });
                              }
                            }}
                            disabled={!krParentObjId || !newKrLabel || !newKrDescription || addKeyResultMutation.isPending}
                            data-testid="button-save-kr"
                          >
                            {addKeyResultMutation.isPending ? "Adding..." : "Add Key Result"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={objDialogOpen} onOpenChange={setObjDialogOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-objective">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Objective
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add University Objective</DialogTitle>
                          <DialogDescription>Add a new University Level Strategic Objective</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Label *</Label>
                            <Input
                              value={newObjLabel}
                              onChange={(e) => setNewObjLabel(e.target.value)}
                              placeholder="e.g., Objective 4"
                              data-testid="input-obj-label"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description *</Label>
                            <Textarea
                              value={newObjDescription}
                              onChange={(e) => setNewObjDescription(e.target.value)}
                              placeholder="Describe the objective..."
                              className="min-h-20 resize-none"
                              data-testid="input-obj-description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Applicable Years</Label>
                            <div className="flex flex-wrap gap-2">
                              {years && years.sort((a, b) => b.year - a.year).map((yr) => (
                                <label key={yr.id} className="flex items-center gap-1.5 cursor-pointer">
                                  <Checkbox
                                    checked={newObjYears.includes(yr.year)}
                                    onCheckedChange={(checked) => {
                                      setNewObjYears(checked
                                        ? [...newObjYears, yr.year]
                                        : newObjYears.filter(y => y !== yr.year)
                                      );
                                    }}
                                    data-testid={`checkbox-new-obj-year-${yr.year}`}
                                  />
                                  <span className="text-sm">{yr.year}</span>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Select which years this objective applies to</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (newObjLabel && newObjDescription) {
                                const sortOrder = universityObjectives ? universityObjectives.length + 1 : 1;
                                addObjectiveMutation.mutate({
                                  label: newObjLabel,
                                  description: newObjDescription,
                                  sortOrder,
                                  applicableYears: newObjYears,
                                });
                              }
                            }}
                            disabled={!newObjLabel || !newObjDescription || addObjectiveMutation.isPending}
                            data-testid="button-save-objective"
                          >
                            {addObjectiveMutation.isPending ? "Adding..." : "Add Objective"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {objectivesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !universityObjectives || universityObjectives.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No university objectives yet.</p>
                    <p className="text-sm">Click "Add Objective" to create the first strategic objective.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {universityObjectives.map((obj) => (
                      <div key={obj.id} className="rounded-md border" data-testid={`strategic-objective-${obj.id}`}>
                        <div
                          className="flex items-start gap-3 p-4 cursor-pointer hover-elevate rounded-t-md"
                          onClick={() => toggleObjectiveExpanded(obj.id)}
                          data-testid={`toggle-objective-${obj.id}`}
                        >
                          <div className="mt-0.5 shrink-0 text-muted-foreground">
                            {expandedObjectives.has(obj.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="default" data-testid={`badge-objective-${obj.id}`}>{obj.label}</Badge>
                              {obj.isActive === false && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-inactive-${obj.id}`}>Inactive</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{obj.keyResults.length} key result(s)</span>
                              {obj.applicableYears && obj.applicableYears.length > 0 && (
                                obj.applicableYears.sort((a, b) => a - b).map((yr) => (
                                  <Badge key={yr} variant="outline" className="text-xs" data-testid={`badge-obj-year-${obj.id}-${yr}`}>{yr}</Badge>
                                ))
                              )}
                            </div>
                            <p className="text-sm mt-1 text-muted-foreground">{obj.description}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingObj({ id: obj.id, label: obj.label, description: obj.description, applicableYears: obj.applicableYears || [], isActive: obj.isActive !== false });
                                setEditObjDialogOpen(true);
                              }}
                              data-testid={`button-edit-objective-${obj.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteObjectiveMutation.mutate(obj.id)}
                              disabled={deleteObjectiveMutation.isPending}
                              data-testid={`button-delete-objective-${obj.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {expandedObjectives.has(obj.id) && (
                          <div className="border-t px-4 py-2 space-y-1 bg-muted/30">
                            {obj.keyResults.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2 pl-7">No key results yet. Use "Add Key Result" to add one under this objective.</p>
                            ) : (
                              obj.keyResults.map((kr) => (
                                <div
                                  key={kr.id}
                                  className="flex items-start gap-3 py-2 pl-7"
                                  data-testid={`strategic-kr-${kr.id}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs" data-testid={`badge-kr-${kr.id}`}>{kr.label}</Badge>
                                    </div>
                                    <p className="text-sm mt-1 text-muted-foreground">{kr.description}</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingKr({ id: kr.id, label: kr.label, description: kr.description });
                                        setEditKrDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-kr-${kr.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteKeyResultMutation.mutate(kr.id)}
                                      disabled={deleteKeyResultMutation.isPending}
                                      data-testid={`button-delete-kr-${kr.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={editObjDialogOpen} onOpenChange={setEditObjDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit University Objective</DialogTitle>
                  <DialogDescription>Update the objective label and description</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Label *</Label>
                    <Input
                      value={editingObj?.label || ""}
                      onChange={(e) => setEditingObj(editingObj ? { ...editingObj, label: e.target.value } : null)}
                      data-testid="input-edit-obj-label"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea
                      value={editingObj?.description || ""}
                      onChange={(e) => setEditingObj(editingObj ? { ...editingObj, description: e.target.value } : null)}
                      className="min-h-20 resize-none"
                      data-testid="input-edit-obj-description"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 border rounded-md">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Active</Label>
                      <p className="text-xs text-muted-foreground">
                        {editingObj?.isActive !== false
                          ? "This objective is available for OKR submissions."
                          : "This objective is hidden from OKR submissions."}
                      </p>
                    </div>
                    <Switch
                      checked={editingObj?.isActive !== false}
                      onCheckedChange={(checked) => {
                        if (editingObj) {
                          setEditingObj({ ...editingObj, isActive: checked });
                        }
                      }}
                      data-testid="switch-edit-obj-active"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (editingObj && editingObj.label && editingObj.description) {
                        updateObjectiveMutation.mutate(editingObj);
                      }
                    }}
                    disabled={!editingObj?.label || !editingObj?.description || updateObjectiveMutation.isPending}
                    data-testid="button-save-edit-objective"
                  >
                    {updateObjectiveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={editKrDialogOpen} onOpenChange={setEditKrDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit University Key Result</DialogTitle>
                  <DialogDescription>Update the key result label and description</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Label *</Label>
                    <Input
                      value={editingKr?.label || ""}
                      onChange={(e) => setEditingKr(editingKr ? { ...editingKr, label: e.target.value } : null)}
                      data-testid="input-edit-kr-label"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea
                      value={editingKr?.description || ""}
                      onChange={(e) => setEditingKr(editingKr ? { ...editingKr, description: e.target.value } : null)}
                      className="min-h-20 resize-none"
                      data-testid="input-edit-kr-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (editingKr && editingKr.label && editingKr.description) {
                        updateKeyResultMutation.mutate(editingKr);
                      }
                    }}
                    disabled={!editingKr?.label || !editingKr?.description || updateKeyResultMutation.isPending}
                    data-testid="button-save-edit-kr"
                  >
                    {updateKeyResultMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Strategic Advancement Dashboard */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Strategic Advancement Dashboard
                    </CardTitle>
                    <CardDescription>Set progress percentages and comments for each objective and key result</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => updateAdvancementDateMutation.mutate()}
                    disabled={updateAdvancementDateMutation.isPending}
                    data-testid="button-update-advancement-date"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${updateAdvancementDateMutation.isPending ? "animate-spin" : ""}`} />
                    Update Last Updated Date
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {advancementLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (advancementData?.objectives ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active objectives found. Add objectives in the University Strategic Planning section above.
                  </p>
                ) : (
                  <div className="space-y-8">
                    {(advancementData?.objectives ?? []).map((obj) => (
                      <div key={obj.id} className="space-y-4" data-testid={`adv-objective-${obj.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs shrink-0">{obj.label}</Badge>
                          <span className="text-sm font-semibold">{obj.description}</span>
                        </div>

                        {obj.keyResults.length > 0 && (
                          <div className="space-y-4 pl-4 border-l-2 border-muted">
                            {obj.keyResults.map((kr) => {
                              const pct = localProgress[kr.id] ?? 0;
                              return (
                                <div key={kr.id} className="space-y-2" data-testid={`adv-kr-${kr.id}`}>
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-sm">
                                      <span className="font-mono text-muted-foreground mr-1">{kr.label}</span>
                                      {kr.description}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Slider
                                      value={[pct]}
                                      min={0}
                                      max={100}
                                      step={1}
                                      className="flex-1"
                                      onValueChange={([val]) => setLocalProgress((prev) => ({ ...prev, [kr.id]: val }))}
                                      onValueCommit={([val]) => saveProgressMutation.mutate({ keyResultId: kr.id, progressPercent: val })}
                                      data-testid={`slider-kr-${kr.id}`}
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={pct}
                                      onChange={(e) => {
                                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                        setLocalProgress((prev) => ({ ...prev, [kr.id]: val }));
                                      }}
                                      onBlur={() => saveProgressMutation.mutate({ keyResultId: kr.id, progressPercent: pct })}
                                      className="w-20 text-center"
                                      data-testid={`input-kr-percent-${kr.id}`}
                                    />
                                    <span className="text-sm text-muted-foreground w-4">%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Progress Comment</Label>
                          <Textarea
                            placeholder="Add a comment about the progress of this objective..."
                            value={localComments[obj.id] ?? ""}
                            onChange={(e) => setLocalComments((prev) => ({ ...prev, [obj.id]: e.target.value }))}
                            onBlur={() => {
                              const comment = localComments[obj.id] ?? "";
                              if (comment !== (obj.comment ?? "")) {
                                saveCommentMutation.mutate({ objectiveId: obj.id, comment });
                              }
                            }}
                            className="min-h-20 resize-none text-sm"
                            data-testid={`textarea-objective-comment-${obj.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {staff.role === "super_admin" && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  System Settings
                </CardTitle>
                <CardDescription>Configure system-wide settings for the OKR Tracking System</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4 p-4 border rounded-md">
                  <div className="space-y-1">
                    <Label className="text-base font-medium" data-testid="text-password-login-label">Password Login</Label>
                    <p className="text-sm text-muted-foreground">
                      {passwordLoginSetting?.enabled !== false
                        ? "Users must enter a password (admin or staff) to access the system."
                        : "Password login is off. Users choose between Admin or Staff access without a password."}
                    </p>
                  </div>
                  <Switch
                    checked={passwordLoginSetting?.enabled !== false}
                    onCheckedChange={(checked) => togglePasswordLoginMutation.mutate(checked)}
                    disabled={togglePasswordLoginMutation.isPending}
                    data-testid="switch-password-login"
                  />
                </div>

                <div className="p-4 border rounded-md space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">OneLogin SSO</Label>
                      <p className="text-sm text-muted-foreground">
                        {ssoSetting?.enabled
                          ? "SSO is enabled. Staff sign in via OneLogin and are matched by email address."
                          : "SSO is disabled. Enable and configure to allow staff to sign in with OneLogin."}
                      </p>
                    </div>
                    <Switch
                      checked={ssoSetting?.enabled === true}
                      onCheckedChange={(checked) =>
                        updateSsoMutation.mutate({
                          enabled: checked,
                          issuerUrl: ssoSetting?.issuerUrl,
                          clientId: ssoSetting?.clientId,
                        })
                      }
                      disabled={updateSsoMutation.isPending}
                      data-testid="switch-sso-enabled"
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      OIDC configuration — values can also be set via environment variables{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">SSO_ISSUER_URL</code>,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">SSO_CLIENT_ID</code>,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">SSO_CLIENT_SECRET</code>.
                    </p>
                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="sso-issuer" className="text-sm">Issuer URL</Label>
                        <Input
                          id="sso-issuer"
                          placeholder={ssoSetting?.issuerUrl || "https://yourorg.onelogin.com/oidc/2"}
                          value={ssoIssuerUrl}
                          onChange={(e) => setSsoIssuerUrl(e.target.value)}
                          data-testid="input-sso-issuer-url"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sso-client-id" className="text-sm">Client ID</Label>
                        <Input
                          id="sso-client-id"
                          placeholder={ssoSetting?.clientId || "your-client-id"}
                          value={ssoClientId}
                          onChange={(e) => setSsoClientId(e.target.value)}
                          data-testid="input-sso-client-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sso-client-secret" className="text-sm">
                          Client Secret{ssoSetting?.hasClientSecret ? " (already set — leave blank to keep)" : ""}
                        </Label>
                        <Input
                          id="sso-client-secret"
                          type="password"
                          placeholder={ssoSetting?.hasClientSecret ? "••••••••••••" : "your-client-secret"}
                          value={ssoClientSecret}
                          onChange={(e) => setSsoClientSecret(e.target.value)}
                          data-testid="input-sso-client-secret"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={updateSsoMutation.isPending || (!ssoIssuerUrl && !ssoClientId && !ssoClientSecret)}
                      onClick={() =>
                        updateSsoMutation.mutate({
                          enabled: ssoSetting?.enabled === true,
                          ...(ssoIssuerUrl && { issuerUrl: ssoIssuerUrl }),
                          ...(ssoClientId && { clientId: ssoClientId }),
                          ...(ssoClientSecret && { clientSecret: ssoClientSecret }),
                        })
                      }
                      data-testid="button-save-sso"
                    >
                      {updateSsoMutation.isPending ? "Saving..." : "Save SSO Configuration"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Callback URL to register in OneLogin:{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">{window.location.origin}/api/auth/sso/callback</code>
                    </p>
                  </div>
                </div>

                <div className="p-4 border rounded-md space-y-3">
                  <div className="space-y-1">
                    <Label className="text-base font-medium" data-testid="text-strategic-plan-label">Strategic Plan Start Year</Label>
                    <p className="text-sm text-muted-foreground">
                      The calendar year when Year 1 of the strategic plan begins. This affects how planning years (Year 1-4) are calculated from calendar quarters.
                      Currently set to <span className="font-semibold">{planStartYear}</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={2020}
                      max={2040}
                      value={editingStartYear || planStartYear}
                      onChange={(e) => setEditingStartYear(e.target.value)}
                      className="w-32"
                      data-testid="input-strategic-plan-start-year"
                    />
                    <Button
                      variant="outline"
                      disabled={updateStartYearMutation.isPending || !editingStartYear || parseInt(editingStartYear) === planStartYear}
                      onClick={() => {
                        const year = parseInt(editingStartYear);
                        if (year >= 2020 && year <= 2040) {
                          updateStartYearMutation.mutate(year);
                        }
                      }}
                      data-testid="button-save-start-year"
                    >
                      {updateStartYearMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: If start year is {planStartYear}, then Q3 {planStartYear} = Year 1 Q3, Q1 {planStartYear + 1} = Year 2 Q1.
                  </p>
                </div>

                {staff.role === "super_admin" && (
                  <div className="p-4 border border-destructive/40 rounded-md space-y-3 bg-destructive/5">
                    <div className="space-y-1">
                      <Label className="text-base font-medium text-destructive flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4" /> System Reset
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Permanently deletes all organizational data: staff, SPUs, sub-units, OKRs, quarterly updates,
                        and university objectives. This resets the system to its initial state and cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setResetDialogOpen(true)}
                      data-testid="button-system-reset"
                    >
                      <TriangleAlert className="h-4 w-4 mr-1.5" /> Reset System
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* First reset confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" /> Are you sure you want to reset?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all staff, SPUs, sub-units, OKRs, quarterly updates, and university objectives.
              System settings (passwords, SSO, strategic plan year) will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setResetDialogOpen(false); setResetConfirmDialogOpen(true); }}
              data-testid="button-reset-continue"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second (final) reset confirmation */}
      <AlertDialog open={resetConfirmDialogOpen} onOpenChange={setResetConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" /> This cannot be undone. Proceed?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently erase ALL organizational data from the system.
              There is no recovery option. The system will restart in setup mode after the reset completes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setResetConfirmDialogOpen(false); resetMutation.mutate(); }}
              disabled={resetMutation.isPending}
              data-testid="button-reset-confirm-final"
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Yes, Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
