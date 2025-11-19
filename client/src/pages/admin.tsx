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
import { Plus, Trash2, Settings, Pencil } from "lucide-react";
import type { Staff, Department, SubDepartment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Admin() {
  const { toast } = useToast();
  
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [subDeptDialogOpen, setSubDeptDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  
  const [editDeptDialogOpen, setEditDeptDialogOpen] = useState(false);
  const [editSubDeptDialogOpen, setEditSubDeptDialogOpen] = useState(false);
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  
  const [newDeptName, setNewDeptName] = useState("");
  const [newSubDeptName, setNewSubDeptName] = useState("");
  const [newSubDeptParent, setNewSubDeptParent] = useState("");
  
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffDept, setNewStaffDept] = useState("");
  const [newStaffSubDept, setNewStaffSubDept] = useState("");
  
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingSubDept, setEditingSubDept] = useState<SubDepartment | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const { data: departments, isLoading: depsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: subDepartments, isLoading: subDepsLoading } = useQuery<SubDepartment[]>({
    queryKey: ["/api/sub-departments"],
  });

  const { data: staff, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const addDeptMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/departments", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeptDialogOpen(false);
      setNewDeptName("");
      toast({ title: "Department Added", description: "The department has been created successfully." });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/departments/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department Deleted", description: "The department has been removed." });
    },
  });

  const addSubDeptMutation = useMutation({
    mutationFn: async (data: { name: string; departmentId: string }) => {
      return await apiRequest("POST", "/api/sub-departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-departments"] });
      setSubDeptDialogOpen(false);
      setNewSubDeptName("");
      setNewSubDeptParent("");
      toast({ title: "Sub-Department Added", description: "The sub-department has been created successfully." });
    },
  });

  const deleteSubDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sub-departments/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-departments"] });
      toast({ title: "Sub-Department Deleted", description: "The sub-department has been removed." });
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; departmentId: string; subDepartmentId?: string }) => {
      return await apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setStaffDialogOpen(false);
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffDept("");
      setNewStaffSubDept("");
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
    mutationFn: async (data: { id: string; name?: string; email?: string; departmentId?: string; subDepartmentId?: string }) => {
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

  const updateDeptMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/departments/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditDeptDialogOpen(false);
      setEditingDept(null);
      toast({ title: "Department Updated", description: "The department has been updated successfully." });
    },
  });

  const updateSubDeptMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; departmentId?: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/sub-departments/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-departments"] });
      setEditSubDeptDialogOpen(false);
      setEditingSubDept(null);
      toast({ title: "Sub-Department Updated", description: "The sub-department has been updated successfully." });
    },
  });

  const getDepartmentName = (deptId: string) => {
    return departments?.find((d) => d.id === deptId)?.name || "Unknown";
  };

  const getSubDepartmentName = (subDeptId: string | null) => {
    if (!subDeptId) return "—";
    return subDepartments?.find((sd) => sd.id === subDeptId)?.name || "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage staff, departments, and system settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff Management</TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="subdepartments" data-testid="tab-subdepartments">Sub-Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Staff Members</CardTitle>
                  <CardDescription>Manage university staff and their department assignments</CardDescription>
                </div>
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
                        <Label htmlFor="staff-dept">Department *</Label>
                        <Select value={newStaffDept} onValueChange={setNewStaffDept}>
                          <SelectTrigger data-testid="select-staff-dept">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="staff-subdept">Sub-Department (Optional)</Label>
                        <Select value={newStaffSubDept} onValueChange={setNewStaffSubDept}>
                          <SelectTrigger data-testid="select-staff-subdept">
                            <SelectValue placeholder="None (Optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {subDepartments?.filter((sd) => sd.departmentId === newStaffDept).map((subDept) => (
                              <SelectItem key={subDept.id} value={subDept.id}>
                                {subDept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (newStaffName && newStaffEmail && newStaffDept) {
                            addStaffMutation.mutate({
                              name: newStaffName,
                              email: newStaffEmail,
                              departmentId: newStaffDept,
                              subDepartmentId: newStaffSubDept || undefined,
                            });
                          }
                        }}
                        disabled={!newStaffName || !newStaffEmail || !newStaffDept || addStaffMutation.isPending}
                        data-testid="button-save-staff"
                      >
                        {addStaffMutation.isPending ? "Adding..." : "Add Staff"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                      <TableHead>Department</TableHead>
                      <TableHead>Sub-Department</TableHead>
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
                      staff?.map((member) => (
                        <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>{getDepartmentName(member.departmentId)}</TableCell>
                          <TableCell>{getSubDepartmentName(member.subDepartmentId)}</TableCell>
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
                <DialogDescription>Update staff member details and department assignments</DialogDescription>
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
                  <Label htmlFor="edit-staff-dept">Department *</Label>
                  <Select 
                    value={editingStaff?.departmentId || ""} 
                    onValueChange={(value) => setEditingStaff(editingStaff ? { ...editingStaff, departmentId: value } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-staff-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staff-subdept">Sub-Department (Optional)</Label>
                  <Select 
                    value={editingStaff?.subDepartmentId || ""} 
                    onValueChange={(value) => setEditingStaff(editingStaff ? { ...editingStaff, subDepartmentId: value || null } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-staff-subdept">
                      <SelectValue placeholder="None (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subDepartments?.filter((sd) => sd.departmentId === editingStaff?.departmentId).map((subDept) => (
                        <SelectItem key={subDept.id} value={subDept.id}>
                          {subDept.name}
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
                    if (editingStaff && editingStaff.name && editingStaff.email && editingStaff.departmentId) {
                      updateStaffMutation.mutate({
                        id: editingStaff.id,
                        name: editingStaff.name,
                        email: editingStaff.email,
                        departmentId: editingStaff.departmentId,
                        subDepartmentId: editingStaff.subDepartmentId || undefined,
                      });
                    }
                  }}
                  disabled={!editingStaff?.name || !editingStaff?.email || !editingStaff?.departmentId || updateStaffMutation.isPending}
                  data-testid="button-save-edit-staff"
                >
                  {updateStaffMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Manage university departments</CardDescription>
                </div>
                <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-department">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Department</DialogTitle>
                      <DialogDescription>Create a new department</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="dept-name">Department Name *</Label>
                        <Input
                          id="dept-name"
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                          placeholder="e.g., Academic Affairs"
                          data-testid="input-dept-name"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => newDeptName && addDeptMutation.mutate(newDeptName)}
                        disabled={!newDeptName || addDeptMutation.isPending}
                        data-testid="button-save-department"
                      >
                        {addDeptMutation.isPending ? "Adding..." : "Add Department"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {depsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department Name</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No departments yet. Add your first department above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      departments?.map((dept) => (
                        <TableRow key={dept.id} data-testid={`row-dept-${dept.id}`}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingDept(dept);
                                  setEditDeptDialogOpen(true);
                                }}
                                data-testid={`button-edit-dept-${dept.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDeptMutation.mutate(dept.id)}
                                data-testid={`button-delete-dept-${dept.id}`}
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
          
          <Dialog open={editDeptDialogOpen} onOpenChange={setEditDeptDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Department</DialogTitle>
                <DialogDescription>Update the department name</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dept-name">Department Name *</Label>
                  <Input
                    id="edit-dept-name"
                    value={editingDept?.name || ""}
                    onChange={(e) => setEditingDept(editingDept ? { ...editingDept, name: e.target.value } : null)}
                    placeholder="e.g., Academic Affairs"
                    data-testid="input-edit-dept-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDeptDialogOpen(false);
                    setEditingDept(null);
                  }}
                  data-testid="button-cancel-edit-dept"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingDept && editingDept.name) {
                      updateDeptMutation.mutate({ id: editingDept.id, name: editingDept.name });
                    }
                  }}
                  disabled={!editingDept?.name || updateDeptMutation.isPending}
                  data-testid="button-save-edit-dept"
                >
                  {updateDeptMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="subdepartments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sub-Departments</CardTitle>
                  <CardDescription>Manage sub-departments within each department</CardDescription>
                </div>
                <Dialog open={subDeptDialogOpen} onOpenChange={setSubDeptDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-subdepartment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Sub-Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Sub-Department</DialogTitle>
                      <DialogDescription>Create a new sub-department</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="subdept-name">Sub-Department Name *</Label>
                        <Input
                          id="subdept-name"
                          value={newSubDeptName}
                          onChange={(e) => setNewSubDeptName(e.target.value)}
                          placeholder="e.g., Undergraduate Studies"
                          data-testid="input-subdept-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subdept-parent">Parent Department *</Label>
                        <Select value={newSubDeptParent} onValueChange={setNewSubDeptParent}>
                          <SelectTrigger data-testid="select-subdept-parent">
                            <SelectValue placeholder="Select parent department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (newSubDeptName && newSubDeptParent) {
                            addSubDeptMutation.mutate({
                              name: newSubDeptName,
                              departmentId: newSubDeptParent,
                            });
                          }
                        }}
                        disabled={!newSubDeptName || !newSubDeptParent || addSubDeptMutation.isPending}
                        data-testid="button-save-subdepartment"
                      >
                        {addSubDeptMutation.isPending ? "Adding..." : "Add Sub-Department"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {subDepsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sub-Department Name</TableHead>
                      <TableHead>Parent Department</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subDepartments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No sub-departments yet. Add your first sub-department above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      subDepartments?.map((subDept) => (
                        <TableRow key={subDept.id} data-testid={`row-subdept-${subDept.id}`}>
                          <TableCell className="font-medium">{subDept.name}</TableCell>
                          <TableCell>{getDepartmentName(subDept.departmentId)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingSubDept(subDept);
                                  setEditSubDeptDialogOpen(true);
                                }}
                                data-testid={`button-edit-subdept-${subDept.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSubDeptMutation.mutate(subDept.id)}
                                data-testid={`button-delete-subdept-${subDept.id}`}
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
          
          <Dialog open={editSubDeptDialogOpen} onOpenChange={setEditSubDeptDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Sub-Department</DialogTitle>
                <DialogDescription>Update the sub-department name and parent department</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subdept-name">Sub-Department Name *</Label>
                  <Input
                    id="edit-subdept-name"
                    value={editingSubDept?.name || ""}
                    onChange={(e) => setEditingSubDept(editingSubDept ? { ...editingSubDept, name: e.target.value } : null)}
                    placeholder="e.g., Undergraduate Studies"
                    data-testid="input-edit-subdept-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subdept-parent">Parent Department *</Label>
                  <Select 
                    value={editingSubDept?.departmentId || ""} 
                    onValueChange={(value) => setEditingSubDept(editingSubDept ? { ...editingSubDept, departmentId: value } : null)}
                  >
                    <SelectTrigger data-testid="select-edit-subdept-parent">
                      <SelectValue placeholder="Select parent department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
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
                    setEditSubDeptDialogOpen(false);
                    setEditingSubDept(null);
                  }}
                  data-testid="button-cancel-edit-subdept"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingSubDept && editingSubDept.name && editingSubDept.departmentId) {
                      updateSubDeptMutation.mutate({ 
                        id: editingSubDept.id, 
                        name: editingSubDept.name,
                        departmentId: editingSubDept.departmentId 
                      });
                    }
                  }}
                  disabled={!editingSubDept?.name || !editingSubDept?.departmentId || updateSubDeptMutation.isPending}
                  data-testid="button-save-edit-subdept"
                >
                  {updateSubDeptMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
