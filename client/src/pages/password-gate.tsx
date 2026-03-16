import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Shield, User, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PasswordGateProps {
  onAuthenticated: (isAdmin: boolean) => void;
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const { data: passwordSetting, isLoading: settingLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/password-login"],
  });

  const { data: ssoSetting, isLoading: ssoLoading } = useQuery<{
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    hasClientSecret: boolean;
  }>({
    queryKey: ["/api/settings/sso"],
  });

  const passwordEnabled = passwordSetting?.enabled !== false;
  const ssoEnabled = ssoSetting?.enabled === true;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get("sso_error");
    const email = params.get("email");
    if (ssoError) {
      const messages: Record<string, string> = {
        no_account: `No staff account found for ${email || "that email address"}. Contact your administrator.`,
        no_email: "OneLogin did not provide an email address. Contact your administrator.",
        invalid_state: "Login session expired. Please try again.",
        callback_failed: "Sign-in failed. Please try again or use the admin login below.",
        session_error: "A session error occurred. Please try again.",
      };
      setError(messages[ssoError] || "Sign-in failed. Please try again.");
      setShowAdminLogin(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleSsoLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/sso/login");
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.redirectUrl;
      } else {
        const data = await res.json();
        setError(data.error || "Failed to start sign-in. Please try again.");
        setIsLoading(false);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        onAuthenticated(data.isAdmin);
      } else {
        setError("Incorrect password. Please try again.");
        setPassword("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnter = async (asAdmin: boolean) => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: asAdmin }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        onAuthenticated(data.isAdmin);
      } else {
        setError("An error occurred. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (settingLoading || ssoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const showSsoPrimary = ssoEnabled && !showAdminLogin;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">MACU</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">OKR Tracking System</CardTitle>
          <CardDescription className="text-base">
            Mid-America Christian University
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {showSsoPrimary && (
            <div className="space-y-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleSsoLogin}
                disabled={isLoading}
                data-testid="button-sso-login"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {isLoading ? "Redirecting to OneLogin..." : "Sign in with OneLogin"}
              </Button>

              {passwordEnabled && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <form onSubmit={handlePasswordSubmit} className="space-y-3">
                    <Input
                      type="password"
                      placeholder="Access password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                      className="text-base"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading || !password}
                      data-testid="button-submit-password"
                    >
                      Continue with Password
                    </Button>
                  </form>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {!showSsoPrimary && passwordEnabled && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              {showAdminLogin && ssoEnabled && (
                <p className="text-sm text-center text-muted-foreground">Admin / manual login</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Access Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter admin or staff password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  autoFocus
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Admin password for full access, or staff password for limited access
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || !password}
                data-testid="button-submit"
              >
                {isLoading ? "Verifying..." : "Continue"}
              </Button>

              {showAdminLogin && ssoEnabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setShowAdminLogin(false); setError(""); setPassword(""); }}
                  data-testid="button-back-to-sso"
                >
                  Back to OneLogin sign-in
                </Button>
              )}
            </form>
          )}

          {!showSsoPrimary && !passwordEnabled && (
            <div className="space-y-4">
              {showAdminLogin && ssoEnabled && (
                <p className="text-sm text-center text-muted-foreground">Admin / manual login</p>
              )}
              <p className="text-sm text-muted-foreground text-center">
                Select your access level to continue
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => handleEnter(true)}
                  disabled={isLoading}
                  data-testid="button-enter-admin"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Enter as Admin
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => handleEnter(false)}
                  disabled={isLoading}
                  data-testid="button-enter-staff"
                >
                  <User className="h-4 w-4 mr-2" />
                  Enter as Staff
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {showAdminLogin && ssoEnabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setShowAdminLogin(false); setError(""); }}
                  data-testid="button-back-to-sso"
                >
                  Back to OneLogin sign-in
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {ssoEnabled && !showAdminLogin && (
        <button
          className="mt-8 text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors select-none"
          onClick={() => setShowAdminLogin(true)}
          data-testid="button-admin-escape"
          aria-label="Admin login"
        >
          Admin Login
        </button>
      )}
    </div>
  );
}
