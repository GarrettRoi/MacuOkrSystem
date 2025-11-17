import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, Target, AlertTriangle } from "lucide-react";
import type { OkrWithDetails, QuarterlyUpdate, Department } from "@shared/schema";

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();
const YEARS = ["All", String(currentYear - 1), String(currentYear), String(currentYear + 1)];

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const [quarterFilter, setQuarterFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));

  const { data: okrs, isLoading: okrsLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  const { data: updates, isLoading: updatesLoading } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: departments, isLoading: depsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const isLoading = okrsLoading || updatesLoading || depsLoading;

  const filteredOkrs = okrs?.filter((okr) => {
    const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
    const yearMatch = yearFilter === "All" || String(okr.year) === yearFilter;
    return quarterMatch && yearMatch;
  }) || [];

  const totalOkrs = filteredOkrs.length;
  const avgProgress = totalOkrs > 0
    ? Math.round(filteredOkrs.reduce((sum, okr) => sum + okr.currentValue, 0) / totalOkrs)
    : 0;
  
  const uniqueStaffWithOkrs = new Set(filteredOkrs.map((okr) => okr.staffId)).size;
  
  const okrsNeedingUpdate = filteredOkrs.filter((okr) => {
    const hasRecentUpdate = updates?.some((update) => 
      update.okrId === okr.id && 
      update.quarter === quarterFilter &&
      Number(yearFilter) === update.year
    );
    return !hasRecentUpdate && quarterFilter !== "All";
  }).length;

  const departmentProgress = departments?.map((dept) => {
    const deptOkrs = filteredOkrs.filter((okr) => okr.staff.departmentId === dept.id);
    const avgProg = deptOkrs.length > 0
      ? Math.round(deptOkrs.reduce((sum, okr) => sum + okr.currentValue, 0) / deptOkrs.length)
      : 0;
    return {
      name: dept.name,
      progress: avgProg,
      count: deptOkrs.length,
    };
  }).filter((d) => d.count > 0) || [];

  const statusDistribution = [
    { name: "Not Started", value: filteredOkrs.filter((o) => o.status === "not_started").length },
    { name: "In Progress", value: filteredOkrs.filter((o) => o.status === "in_progress").length },
    { name: "Completed", value: filteredOkrs.filter((o) => o.status === "completed").length },
    { name: "At Risk", value: filteredOkrs.filter((o) => o.status === "at_risk").length },
  ].filter((s) => s.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">OKR Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track progress and performance across all departments
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={quarterFilter} onValueChange={setQuarterFilter}>
            <SelectTrigger className="w-32" data-testid="select-filter-quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q} value={q} data-testid={`option-filter-quarter-${q}`}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32" data-testid="select-filter-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y} data-testid={`option-filter-year-${y}`}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total OKRs</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-okrs">{totalOkrs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all departments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-progress">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-staff">{uniqueStaffWithOkrs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Staff with OKRs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Updates</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-updates">{okrsNeedingUpdate}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Need quarterly updates
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="departments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="departments" data-testid="tab-departments">By Department</TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-status">By Status</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">By Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Department Progress</CardTitle>
              <CardDescription>Average OKR completion by department</CardDescription>
            </CardHeader>
            <CardContent>
              {departmentProgress.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No data available for selected filters</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentProgress}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentProgress.map((dept, index) => (
              <Card key={dept.name} data-testid={`card-dept-${dept.name}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                  <CardDescription>{dept.count} OKRs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Progress</span>
                      <span className="text-2xl font-bold" data-testid={`text-dept-progress-${dept.name}`}>{dept.progress}%</span>
                    </div>
                    <Progress value={dept.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>OKR Status Distribution</CardTitle>
                <CardDescription>Breakdown of OKR statuses</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {statusDistribution.length === 0 ? (
                  <p className="text-muted-foreground py-12">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Summary</CardTitle>
                <CardDescription>OKR counts by status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusDistribution.map((status, index) => (
                  <div key={status.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{status.name}</span>
                    </div>
                    <span className="text-sm font-semibold" data-testid={`text-status-${status.name}`}>{status.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff OKR Overview</CardTitle>
              <CardDescription>Individual staff member progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredOkrs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No OKRs found for selected filters</p>
                ) : (
                  Array.from(new Set(filteredOkrs.map((o) => o.staffId))).map((staffId) => {
                    const staffOkrs = filteredOkrs.filter((o) => o.staffId === staffId);
                    const staff = staffOkrs[0]?.staff;
                    const avgProg = Math.round(staffOkrs.reduce((sum, o) => sum + o.currentValue, 0) / staffOkrs.length);
                    
                    return (
                      <Card key={staffId} data-testid={`card-staff-${staffId}`}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold" data-testid={`text-staff-name-${staffId}`}>{staff?.name}</h4>
                              <p className="text-sm text-muted-foreground">{staff?.department.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{staffOkrs.length} OKRs</p>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Average Progress</span>
                                <span className="font-semibold" data-testid={`text-staff-progress-${staffId}`}>{avgProg}%</span>
                              </div>
                              <Progress value={avgProg} className="h-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
