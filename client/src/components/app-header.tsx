import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, FileText, TrendingUp, BarChart3, Settings, Download, LogOut } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";

interface AppHeaderProps {
  staff: StaffWithDetails;
  onLogout: () => void;
}

export default function AppHeader({ staff, onLogout }: AppHeaderProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/submit-okr", icon: FileText, label: "Submit OKR" },
    { path: "/quarterly-update", icon: TrendingUp, label: "Quarterly Update" },
    { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
    { path: "/admin", icon: Settings, label: "Admin" },
    { path: "/export", icon: Download, label: "Export" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-3 mr-6">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">MACU</span>
          </div>
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold">OKR Tracking</h1>
            <p className="text-xs text-muted-foreground">Mid-America Christian University</p>
          </div>
        </div>

        <nav className="flex-1 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 ml-4">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium" data-testid="text-current-user">{staff.name}</p>
            <p className="text-xs text-muted-foreground">{staff.department.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
