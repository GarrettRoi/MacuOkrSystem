import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordGate from "@/pages/password-gate";
import StaffSelection from "@/pages/staff-selection";
import Home from "@/pages/home";
import SubmitOkr from "@/pages/submit-okr";
import QuarterlyUpdate from "@/pages/quarterly-update";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Export from "@/pages/export";
import Trends from "@/pages/trends";
import AppHeader from "@/components/app-header";
import type { StaffWithDetails } from "@shared/schema";

function Router({ staff, isAdmin }: { staff: StaffWithDetails; isAdmin: boolean }) {
  return (
    <Switch>
      <Route path="/" component={() => <Home staff={staff} isAdmin={isAdmin} />} />
      <Route path="/submit-okr" component={() => <SubmitOkr staff={staff} />} />
      <Route path="/quarterly-update" component={() => <QuarterlyUpdate staff={staff} />} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/trends" component={Trends} />
      {isAdmin && <Route path="/admin" component={Admin} />}
      <Route path="/export" component={Export} />
      <Route component={() => <Home staff={staff} isAdmin={isAdmin} />} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithDetails | null>(null);

  const handleAuthenticated = (adminAccess: boolean) => {
    setIsAdmin(adminAccess);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setSelectedStaff(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!isAuthenticated ? (
          <PasswordGate onAuthenticated={handleAuthenticated} />
        ) : !selectedStaff ? (
          <StaffSelection onStaffSelected={setSelectedStaff} />
        ) : (
          <div className="min-h-screen flex flex-col">
            <AppHeader staff={selectedStaff} onLogout={handleLogout} isAdmin={isAdmin} />
            <main className="flex-1 bg-background">
              <Router staff={selectedStaff} isAdmin={isAdmin} />
            </main>
          </div>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
