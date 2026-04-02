import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { UniversityAchievementContent } from "./university-achievement";

export default function PublicHome() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MACU Logo" className="h-8 w-auto shrink-0" />
            <span className="font-semibold text-base">OKR Tracking System</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="default" data-testid="button-staff-login">
              <LogIn className="h-4 w-4 mr-2" />
              Staff Login
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">University Achievement</h1>
          <p className="text-muted-foreground mt-1">
            Track progress, performance, and historical trends across all SPUs
          </p>
        </div>

        <UniversityAchievementContent hideAnalytics />
      </main>
    </div>
  );
}
