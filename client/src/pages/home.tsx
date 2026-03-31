import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, TrendingUp, ClipboardList, Settings, Download, Database, Users, LineChart } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";
import { getSortableName } from "@/lib/utils";
import { UniversityAchievementContent } from "@/pages/university-achievement";

interface HomeProps {
  staff: StaffWithDetails;
  isAdmin: boolean;
}

export default function Home({ staff, isAdmin }: HomeProps) {
  const quickActions = [
    { title: "Submit OKR", icon: FileText, path: "/submit-okr" },
    { title: "Score OKR", icon: TrendingUp, path: "/quarterly-update" },
    { title: "My OKRs", icon: ClipboardList, path: "/my-okrs" },
    { title: "All OKRs", icon: Users, path: "/employee-progress" },
    { title: "Trends", icon: LineChart, path: "/trends" },
    ...(isAdmin ? [
      { title: "Data", icon: Database, path: "/data" },
      { title: "Admin", icon: Settings, path: "/admin" },
      { title: "Export", icon: Download, path: "/export" },
    ] : [
      { title: "Export", icon: Download, path: "/export" },
    ]),
  ];

  return (
    <div className="min-h-screen">
      {/* Top bar: welcome + quick actions + profile */}
      <div className="border-b bg-card px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {staff.name.toLowerCase() === "phil greenwald" ? "PG5" : getSortableName(staff.name).split(" ")[0]}!
            </h1>
            <p className="text-sm text-muted-foreground">{staff.spu?.name}{staff.subUnit ? ` · ${staff.subUnit.name}` : ""}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.path} href={action.path}>
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-quick-${action.path.slice(1)}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {action.title}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* University Achievement content (no analytics tab) */}
      <div className="px-6 py-6 max-w-[1600px] mx-auto">
        <UniversityAchievementContent hideAnalytics={true} />
      </div>

      {/* Profile card at the bottom */}
      <div className="px-6 pb-6 max-w-[1600px] mx-auto">
        <Card>
          <CardContent className="p-4 bg-[#c51232] text-white rounded-lg">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span className="font-semibold">Your Profile</span>
              <span><span className="opacity-80">Name:</span> {staff.name}</span>
              <span><span className="opacity-80">Email:</span> {staff.email}</span>
              <span><span className="opacity-80">SPU:</span> {staff.spu.name}</span>
              {staff.subUnit && <span><span className="opacity-80">Sub-Unit:</span> {staff.subUnit.name}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
