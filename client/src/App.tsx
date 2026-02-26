import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordGate from "@/pages/password-gate";
import StaffSelection from "@/pages/staff-selection";
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
import AppHeader from "@/components/app-header";
import type { StaffWithDetails } from "@shared/schema";

function Router({ staff, isAdmin }: { staff: StaffWithDetails; isAdmin: boolean }) {
  return (
    <Switch>
      <Route path="/" component={() => <Home staff={staff} isAdmin={isAdmin} />} />
      <Route path="/submit-okr" component={() => <SubmitOkr staff={staff} />} />
      <Route path="/quarterly-update" component={() => <QuarterlyUpdate staff={staff} />} />
      <Route path="/university-achievement" component={UniversityAchievement} />
      <Route path="/my-okrs" component={() => <MyOkrs staff={staff} />} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/employee-progress" component={() => <EmployeeProgress staff={staff} />} />
      <Route path="/trends" component={TrendsPage} />
      <Route path="/data" component={Data} />
      {(isAdmin || staff.role === "leader" || staff.role === "super_admin") && (
        <Route path="/admin" component={() => <Admin staff={staff} />} />
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

  const { data: session, isLoading: sessionLoading } = useQuery<{
    authenticated: boolean;
    isAdmin?: boolean;
    selectedStaff?: StaffWithDetails;
  }>({
    queryKey: ["/api/auth/session"],
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  useEffect(() => {
    if (!sessionLoading && session) {
      if (!sessionChecked) {
        setSessionChecked(true);
      }
      
      if (session.authenticated) {
        setIsAuthenticated(true);
        setIsAdmin(session.isAdmin || false);
        if (session.selectedStaff) {
          setSelectedStaff(session.selectedStaff);
        }
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setSelectedStaff(null);
      }
    }
  }, [session, sessionLoading, sessionChecked]);

  const handleAuthenticated = (adminAccess: boolean) => {
    setIsAdmin(adminAccess);
    setIsAuthenticated(true);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
  };

  const handleStaffSelected = (staff: StaffWithDetails) => {
    selectStaffMutation.mutate(staff.id);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (sessionLoading || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated ? (
        <PasswordGate onAuthenticated={handleAuthenticated} />
      ) : !selectedStaff ? (
        <StaffSelection onStaffSelected={handleStaffSelected} />
      ) : (
        <div className="min-h-screen flex flex-col">
          <AppHeader staff={selectedStaff} onLogout={handleLogout} isAdmin={isAdmin} />
          <main className="flex-1 bg-background">
            <Router staff={selectedStaff} isAdmin={isAdmin} />
          </main>
        </div>
      )}
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
