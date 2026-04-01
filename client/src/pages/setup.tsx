import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Upload,
  Download,
  ChevronRight,
  Building2,
  Target,
  Users,
  Loader2,
  TriangleAlert,
  FileSpreadsheet,
} from "lucide-react";

type Step = "welcome" | "spu-staff" | "objectives" | "done";
type SubStep = "upload" | "preview" | "importing";

interface SpuPreview {
  name: string;
  admin: string;
  subUnits: { name: string; memberCount: number; members: string[] }[];
  directMemberCount: number;
  directMembers: string[];
}

interface SpuStaffPreview {
  spus: SpuPreview[];
  totals: { spus: number; subUnits: number; staff: number };
}

interface ObjKeyResult { number: string; description: string }
interface ObjPreview { number: string; title: string; keyResults: ObjKeyResult[]; years: number[] }
interface ObjectivesPreview {
  objectives: ObjPreview[];
  totals: { objectives: number; keyResults: number };
}

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("welcome");
  const [spuSubStep, setSpuSubStep] = useState<SubStep>("upload");
  const [objSubStep, setObjSubStep] = useState<SubStep>("upload");
  const [spuCsvData, setSpuCsvData] = useState("");
  const [objCsvData, setObjCsvData] = useState("");
  const [spuPreview, setSpuPreview] = useState<SpuStaffPreview | null>(null);
  const [objPreview, setObjPreview] = useState<ObjectivesPreview | null>(null);
  const [spuDone, setSpuDone] = useState(false);
  const [objDone, setObjDone] = useState(false);
  const spuFileRef = useRef<HTMLInputElement>(null);
  const objFileRef = useRef<HTMLInputElement>(null);

  const spuPreviewMutation = useMutation<SpuStaffPreview, Error, string>({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/setup/preview/spu-staff", { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      setSpuPreview(data);
      setSpuSubStep("preview");
    },
    onError: (err) => toast({ title: "Parse Error", description: err.message, variant: "destructive" }),
  });

  const spuConfirmMutation = useMutation<unknown, Error, string>({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/setup/confirm/spu-staff", { csvData });
      return res.json();
    },
    onSuccess: () => {
      setSpuDone(true);
      setSpuSubStep("upload");
      toast({ title: "SPU & Staff Imported", description: "All SPUs, sub-units, and staff have been created." });
    },
    onError: (err) => toast({ title: "Import Error", description: err.message, variant: "destructive" }),
  });

  const objPreviewMutation = useMutation<ObjectivesPreview, Error, string>({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/setup/preview/objectives", { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      setObjPreview(data);
      setObjSubStep("preview");
    },
    onError: (err) => toast({ title: "Parse Error", description: err.message, variant: "destructive" }),
  });

  const objConfirmMutation = useMutation<unknown, Error, string>({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/setup/confirm/objectives", { csvData });
      return res.json();
    },
    onSuccess: () => {
      setObjDone(true);
      setObjSubStep("upload");
      toast({ title: "Objectives Imported", description: "All university objectives and key results have been created." });
    },
    onError: (err) => toast({ title: "Import Error", description: err.message, variant: "destructive" }),
  });

  const completeMutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/setup/complete", {});
      return res.json();
    },
    onSuccess: () => onComplete(),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleFileRead(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    onReady: (csv: string) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setter(text);
      onReady(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function downloadExample(type: "spu-staff" | "objectives") {
    window.open(`/api/setup/example-csv/${type}`, "_blank");
  }

  const steps: { id: Step; label: string; icon: React.ReactNode; done: boolean }[] = [
    { id: "spu-staff", label: "SPUs & Staff", icon: <Building2 className="h-4 w-4" />, done: spuDone },
    { id: "objectives", label: "University Objectives", icon: <Target className="h-4 w-4" />, done: objDone },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
          <FileSpreadsheet className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">MACU OKR System</h1>
          <p className="text-xs text-muted-foreground">Initial Setup</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-2xl space-y-6">

          {/* Step progress */}
          {step !== "welcome" && step !== "done" && (
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    step === s.id ? "bg-primary text-primary-foreground" :
                    s.done ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {s.done ? <CheckCircle2 className="h-3 w-3" /> : s.icon}
                    {s.label}
                  </div>
                  {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
          )}

          {/* ── Welcome ── */}
          {step === "welcome" && (
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <FileSpreadsheet className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome to MACU OKR Setup</CardTitle>
                <CardDescription className="text-base max-w-md mx-auto">
                  Let's get your environment ready. This wizard will walk you through importing the foundational data your system needs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { icon: <Building2 className="h-5 w-5 text-blue-500" />, title: "Step 1 — SPUs & Staff", desc: "Import your schools, departments, and units along with their admin and team members." },
                    { icon: <Target className="h-5 w-5 text-purple-500" />, title: "Step 2 — University Objectives", desc: "Import the strategic objectives and key results that OKRs will align to." },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                      <div className="mt-0.5">{item.icon}</div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">You can skip any step and import data later through the Admin panel.</p>
                <div className="flex justify-center pt-2">
                  <Button data-testid="button-start-setup" onClick={() => setStep("spu-staff")}>
                    Begin Setup <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── SPU & Staff ── */}
          {step === "spu-staff" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" /> SPUs & Staff
                    </CardTitle>
                    <CardDescription>Import your organizational structure and staff from a CSV file.</CardDescription>
                  </div>
                  {spuDone && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-active-elevate"><CheckCircle2 className="h-3 w-3 mr-1" />Imported</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {spuSubStep === "upload" && (
                  <>
                    <div className="p-4 rounded-md border bg-muted/40 space-y-2">
                      <p className="text-sm font-medium">Expected TSV format (tab-separated)</p>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b">
                              {["Primary SPU", "Sub-units"].map(h => (
                                <th key={h} className="text-left py-1 pr-4 font-mono text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-muted-foreground">
                            <tr>
                              <td className="py-1 pr-4">School of Business</td>
                              <td className="py-1 pr-4">Sch. of Bus. - Accounting</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-4">School of Business</td>
                              <td className="py-1 pr-4">Sch. of Bus. - Management</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-4">Financial Aid</td>
                              <td className="py-1 pr-4"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
                        <li>• Use one row per sub-unit. Repeat the SPU name for each sub-unit.</li>
                        <li>• Leave Sub-units blank for SPUs with no sub-units.</li>
                        <li>• Export from Excel or Google Sheets as a .tsv or tab-separated file.</li>
                      </ul>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => downloadExample("spu-staff")} data-testid="button-download-spu-template">
                        <Download className="h-4 w-4 mr-1.5" /> Download Template
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => spuFileRef.current?.click()}
                        disabled={spuPreviewMutation.isPending}
                        data-testid="button-upload-spu-csv"
                      >
                        {spuPreviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                        {spuPreviewMutation.isPending ? "Parsing…" : "Upload TSV File"}
                      </Button>
                      <input ref={spuFileRef} type="file" className="hidden"
                        onChange={e => handleFileRead(e, setSpuCsvData, csv => spuPreviewMutation.mutate(csv))} />
                    </div>
                  </>
                )}

                {spuSubStep === "preview" && spuPreview && (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" data-testid="badge-spu-count">{spuPreview.totals.spus} SPUs</Badge>
                      <Badge variant="secondary" data-testid="badge-subunit-count">{spuPreview.totals.subUnits} Sub-Units</Badge>
                      <Badge variant="secondary" data-testid="badge-staff-count">{spuPreview.totals.staff} Staff Members</Badge>
                    </div>
                    <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                      {spuPreview.spus.map(spu => (
                        <div key={spu.name} className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{spu.name}
                            </p>
                            {spu.admin && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Admin: {spu.admin}</span>}
                          </div>
                          {spu.subUnits.map(su => (
                            <div key={su.name} className="ml-4 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{su.name}</span> — {su.memberCount} member{su.memberCount !== 1 ? "s" : ""}
                              {su.members.length > 0 && <span className="ml-1">({su.members.join(", ")})</span>}
                            </div>
                          ))}
                          {spu.directMemberCount > 0 && (
                            <div className="ml-4 text-xs text-muted-foreground">
                              Direct: {spu.directMembers.join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => { setSpuSubStep("upload"); setSpuPreview(null); }} data-testid="button-spu-back">
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => spuConfirmMutation.mutate(spuCsvData)}
                        disabled={spuConfirmMutation.isPending}
                        data-testid="button-spu-confirm"
                      >
                        {spuConfirmMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                        {spuConfirmMutation.isPending ? "Importing…" : "Confirm Import"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── University Objectives ── */}
          {step === "objectives" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" /> University Objectives
                    </CardTitle>
                    <CardDescription>Import the strategic objectives and their key results.</CardDescription>
                  </div>
                  {objDone && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-active-elevate"><CheckCircle2 className="h-3 w-3 mr-1" />Imported</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {objSubStep === "upload" && (
                  <>
                    <div className="p-4 rounded-md border bg-muted/40 space-y-2">
                      <p className="text-sm font-medium">Expected CSV format</p>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b">
                              {["Objective Number", "Objective Title", "Key Result Number", "Key Result Description", "Applicable Years"].map(h => (
                                <th key={h} className="text-left py-1 pr-4 font-mono text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-muted-foreground">
                            <tr>
                              <td className="py-1 pr-4">1</td>
                              <td className="py-1 pr-4">Strategic Growth</td>
                              <td className="py-1 pr-4">1</td>
                              <td className="py-1 pr-4">Increase enrollment to 2000</td>
                              <td className="py-1 pr-4">2024;2025</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-4">1</td>
                              <td className="py-1 pr-4">Strategic Growth</td>
                              <td className="py-1 pr-4">2</td>
                              <td className="py-1 pr-4">Improve retention rate</td>
                              <td className="py-1 pr-4">2024;2025</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
                        <li>• One row per key result — repeat objective number and title for each KR</li>
                        <li>• Applicable Years are semicolon-separated calendar years (e.g. 2024;2025)</li>
                        <li>• Leave Applicable Years blank to apply to all years</li>
                      </ul>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => downloadExample("objectives")} data-testid="button-download-objectives-template">
                        <Download className="h-4 w-4 mr-1.5" /> Download Template
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => objFileRef.current?.click()}
                        disabled={objPreviewMutation.isPending}
                        data-testid="button-upload-objectives-csv"
                      >
                        {objPreviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                        {objPreviewMutation.isPending ? "Parsing…" : "Upload CSV"}
                      </Button>
                      <input ref={objFileRef} type="file" className="hidden"
                        onChange={e => handleFileRead(e, setObjCsvData, csv => objPreviewMutation.mutate(csv))} />
                    </div>
                  </>
                )}

                {objSubStep === "preview" && objPreview && (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" data-testid="badge-obj-count">{objPreview.totals.objectives} Objectives</Badge>
                      <Badge variant="secondary" data-testid="badge-kr-count">{objPreview.totals.keyResults} Key Results</Badge>
                    </div>
                    <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                      {objPreview.objectives.map(obj => (
                        <div key={obj.number} className="p-3 space-y-1.5">
                          <p className="text-sm font-medium">
                            <span className="text-muted-foreground text-xs mr-1.5">#{obj.number}</span>{obj.title}
                            {obj.years.length > 0 && <span className="ml-2 text-xs text-muted-foreground">({obj.years.join(", ")})</span>}
                          </p>
                          {obj.keyResults.map(kr => (
                            <div key={kr.number} className="ml-4 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">KR {kr.number}:</span> {kr.description}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => { setObjSubStep("upload"); setObjPreview(null); }} data-testid="button-obj-back">
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => objConfirmMutation.mutate(objCsvData)}
                        disabled={objConfirmMutation.isPending}
                        data-testid="button-obj-confirm"
                      >
                        {objConfirmMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                        {objConfirmMutation.isPending ? "Importing…" : "Confirm Import"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Setup Complete</h2>
                  <p className="text-muted-foreground text-sm mt-1">Your system is ready. You can always add more data or adjust settings through the Admin panel.</p>
                </div>
                <Button
                  data-testid="button-finish-setup"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Enter the App
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          {(step === "spu-staff" || step === "objectives") && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (step === "spu-staff") setStep("welcome");
                  if (step === "objectives") setStep("spu-staff");
                }}
                data-testid="button-setup-prev"
              >
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (step === "spu-staff") setStep("objectives");
                    if (step === "objectives") setStep("done");
                  }}
                  data-testid="button-setup-skip"
                >
                  Skip this step
                </Button>
                {((step === "spu-staff" && spuDone) || (step === "objectives" && objDone)) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (step === "spu-staff") setStep("objectives");
                      if (step === "objectives") setStep("done");
                    }}
                    data-testid="button-setup-next"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
