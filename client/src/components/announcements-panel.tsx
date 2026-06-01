import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Megaphone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Spu, Year, Announcement } from "@shared/schema";
import { QUARTERS } from "@shared/schema";

type AudienceType = "all" | "spu_ids" | "spus_missing_score";

type PushSubscriber = {
  staffId: string;
  name: string;
  email: string;
  role: string;
  deviceCount: number;
  lastSubscribedAt: string;
};

function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "leader":
      return "Leader";
    case "cabinet":
      return "Cabinet";
    case "basic":
      return "Staff";
    default:
      return role;
  }
}

function currentQuarter(): string {
  const m = new Date().getMonth(); // 0-11
  if (m >= 5 && m <= 7) return "Q1";
  if (m >= 8 && m <= 10) return "Q2";
  if (m === 11 || m <= 1) return "Q3";
  return "Q4";
}

export default function AnnouncementsPanel() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [selectedSpus, setSelectedSpus] = useState<string[]>([]);
  const [quarter, setQuarter] = useState<string>(currentQuarter());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const { data: spus = [] } = useQuery<Spu[]>({ queryKey: ["/api/spus"] });
  const { data: years = [] } = useQuery<Year[]>({ queryKey: ["/api/years"] });
  const { data: history = [], isLoading: historyLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery<PushSubscriber[]>({
    queryKey: ["/api/push/subscribers"],
  });

  const yearOptions = useMemo(() => {
    const ys = years.map((y) => y.year).sort((a, b) => b - a);
    if (!ys.includes(year)) ys.unshift(year);
    return ys;
  }, [years, year]);

  const sortedSpus = useMemo(
    () => [...spus].sort((a, b) => a.name.localeCompare(b.name)),
    [spus]
  );

  const fillMissingMutation = useMutation<{ spuIds: string[] }, Error, { quarter: string; year: number }>({
    mutationFn: async (vars) => {
      const r = await apiRequest(
        "GET",
        `/api/announcements/spus-missing-score?quarter=${encodeURIComponent(vars.quarter)}&year=${vars.year}`
      );
      return r.json();
    },
    onSuccess: (data) => {
      setAudienceType("spu_ids");
      setSelectedSpus(data.spuIds);
      toast({
        title: data.spuIds.length === 0 ? "All SPUs scored" : "SPUs filled in",
        description:
          data.spuIds.length === 0
            ? `Every SPU with OKRs in ${quarter} ${year} has at least one score.`
            : `${data.spuIds.length} SPU${data.spuIds.length === 1 ? "" : "s"} have no score for ${quarter} ${year}.`,
      });
    },
    onError: () => toast({ title: "Failed to load SPUs", variant: "destructive" }),
  });

  const sendMutation = useMutation<Announcement, Error, void>({
    mutationFn: async () => {
      const audience =
        audienceType === "all"
          ? { type: "all" as const }
          : audienceType === "spu_ids"
            ? { type: "spu_ids" as const, spuIds: selectedSpus }
            : { type: "spus_missing_score" as const, quarter, year };
      const r = await apiRequest("POST", "/api/announcements", {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
        audience,
      });
      return r.json();
    },
    onSuccess: (rec) => {
      toast({
        title: "Announcement sent",
        description: `Delivered to ${rec.successCount}/${rec.recipientCount} subscribers.`,
      });
      setTitle("");
      setBody("");
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (err) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendMutation.isPending &&
    (audienceType === "all" ||
      (audienceType === "spu_ids" && selectedSpus.length > 0) ||
      audienceType === "spus_missing_score");

  const spuName = (id: string) => spus.find((s) => s.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Send Announcement
          </CardTitle>
          <CardDescription>
            Push a notification to staff who have enabled announcement notifications. Notifications appear even when the
            app's tab is closed (provided the browser is running).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              maxLength={120}
              placeholder="Quarterly scores due Friday"
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-announcement-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea
              id="ann-body"
              value={body}
              maxLength={500}
              rows={3}
              placeholder="Please submit your Q1 scores by end of day Friday."
              onChange={(e) => setBody(e.target.value)}
              data-testid="input-announcement-body"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-url">Link URL (optional)</Label>
            <Input
              id="ann-url"
              value={url}
              placeholder="/quarterly-update"
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-announcement-url"
            />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-medium">Audience</Label>
            <Select value={audienceType} onValueChange={(v) => setAudienceType(v as AudienceType)}>
              <SelectTrigger className="max-w-md" data-testid="select-audience-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subscribers</SelectItem>
                <SelectItem value="spu_ids">Specific SPUs</SelectItem>
                <SelectItem value="spus_missing_score">SPUs missing a score this quarter</SelectItem>
              </SelectContent>
            </Select>

            {audienceType === "spu_ids" && (
              <div className="space-y-3 p-3 border rounded-md">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={quarter} onValueChange={setQuarter}>
                    <SelectTrigger className="w-40" data-testid="select-fill-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map((q) => (
                        <SelectItem key={q.value} value={q.value}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                    <SelectTrigger className="w-28" data-testid="select-fill-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => fillMissingMutation.mutate({ quarter, year })}
                    disabled={fillMissingMutation.isPending}
                    data-testid="button-fill-missing-spus"
                  >
                    {fillMissingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Select SPUs missing score
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedSpus([])}
                    disabled={selectedSpus.length === 0}
                    data-testid="button-clear-spus"
                  >
                    Clear
                  </Button>
                  <span className="text-sm text-muted-foreground">{selectedSpus.length} selected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                  {sortedSpus.map((s) => {
                    const checked = selectedSpus.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                        data-testid={`row-spu-checkbox-${s.id}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelectedSpus((prev) =>
                              v ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                            )
                          }
                        />
                        <span className="text-sm">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {audienceType === "spus_missing_score" && (
              <div className="flex items-center gap-2 flex-wrap p-3 border rounded-md">
                <span className="text-sm text-muted-foreground">For</span>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="w-40" data-testid="select-missing-quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                  <SelectTrigger className="w-28" data-testid="select-missing-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Recipients are computed at send time.
                </span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={() => sendMutation.mutate()} disabled={!canSend} data-testid="button-send-announcement">
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Announcement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Notification Subscribers
          </CardTitle>
          <CardDescription>
            Staff who have turned on announcement notifications. These people will receive your pushes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscribersLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-subscribers">
              No one has enabled notifications yet. Staff can turn them on with the bell icon in the app header.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground" data-testid="text-subscriber-count">
                {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-2">
                {subscribers.map((sub) => (
                  <div
                    key={sub.staffId}
                    className="flex items-center justify-between gap-3 flex-wrap p-3 border rounded-md"
                    data-testid={`row-subscriber-${sub.staffId}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate" data-testid={`text-subscriber-name-${sub.staffId}`}>
                        {sub.name}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{sub.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{roleLabel(sub.role)}</Badge>
                      {sub.deviceCount > 1 && (
                        <Badge variant="secondary">{sub.deviceCount} devices</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
          <CardDescription>Last 100 announcements sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements have been sent yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((a) => (
                <div
                  key={a.id}
                  className="p-3 border rounded-md space-y-1"
                  data-testid={`row-announcement-${a.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-announcement-title-${a.id}`}>{a.title}</span>
                    <Badge variant="secondary">
                      {a.successCount}/{a.recipientCount} delivered
                    </Badge>
                    {a.failureCount > 0 && <Badge variant="destructive">{a.failureCount} failed</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>By {a.sentByName}</span>
                    <span>•</span>
                    <span>{new Date(a.sentAt as unknown as string).toLocaleString()}</span>
                    <span>•</span>
                    <span>
                      Audience:{" "}
                      {a.audienceType === "all"
                        ? "All subscribers"
                        : a.audienceType === "spus_missing_score"
                          ? `SPUs missing score (${a.audienceQuarter} ${a.audienceYear})`
                          : `${(a.audienceSpuIds || []).length} SPU(s)`}
                    </span>
                    {a.url && (
                      <>
                        <span>•</span>
                        <span>Link: {a.url}</span>
                      </>
                    )}
                  </div>
                  {a.audienceType !== "all" && (a.audienceSpuIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(a.audienceSpuIds || []).map((id) => (
                        <Badge key={id} variant="outline" className="text-xs">
                          {spuName(id)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
