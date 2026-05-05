import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function FeedbackWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const { data: settingData } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/feedback-widget-enabled"],
  });

  const submitMutation = useMutation({
    mutationFn: async (msg: string) => {
      const pageUrl = (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : ""
      ).slice(0, 500);
      return await apiRequest("POST", "/api/feedback", { message: msg, pageUrl });
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
      setMessage("");
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" });
    },
  });

  const enabled = settingData?.enabled !== false;
  if (!enabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
      <div
        style={{ visibility: open ? "visible" : "hidden" }}
        aria-hidden={!open}
        className={`w-80 rounded-md border bg-background shadow-md p-4 space-y-3 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Send Feedback</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setOpen(false)}
            data-testid="button-close-feedback"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback-message" className="text-xs text-muted-foreground">
            Share a suggestion, report an issue, or leave a comment
          </Label>
          <Textarea
            id="feedback-message"
            placeholder="What's on your mind?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none text-sm min-h-24"
            data-testid="textarea-feedback-message"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (message.trim()) {
                submitMutation.mutate(message.trim());
              }
            }}
            disabled={!message.trim() || submitMutation.isPending}
            data-testid="button-submit-feedback"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>

      <Button
        onClick={() => setOpen((v) => !v)}
        data-testid="button-open-feedback"
        title="Send Feedback"
        className="pointer-events-auto"
      >
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        Provide Feedback
      </Button>
    </div>
  );
}
