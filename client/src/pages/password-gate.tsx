import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface PasswordGateProps {
  onAuthenticated: (isAdmin: boolean) => void;
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">MACU</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">OKR Tracking System</CardTitle>
          <CardDescription className="text-base">
            Mid-America Christian University
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
