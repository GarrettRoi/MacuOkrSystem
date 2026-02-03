import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Settings, Pencil, Merge } from "lucide-react";
import type { Staff, Spu, SubUnit, Year } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { compareNames } from "@/lib/utils";

export default function Admin() {
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
  
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffSpu, setNewStaffSpu] = useState("");
  const [newStaffSubUnit, setNewStaffSubUnit] = useState("");
  const [newYear, setNewYear] = useState("");
  
  const [editingSpu, setEditingSpu] = useState<Spu | null>(null);
  const [editingSubUnit, setEditingSubUnit] = useState<SubUnit | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  const { data: spus, isLoading: spusLoading } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: subUnits, isLoading: subUnitsLoading } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: staff, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: years, isLoading: yearsLoading } = useQuery<Year[]>({
    queryKey: ["/api/years"],
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
    mutationFn: async (data: { name: string; email: string; spuId: string; subUnitId?: string }) => {
      return await apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
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
      toast({ title: "Staff Member Deleted", description: "The staff member has been removed." });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; email?: string; spuId?: string; subUnitId?: string }) => {
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
          <TabsTrigger value="staff" data-testid="tab-staff">Staff Management</TabsTrigger>
          <TabsTrigger value="spus" data-testid="tab-spus">SPUs</TabsTrigger>
          <TabsTrigger value="subunits" data-testid="tab-subunits">Sub-Units</TabsTrigger>
          <TabsTrigger value="years" data-testid="tab-years">Years</TabsTrigger>
        </TabsList>

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
                              {staff?.slice().sort((a, b) => compareNames(a.name, b.name)).map((s) => (
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
                              {staff?.slice().sort((a, b) => compareNames(a.name, b.name)).map((s) => (
                                <SelectItem key={s.id} value={s.id} disabled={s.id === mergeSourceId}>
                                  {s.name} ({s.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {mergeSourceId && mergeTargetId && (
                          <div className="p-3 bg-muted rounded-md text-sm">
                            <strong>Preview:</strong> All OKRs, quarterly updates, and responsibilities from "{staff?.find(s => s.id === mergeSourceId)?.name}" will be transferred to "{staff?.find(s => s.id === mergeTargetId)?.name}". The source account will be permanently deleted.
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
                              name: newStaffName,
                              email: newStaffEmail,
                              spuId: newStaffSpu,
                              subUnitId: newStaffSubUnit || undefined,
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
              {staffLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Primary SPU</TableHead>
                      <TableHead>Sub-Unit</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No staff members yet. Add your first staff member above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      staff?.slice().sort((a, b) => compareNames(a.name, b.name)).map((member) => (
                        <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>{getSpuName(member.spuId)}</TableCell>
                          <TableCell>{getSubUnitName(member.subUnitId)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteStaffMutation.mutate(member.id)}
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
                        name: editingStaff.name,
                        email: editingStaff.email,
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
        </TabsContent>

        <TabsContent value="spus">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SPUs (Schools, Departments, Units)</CardTitle>
                  <CardDescription>Manage university SPUs</CardDescription>
                </div>
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
            </CardHeader>
            <CardContent>
              {spusLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SPU Name</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spus?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No SPUs yet. Add your first SPU above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      spus?.map((spu) => (
                        <TableRow key={spu.id} data-testid={`row-spu-${spu.id}`}>
                          <TableCell className="font-medium">{spu.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingSpu(spu);
                                  setEditSpuDialogOpen(true);
                                }}
                                data-testid={`button-edit-spu-${spu.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSpuMutation.mutate(spu.id)}
                                data-testid={`button-delete-spu-${spu.id}`}
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
        </TabsContent>

        <TabsContent value="subunits">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sub-Units</CardTitle>
                  <CardDescription>Manage sub-units or divisions within each SPU</CardDescription>
                </div>
                <Dialog open={subUnitDialogOpen} onOpenChange={setSubUnitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-subunit">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Sub-Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Sub-Unit</DialogTitle>
                      <DialogDescription>Create a new sub-unit or division</DialogDescription>
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
              </div>
            </CardHeader>
            <CardContent>
              {subUnitsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-Unit Name</TableHead>
                      <TableHead>Parent SPU</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subUnits?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No sub-units yet. Add your first sub-unit above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      subUnits?.map((subUnit) => (
                        <TableRow key={subUnit.id} data-testid={`row-subunit-${subUnit.id}`}>
                          <TableCell className="font-medium">{subUnit.name}</TableCell>
                          <TableCell>{getSpuName(subUnit.spuId)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingSubUnit(subUnit);
                                  setEditSubUnitDialogOpen(true);
                                }}
                                data-testid={`button-edit-subunit-${subUnit.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSubUnitMutation.mutate(subUnit.id)}
                                data-testid={`button-delete-subunit-${subUnit.id}`}
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
          
          <Dialog open={editSubUnitDialogOpen} onOpenChange={setEditSubUnitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Sub-Unit</DialogTitle>
                <DialogDescription>Update the sub-unit name and parent SPU</DialogDescription>
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
                <div className="space-y-2">
                  <Label htmlFor="edit-subunit-parent">Parent SPU *</Label>
                  <Select 
                    value={editingSubUnit?.spuId || ""} 
                    onValueChange={(value) => setEditingSubUnit(editingSubUnit ? { ...editingSubUnit, spuId: value } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-subunit-parent">
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
                  disabled={!editingSubUnit?.name || !editingSubUnit?.spuId || updateSubUnitMutation.isPending}
                  data-testid="button-save-edit-subunit"
                >
                  {updateSubUnitMutation.isPending ? "Saving..." : "Save Changes"}
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
      </Tabs>
    </div>
  );
}
