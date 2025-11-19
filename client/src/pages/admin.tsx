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
import { Plus, Trash2, Settings } from "lucide-react";
import type { Staff, Department, SubDepartment } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Admin() {
  const { toast } = useToast();
  
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [subDeptDialogOpen, setSubDeptDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  
  const [newDeptName, setNewDeptName] = useState("");
  const [newSubDeptName, setNewSubDeptName] = useState("");
  const [newSubDeptParent, setNewSubDeptParent] = useState("");
  
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffDept, setNewStaffDept] = useState("");
  const [newStaffSubDept, setNewStaffSubDept] = useState("");

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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteStaffMutation.mutate(member.id)}
                              data-testid={`button-delete-staff-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDeptMutation.mutate(dept.id)}
                              data-testid={`button-delete-dept-${dept.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSubDeptMutation.mutate(subDept.id)}
                              data-testid={`button-delete-subdept-${subDept.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
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
