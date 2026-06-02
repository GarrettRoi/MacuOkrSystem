import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREVIEW_KEY = "notifOnboardingPreview";
const MAX_LOGINS = 5;

interface NotificationOnboardingProps {
  bellRef: React.RefObject<HTMLButtonElement>;
  staffId: string;
  loginCount: number;
  impersonating: boolean;
  subscribed: boolean;
  permission: NotificationPermission;
  onSubscribe: () => void;
}

export function triggerNotificationOnboardingPreview() {
  try {
    sessionStorage.setItem(PREVIEW_KEY, "1");
  } catch {}
  window.dispatchEvent(new Event("notif-onboarding-preview"));
}

export default function NotificationOnboarding({
  bellRef,
  staffId,
  loginCount,
  impersonating,
  subscribed,
  permission,
  onSubscribe,
}: NotificationOnboardingProps) {
  const [preview, setPreview] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; arrowRight: number } | null>(null);

  // Key the manual dismissal per user AND per login count so it only suppresses
  // the popup for the current login: the next genuine login increments
  // loginCount, which yields a fresh key and shows the tutorial again (until the
  // user subscribes or passes their first MAX_LOGINS logins).
  const dismissKey = `notifOnboardingDismissed:${staffId}:${loginCount}`;

  // Pick up a preview request triggered from the admin settings page. Because
  // this component stays mounted in the header across route changes, we listen
  // for an event rather than only reading sessionStorage on mount.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PREVIEW_KEY) === "1") setPreview(true);
    } catch {}
    const onPreview = () => {
      setDismissed(false);
      setPreview(true);
    };
    window.addEventListener("notif-onboarding-preview", onPreview);
    return () => window.removeEventListener("notif-onboarding-preview", onPreview);
  }, []);

  // Once dismissed for this login, stay hidden until the next genuine login.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey) === "1");
    } catch {}
  }, [dismissKey]);

  const meetsAutoCriteria =
    !impersonating &&
    loginCount > 0 &&
    loginCount <= MAX_LOGINS &&
    !subscribed &&
    permission !== "denied";

  const visible = preview || (meetsAutoCriteria && !dismissed);

  // Auto-close once the user subscribes (the whole point of the tutorial).
  useEffect(() => {
    if (subscribed && !preview) {
      setDismissed(true);
    }
  }, [subscribed, preview]);

  useLayoutEffect(() => {
    if (!visible) return;
    const compute = () => {
      const el = bellRef.current;
      if (!el) {
        setPos(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const rightInset = Math.max(8, window.innerWidth - rect.right);
      // Center the arrow under the bell. Card right edge aligns with bell right
      // edge, so the bell center sits half a bell-width in from the right.
      const arrowRight = Math.max(8, rect.width / 2 - 10);
      setPos({ top: rect.bottom + 10, right: rightInset, arrowRight });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [visible, bellRef]);

  if (!visible || !pos) return null;

  const close = () => {
    setDismissed(true);
    setPreview(false);
    try {
      sessionStorage.setItem(dismissKey, "1");
      sessionStorage.removeItem(PREVIEW_KEY);
    } catch {}
  };

  return (
    <div
      className="fixed z-[90] w-[280px]"
      style={{ top: pos.top, right: pos.right }}
      data-testid="overlay-notification-onboarding"
    >
      <div className="relative flex justify-end" style={{ marginBottom: 2 }}>
        <ArrowUp
          className="h-7 w-7 text-primary animate-bounce drop-shadow"
          style={{ marginRight: pos.arrowRight }}
          aria-hidden="true"
        />
      </div>
      <div className="rounded-md border bg-popover text-popover-foreground shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold" data-testid="text-onboarding-title">
              Turn on notifications
            </p>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover-elevate rounded-sm p-0.5"
            aria-label="Dismiss"
            data-testid="button-onboarding-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Click the bell above to get announcements, then choose{" "}
          <span className="font-medium text-foreground">Allow notifications</span> in your browser.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => {
              onSubscribe();
              if (preview) close();
            }}
            data-testid="button-onboarding-enable"
          >
            <Bell className="h-4 w-4 mr-2" />
            Enable notifications
          </Button>
          <Button size="sm" variant="ghost" onClick={close} data-testid="button-onboarding-later">
            Maybe later
          </Button>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground" data-testid="text-onboarding-preview-note">
            Preview mode — this is how the tutorial appears to new staff on their first {MAX_LOGINS} logins.
          </p>
        )}
      </div>
    </div>
  );
}
