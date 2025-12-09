import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, BarChart3, Settings, Download, LineChart, Database, Users, ClipboardList } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";

interface HomeProps {
  staff: StaffWithDetails;
  isAdmin: boolean;
}

export default function Home({ staff, isAdmin }: HomeProps) {
  const allActions = [
    {
      title: "Submit New OKR",
      description: "Create a new Objective and Key Result for tracking",
      icon: FileText,
      path: "/submit-okr",
      color: "text-blue-600",
      bg: "bg-blue-50",
      adminOnly: false,
    },
    {
      title: "Quarterly Update",
      description: "Update progress on your existing OKRs",
      icon: TrendingUp,
      path: "/quarterly-update",
      color: "text-green-600",
      bg: "bg-green-50",
      adminOnly: false,
    },
    {
      title: "My OKRs",
      description: "View all your submitted OKRs and Key Results in one place",
      icon: ClipboardList,
      path: "/my-okrs",
      color: "text-amber-600",
      bg: "bg-amber-50",
      adminOnly: false,
    },
    {
      title: "View Dashboard",
      description: "Track progress and performance across all SPUs",
      icon: BarChart3,
      path: "/dashboard",
      color: "text-purple-600",
      bg: "bg-purple-50",
      adminOnly: false,
    },
    {
      title: "Employee Progress",
      description: "Comprehensive view of OKR progress by employee with filtering",
      icon: Users,
      path: "/employee-progress",
      color: "text-pink-600",
      bg: "bg-pink-50",
      adminOnly: false,
    },
    {
      title: "Historical Trends",
      description: "Year-over-year comparison and quarterly trend analysis",
      icon: LineChart,
      path: "/trends",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      adminOnly: false,
    },
    {
      title: "Data Management",
      description: "View and edit all OKR submissions and quarterly updates",
      icon: Database,
      path: "/data",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      adminOnly: true,
    },
    {
      title: "Admin Panel",
      description: "Manage staff, SPUs, and system settings",
      icon: Settings,
      path: "/admin",
      color: "text-orange-600",
      bg: "bg-orange-50",
      adminOnly: true,
    },
    {
      title: "Export Data",
      description: "Download OKR data as CSV for analysis",
      icon: Download,
      path: "/export",
      color: "text-teal-600",
      bg: "bg-teal-50",
      adminOnly: false,
    },
  ];

  const actions = allActions.filter((action) => !action.adminOnly || isAdmin);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Welcome, {staff.name.split(" ")[0]}!</h1>
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
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Your Profile</h3>
              <div className="text-sm text-muted-foreground space-y-1">
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
