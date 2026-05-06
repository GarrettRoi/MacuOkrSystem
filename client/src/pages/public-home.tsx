import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Info, LogIn, X } from "lucide-react";
import { UniversityAchievementContent } from "./university-achievement";

export default function PublicHome() {
  const [ssoNoAccountEmail, setSsoNoAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") === "no_account") {
      setSsoNoAccountEmail(params.get("email") || "");
      params.delete("sso");
      params.delete("email");
      const remaining = params.toString();
      window.history.replaceState({}, "", remaining ? `/?${remaining}` : "/");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MACU Logo" className="h-8 w-auto shrink-0" />
            <span className="font-semibold text-base">OKR Genius</span>
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
        {ssoNoAccountEmail !== null && (
          <div
            className="flex items-start gap-3 rounded-md border bg-muted p-4"
            data-testid="banner-sso-no-account"
          >
            <Info className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-medium">You're viewing the public dashboard</p>
              <p className="text-muted-foreground mt-1">
                {ssoNoAccountEmail
                  ? <>We couldn't find a MACU OKR account for <span className="font-medium text-foreground">{ssoNoAccountEmail}</span>. </>
                  : <>We couldn't find a MACU OKR account for your OneLogin email. </>}
                You can still browse the university's strategic-planning data below. If you believe you should have access, please contact your administrator.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSsoNoAccountEmail(null)}
              data-testid="button-dismiss-sso-banner"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

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
