import { useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, FileText, TrendingUp, BarChart3, Settings, Download, LogOut, Award, Bell, BellOff } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";
import { isLeaderRole } from "@shared/schema";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import NotificationOnboarding from "@/components/notification-onboarding";

interface AppHeaderProps {
  staff: StaffWithDetails;
  onLogout: () => void;
  isAdmin: boolean;
  impersonating?: boolean;
}

export default function AppHeader({ staff, onLogout, isAdmin, impersonating = false }: AppHeaderProps) {
  const [location] = useLocation();
  const bellRef = useRef<HTMLButtonElement>(null);

  const allNavItems = [
    { path: "/", icon: Home, label: "Home", adminOnly: false },
    { path: "/submit-okr", icon: FileText, label: "Submit OKR", adminOnly: false },
    { path: "/quarterly-update", icon: TrendingUp, label: "Score OKR", adminOnly: false },
    { path: "/university-achievement", icon: Award, label: "Achievement", adminOnly: false },
    { path: "/admin", icon: Settings, label: "Admin", adminOnly: true },
    { path: "/export", icon: Download, label: "Export", adminOnly: false },
  ];

  const canAccessAdmin = isAdmin || isLeaderRole(staff.role) || staff.role === "super_admin";
  const navItems = allNavItems.filter((item) => !item.adminOnly || canAccessAdmin);
  const push = usePushNotifications();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-3 mr-6">
          <img src="/logo.png" alt="MACU Logo" className="h-10 w-auto" />
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold">OKR Genius</h1>
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
            <div className="flex items-center gap-2 justify-end">
              <p className="text-sm font-medium" data-testid="text-current-user">{staff.name}</p>
              {isAdmin && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-admin">
                  Admin
                </Badge>
              )}
            </div>
            {staff.spu && (
              <p className="text-xs text-muted-foreground">{staff.spu.name}</p>
            )}
          </div>
          {push.supported && (
            <Button
              ref={bellRef}
              variant="ghost"
              size="icon"
              onClick={() => (push.subscribed ? push.unsubscribe() : push.subscribe())}
              disabled={push.busy || push.permission === "denied"}
              title={
                push.permission === "denied"
                  ? "Notifications blocked in browser settings"
                  : push.subscribed
                    ? "Disable announcement notifications"
                    : "Enable announcement notifications"
              }
              data-testid="button-toggle-notifications"
            >
              {push.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {push.supported && (
        <NotificationOnboarding
          bellRef={bellRef}
          staffId={staff.id}
          loginCount={staff.loginCount ?? 0}
          impersonating={impersonating}
          subscribed={push.subscribed}
          permission={push.permission}
          onSubscribe={push.subscribe}
        />
      )}
    </header>
  );
}
