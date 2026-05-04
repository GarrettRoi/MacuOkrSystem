import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordGate from "@/pages/password-gate";
import StaffSelection from "@/pages/staff-selection";
import SetupWizard from "@/pages/setup";
import Home from "@/pages/home";
import SubmitOkr from "@/pages/submit-okr";
import QuarterlyUpdate from "@/pages/quarterly-update";
import UniversityAchievement from "@/pages/university-achievement";
import Admin from "@/pages/admin";
import Export from "@/pages/export";
import Data from "@/pages/data";
import MyOkrs from "@/pages/my-okrs";
import Dashboard from "@/pages/dashboard";
import EmployeeProgress from "@/pages/employee-progress";
import TrendsPage from "@/pages/trends";
import PublicHome from "@/pages/public-home";
import SetPassword from "@/pages/set-password";
import AppHeader from "@/components/app-header";
import { FeedbackWidget } from "@/components/feedback-widget";
import type { StaffWithDetails } from "@shared/schema";

function LoginRedirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return null;
}

function AuthenticatedRouter({ staff, isAdmin }: { staff: StaffWithDetails; isAdmin: boolean }) {
  return (
    <Switch>
      <Route path="/" component={() => <Home staff={staff} isAdmin={isAdmin} />} />
      <Route path="/login" component={() => <Home staff={staff} isAdmin={isAdmin} />} />
      <Route path="/submit-okr" component={() => <SubmitOkr staff={staff} />} />
      <Route path="/quarterly-update" component={() => <QuarterlyUpdate staff={staff} />} />
      <Route path="/university-achievement" component={UniversityAchievement} />
      <Route path="/my-okrs" component={() => <MyOkrs staff={staff} />} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/employee-progress" component={() => <EmployeeProgress staff={staff} />} />
      <Route path="/trends" component={TrendsPage} />
      <Route path="/data" component={Data} />
      {(isAdmin || staff.role === "leader" || staff.role === "super_admin") && (
        <Route path="/admin" component={() => <Admin staff={staff} isAdmin={isAdmin} />} />
      )}
      <Route path="/export" component={Export} />
      <Route component={() => <Home staff={staff} isAdmin={isAdmin} />} />
    </Switch>
  );
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithDetails | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [location] = useLocation();

  const { data: session, isLoading: sessionLoading } = useQuery<{
    authenticated: boolean;
    isAdmin?: boolean;
    selectedStaff?: StaffWithDetails;
  }>({
    queryKey: ["/api/auth/session"],
    retry: false,
  });

  const { data: setupStatus, isLoading: setupLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/setup/status"],
    retry: false,
    enabled: !!session?.authenticated,
  });

  const selectStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return await apiRequest("POST", "/api/auth/select-staff", { staffId });
    },
    onSuccess: (data: any) => {
      if (data.staff) {
        setSelectedStaff(data.staff);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      setSelectedStaff(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      setSetupComplete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  useEffect(() => {
    if (!sessionLoading && session) {
      if (!sessionChecked) setSessionChecked(true);
      if (session.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(session.isAdmin || false);
        if (session.selectedStaff) setSelectedStaff(session.selectedStaff);
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setSelectedStaff(null);
        setSetupComplete(null);
      }
    }
  }, [session, sessionLoading, sessionChecked]);

  useEffect(() => {
    if (setupStatus !== undefined) {
      setSetupComplete(setupStatus.completed);
    }
  }, [setupStatus]);

  const handleAuthenticated = (adminAccess: boolean) => {
    setIsAdmin(adminAccess);
    setIsAuthenticated(true);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
  };

  const handleStaffSelected = (staff: StaffWithDetails) => {
    selectStaffMutation.mutate(staff.id);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleSetupComplete = () => {
    setSetupComplete(true);
    queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
  };

  if (sessionLoading || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Public routes — always accessible regardless of auth state
  if (location === "/set-password" || location.startsWith("/set-password?")) {
    return (
      <>
        <Switch>
          <Route path="/set-password" component={SetPassword} />
        </Switch>
        <Toaster />
      </>
    );
  }

  // Login page — show PasswordGate if not authenticated, redirect to app if already authenticated
  if (location === "/login" || location.startsWith("/login?")) {
    if (isAuthenticated) {
      // Already logged in — useEffect to navigate so render stays pure
      return <LoginRedirect />;
    }
    return (
      <>
        <PasswordGate onAuthenticated={handleAuthenticated} />
        <Toaster />
      </>
    );
  }

  // Public home page — show public view when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/" component={PublicHome} />
          <Route component={PublicHome} />
        </Switch>
        <Toaster />
      </>
    );
  }

  // Still checking setup status
  if (setupLoading && setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (setupComplete === false) {
    return (
      <>
        <SetupWizard onComplete={handleSetupComplete} />
        <Toaster />
      </>
    );
  }

  if (!selectedStaff) {
    return (
      <>
        <StaffSelection
          onStaffSelected={handleStaffSelected}
          isAdmin={isAdmin}
          onAdminBypass={() => {
            const adminStaff: StaffWithDetails = {
              id: "admin-bypass",
              name: "Administrator",
              email: "",
              isAdmin: true,
              role: "super_admin",
              spuId: "",
              subUnitId: null,
              spu: { id: "", name: "Administration" },
              subUnit: null,
            };
            setSelectedStaff(adminStaff);
          }}
        />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <AppHeader staff={selectedStaff} onLogout={handleLogout} isAdmin={isAdmin} />
        <main className="flex-1 bg-background">
          <AuthenticatedRouter staff={selectedStaff} isAdmin={isAdmin} />
        </main>
      </div>
      <FeedbackWidget />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
