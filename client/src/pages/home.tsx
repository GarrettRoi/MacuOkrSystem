import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, BarChart3, Settings, Download, Database, ClipboardList, LayoutDashboard, Users, LineChart } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";
import { getSortableName } from "@/lib/utils";

interface HomeProps {
  staff: StaffWithDetails;
  isAdmin: boolean;
}

export default function Home({ staff, isAdmin }: HomeProps) {
  const isLeader = staff.role === "leader" || staff.role === "super_admin";

  const allActions = [
    {
      title: "Submit New OKR",
      description: "Create a new Objective and Key Result for tracking",
      icon: FileText,
      path: "/submit-okr",
      color: "text-blue-600",
      bg: "bg-blue-50",
      adminOnly: false,
      leaderAccess: false,
    },
    {
      title: "Quarterly Update",
      description: "Update progress on your existing OKRs",
      icon: TrendingUp,
      path: "/quarterly-update",
      color: "text-green-600",
      bg: "bg-green-50",
      adminOnly: false,
      leaderAccess: false,
    },
    {
      title: "My OKRs",
      description: "View all your submitted OKRs and Key Results in one place",
      icon: ClipboardList,
      path: "/my-okrs",
      color: "text-amber-600",
      bg: "bg-amber-50",
      adminOnly: false,
      leaderAccess: false,
    },
    {
      title: "OKR Dashboard",
      description: "Summary metrics, SPU progress charts, and OKR status overview",
      icon: LayoutDashboard,
      path: "/dashboard",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      adminOnly: false,
      leaderAccess: false,
      hidden: true,
    },
    {
      title: "All OKR's",
      description: "Detailed view of all OKRs and scores by SPU and staff member",
      icon: Users,
      path: "/employee-progress",
      color: "text-rose-600",
      bg: "bg-rose-50",
      adminOnly: false,
      leaderAccess: false,
    },
    {
      title: "University Achievement",
      description: "University-wide strategic objective completion and trends",
      icon: BarChart3,
      path: "/university-achievement",
      color: "text-purple-600",
      bg: "bg-purple-50",
      adminOnly: false,
      leaderAccess: false,
    },
    {
      title: "Trends",
      description: "Historical OKR trends and progress over time",
      icon: LineChart,
      path: "/trends",
      color: "text-violet-600",
      bg: "bg-violet-50",
      adminOnly: false,
      leaderAccess: false,
      hidden: true,
    },
    {
      title: "Data Management",
      description: "View and edit all OKR submissions and quarterly updates",
      icon: Database,
      path: "/data",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      adminOnly: true,
      leaderAccess: false,
    },
    {
      title: "Admin Panel",
      description: "Manage staff and SPU members for your team",
      icon: Settings,
      path: "/admin",
      color: "text-orange-600",
      bg: "bg-orange-50",
      adminOnly: false,
      leaderAccess: true,
    },
    {
      title: "Export Data",
      description: "Download OKR data as CSV for analysis",
      icon: Download,
      path: "/export",
      color: "text-teal-600",
      bg: "bg-teal-50",
      adminOnly: false,
      leaderAccess: false,
    },
  ];

  const actions = allActions.filter((action) => {
    if (action.hidden) return false;
    if (action.adminOnly && !isAdmin) return false;
    if (action.leaderAccess && !isLeader && !isAdmin) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Welcome, {staff.name.toLowerCase() === "phil greenwald" ? "PG5" : getSortableName(staff.name).split(" ")[0]}!</h1>
        <p className="text-muted-foreground text-lg">
          What would you like to do today?
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.path} href={action.path}>
              <Card className="hover-elevate cursor-pointer transition-all h-full" data-testid={`card-action-${action.path.slice(1)}`}>
                <CardHeader>
                  <div className={`h-12 w-12 rounded-lg ${action.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <CardTitle className="text-xl">{action.title}</CardTitle>
                  <CardDescription className="text-base">{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full" data-testid={`button-${action.path.slice(1)}`}>
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 pt-6 bg-[#c51232] text-[#ffffff]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Your Profile</h3>
              <div className="text-sm space-y-1 text-[#ffffff]">
                <p><span className="font-medium">Name:</span> {staff.name}</p>
                <p><span className="font-medium">Email:</span> {staff.email}</p>
                <p><span className="font-medium">Primary SPU:</span> {staff.spu.name}</p>
                {staff.subUnit && (
                  <p><span className="font-medium">Sub-Unit:</span> {staff.subUnit.name}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
