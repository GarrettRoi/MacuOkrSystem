import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { History, Plus, Trash2, Save, Copy, FilePlus2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { StrategicAdvancementData, UniversityYearlySnapshot, YearlySnapshotPayload } from "@shared/schema";

const SNAPSHOTS_KEY = ["/api/strategic-advancement/snapshots"];

function emptyPayload(): YearlySnapshotPayload {
  return { objectives: [] };
}

function fromCurrent(current: StrategicAdvancementData | undefined): YearlySnapshotPayload {
  if (!current) return emptyPayload();
  return {
    objectives: (current.objectives ?? []).map((obj) => ({
      label: obj.label,
      description: obj.description,
      comment: obj.comment ?? "",
      keyResults: (obj.keyResults ?? []).map((kr) => ({
        label: kr.label,
        description: kr.description,
        progressPercent: kr.progressPercent ?? 0,
      })),
    })),
  };
}

export function HistoricalSnapshotsEditor({ currentSnapshot }: { currentSnapshot: StrategicAdvancementData | undefined }) {
  const { toast } = useToast();
  const { data: snapshots = [], isLoading } = useQuery<UniversityYearlySnapshot[]>({ queryKey: SNAPSHOTS_KEY });

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<YearlySnapshotPayload | null>(null);
  const [newYearInput, setNewYearInput] = useState<string>(String(new Date().getFullYear() - 1));

  useEffect(() => {
    if (selectedYear === null) { setDraft(null); return; }
    const found = snapshots.find((s) => s.year === selectedYear);
    setDraft(found ? (JSON.parse(JSON.stringify(found.payload)) as YearlySnapshotPayload) : emptyPayload());
  }, [selectedYear, snapshots]);

  const saveMutation = useMutation({
    mutationFn: async ({ year, payload }: { year: number; payload: YearlySnapshotPayload }) =>
      apiRequest("PUT", `/api/strategic-advancement/snapshots/${year}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
      toast({ title: "Snapshot Saved", description: `Historical snapshot for ${selectedYear} updated.` });
    },
    onError: (err: any) => toast({ title: "Save Failed", description: err?.message ?? "Could not save snapshot.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (year: number) => apiRequest("DELETE", `/api/strategic-advancement/snapshots/${year}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
      setSelectedYear(null);
      toast({ title: "Snapshot Deleted", description: "The historical snapshot was removed." });
    },
    onError: (err: any) => toast({ title: "Delete Failed", description: err?.message ?? "Could not delete snapshot.", variant: "destructive" }),
  });

  const addYear = () => {
    const yr = parseInt(newYearInput, 10);
    if (!Number.isFinite(yr) || yr < 2000 || yr > 2100) {
      toast({ title: "Invalid Year", description: "Enter a year between 2000 and 2100.", variant: "destructive" });
      return;
    }
    setSelectedYear(yr);
  };

  const captureFromCurrent = () => {
    setDraft(fromCurrent(currentSnapshot));
    toast({ title: "Loaded from Current", description: "Editor pre-filled with the current snapshot. Click Save to persist." });
  };

  const handleSave = () => {
    if (selectedYear === null || !draft) return;
    for (const obj of draft.objectives) {
      if (!obj.label.trim() || !obj.description.trim()) {
        toast({ title: "Missing Fields", description: "Every objective needs a label and description.", variant: "destructive" });
        return;
      }
      for (const kr of obj.keyResults) {
        if (!kr.label.trim() || !kr.description.trim()) {
          toast({ title: "Missing Fields", description: "Every key result needs a label and description.", variant: "destructive" });
          return;
        }
      }
    }
    saveMutation.mutate({ year: selectedYear, payload: draft });
  };

  const updateDraft = (updater: (d: YearlySnapshotPayload) => YearlySnapshotPayload) => {
    setDraft((prev) => (prev ? updater(prev) : prev));
  };

  return (
    <Card className="mt-6" data-testid="card-historical-snapshots">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historical Year Snapshots
            </CardTitle>
            <CardDescription>
              Maintain a fully customizable progress snapshot per past year. The achievement page will show one tab per saved year alongside the current snapshot.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Edit existing year</Label>
            <Select
              value={selectedYear !== null && snapshots.some((s) => s.year === selectedYear) ? String(selectedYear) : ""}
              onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
            >
              <SelectTrigger className="w-40" data-testid="select-historical-year">
                <SelectValue placeholder={isLoading ? "Loading..." : snapshots.length === 0 ? "No saved years" : "Select a year"} />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.year} value={String(s.year)} data-testid={`option-historical-year-${s.year}`}>
                    {s.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Or add a new year</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={2000}
                max={2100}
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                className="w-24"
                data-testid="input-new-historical-year"
              />
              <Button variant="outline" onClick={addYear} data-testid="button-add-historical-year">
                <FilePlus2 className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>

        {selectedYear === null || !draft ? (
          <p className="text-sm text-muted-foreground">
            Pick a year above to view, edit, or create a historical snapshot.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap rounded-md bg-muted/40 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono">{selectedYear}</Badge>
                <span className="text-sm text-muted-foreground">
                  {snapshots.some((s) => s.year === selectedYear) ? "Editing existing snapshot." : "New snapshot — not saved yet."}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={captureFromCurrent} data-testid="button-capture-from-current">
                  <Copy className="h-4 w-4 mr-1" /> Pre-fill from Current
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-historical-snapshot">
                  <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save Snapshot"}
                </Button>
                {snapshots.some((s) => s.year === selectedYear) && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(`Delete the ${selectedYear} snapshot? This cannot be undone.`)) {
                        deleteMutation.mutate(selectedYear);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-historical-snapshot"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </div>
            </div>

            {draft.objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No objectives yet. Click "Pre-fill from Current" or add one below.
              </p>
            ) : (
              <div className="space-y-6">
                {draft.objectives.map((obj, oi) => (
                  <div key={oi} className="space-y-3 rounded-md border p-4" data-testid={`historical-objective-${oi}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-end gap-2 flex-wrap flex-1">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Label</Label>
                          <Input
                            value={obj.label}
                            maxLength={50}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((d) => ({
                                ...d,
                                objectives: d.objectives.map((o, i) => (i === oi ? { ...o, label: v } : o)),
                              }));
                            }}
                            className="w-40 font-mono text-xs"
                            placeholder="e.g. UO 1"
                            data-testid={`input-objective-label-${oi}`}
                          />
                        </div>
                        <div className="space-y-1 flex-1 min-w-64">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <Input
                            value={obj.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((d) => ({
                                ...d,
                                objectives: d.objectives.map((o, i) => (i === oi ? { ...o, description: v } : o)),
                              }));
                            }}
                            placeholder="Objective description"
                            data-testid={`input-objective-description-${oi}`}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateDraft((d) => ({ ...d, objectives: d.objectives.filter((_, i) => i !== oi) }))}
                        data-testid={`button-remove-objective-${oi}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      {obj.keyResults.map((kr, ki) => (
                        <div key={ki} className="space-y-2" data-testid={`historical-kr-${oi}-${ki}`}>
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">KR Label</Label>
                              <Input
                                value={kr.label}
                                maxLength={50}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateDraft((d) => ({
                                    ...d,
                                    objectives: d.objectives.map((o, i) =>
                                      i === oi ? { ...o, keyResults: o.keyResults.map((k, j) => (j === ki ? { ...k, label: v } : k)) } : o,
                                    ),
                                  }));
                                }}
                                className="w-32 font-mono text-xs"
                                placeholder="KR 1"
                                data-testid={`input-kr-label-${oi}-${ki}`}
                              />
                            </div>
                            <div className="space-y-1 flex-1 min-w-64">
                              <Label className="text-xs text-muted-foreground">KR Description</Label>
                              <Input
                                value={kr.description}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateDraft((d) => ({
                                    ...d,
                                    objectives: d.objectives.map((o, i) =>
                                      i === oi ? { ...o, keyResults: o.keyResults.map((k, j) => (j === ki ? { ...k, description: v } : k)) } : o,
                                    ),
                                  }));
                                }}
                                placeholder="Key result description"
                                data-testid={`input-kr-description-${oi}-${ki}`}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateDraft((d) => ({
                                  ...d,
                                  objectives: d.objectives.map((o, i) =>
                                    i === oi ? { ...o, keyResults: o.keyResults.filter((_, j) => j !== ki) } : o,
                                  ),
                                }))
                              }
                              data-testid={`button-remove-kr-${oi}-${ki}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[kr.progressPercent]}
                              min={0}
                              max={100}
                              step={1}
                              className="flex-1"
                              onValueChange={([val]) =>
                                updateDraft((d) => ({
                                  ...d,
                                  objectives: d.objectives.map((o, i) =>
                                    i === oi
                                      ? { ...o, keyResults: o.keyResults.map((k, j) => (j === ki ? { ...k, progressPercent: val } : k)) }
                                      : o,
                                  ),
                                }))
                              }
                              data-testid={`slider-historical-kr-${oi}-${ki}`}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={kr.progressPercent}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                updateDraft((d) => ({
                                  ...d,
                                  objectives: d.objectives.map((o, i) =>
                                    i === oi
                                      ? { ...o, keyResults: o.keyResults.map((k, j) => (j === ki ? { ...k, progressPercent: val } : k)) }
                                      : o,
                                  ),
                                }));
                              }}
                              className="w-20 text-center"
                              data-testid={`input-historical-kr-percent-${oi}-${ki}`}
                            />
                            <span className="text-sm text-muted-foreground w-4">%</span>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateDraft((d) => ({
                            ...d,
                            objectives: d.objectives.map((o, i) =>
                              i === oi
                                ? { ...o, keyResults: [...o.keyResults, { label: `KR ${o.keyResults.length + 1}`, description: "", progressPercent: 0 }] }
                                : o,
                            ),
                          }))
                        }
                        data-testid={`button-add-kr-${oi}`}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Key Result
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Leadership Comment</Label>
                      <Textarea
                        value={obj.comment ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateDraft((d) => ({
                            ...d,
                            objectives: d.objectives.map((o, i) => (i === oi ? { ...o, comment: v } : o)),
                          }));
                        }}
                        className="min-h-16 resize-none text-sm"
                        placeholder="Optional commentary for this objective in this year"
                        data-testid={`textarea-historical-comment-${oi}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() =>
                updateDraft((d) => ({
                  ...d,
                  objectives: [
                    ...d.objectives,
                    { label: `UO ${d.objectives.length + 1}`, description: "", comment: "", keyResults: [] },
                  ],
                }))
              }
              data-testid="button-add-historical-objective"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Objective
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HistoricalSnapshotsEditor;
