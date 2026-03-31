import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string>("");
  const [staffName, setStaffName] = useState<string>("");
  const [tokenState, setTokenState] = useState<"loading" | "valid" | "invalid" | "used" | "expired">("loading");
  const [tokenError, setTokenError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenState("invalid");
      setTokenError("No token provided.");
      return;
    }
    setToken(t);

    fetch(`/api/invite/validate/${t}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.valid) {
          setStaffName(data.staffName);
          setEmail(data.staffEmail);
          setTokenState("valid");
        } else if (res.status === 410) {
          if (data.error?.includes("used")) {
            setTokenState("used");
          } else {
            setTokenState("expired");
          }
          setTokenError(data.error || "Token is no longer valid.");
        } else {
          setTokenState("invalid");
          setTokenError(data.error || "Invalid token.");
        }
      })
      .catch(() => {
        setTokenState("invalid");
        setTokenError("An error occurred. Please try again.");
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!email || !email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/invite/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setFormError(data.error || "Failed to set password. Please try again.");
      }
    } catch {
      setFormError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">MACU</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set Your Password</CardTitle>
          <CardDescription>
            Create a personal login for the OKR Tracking System
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenState === "loading" && (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {(tokenState === "invalid" || tokenState === "used" || tokenState === "expired") && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-semibold text-destructive mb-1">
                  {tokenState === "used" ? "Link Already Used" : tokenState === "expired" ? "Link Expired" : "Invalid Link"}
                </p>
                <p className="text-sm text-muted-foreground">{tokenError}</p>
                {tokenState === "used" && (
                  <p className="text-sm text-muted-foreground mt-2">
                    If you need to reset your password, contact your administrator for a new link.
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => navigate("/login")} data-testid="button-go-to-login">
                Go to Login
              </Button>
            </div>
          )}

          {tokenState === "valid" && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{staffName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="set-email">Email Address</Label>
                <Input
                  id="set-email"
                  type="email"
                  placeholder="your.email@macu.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  data-testid="input-set-email"
                />
                <p className="text-xs text-muted-foreground">
                  You'll use this email to sign in. Update it if needed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoFocus
                    data-testid="input-new-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-form-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting || !email || !password || !confirmPassword}
                data-testid="button-set-password"
              >
                {submitting ? "Setting password..." : "Set Password"}
              </Button>
            </form>
          )}

          {success && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div>
                <p className="font-semibold mb-1">Password Set Successfully</p>
                <p className="text-sm text-muted-foreground">
                  You can now log in with your email and new password.
                </p>
              </div>
              <Button onClick={() => navigate("/login")} data-testid="button-go-to-login-success">
                Go to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
