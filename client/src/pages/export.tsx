import { useState, useEffect } from "react";
import { usePersistedFilter } from "@/hooks/use-persisted-filter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx";
import type { OkrWithDetails, QuarterlyUpdate, Spu, StaffWithDetails } from "@shared/schema";
import { getPlanningYear, parseMultiSelectField, PLANNING_YEARS, ALL_QUARTERS_LABEL, QUARTERS, formatPlanYearLabel } from "@shared/schema";

const NO_KR_LABEL = "(No Key Result)";

function sanitizeSheetName(name: string, used: Set<string>): string {
  let cleaned = name.replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) cleaned = "Sheet";
  if (cleaned.length > 31) cleaned = cleaned.slice(0, 31);
  let candidate = cleaned;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export default function Export() {
  const { toast } = useToast();
  const [quarterFilter, setQuarterFilter] = usePersistedFilter("export:quarter", "All");
  const [yearFilter, setYearFilter] = usePersistedFilter("export:year", "All");
  const [planningYearFilter, setPlanningYearFilter] = usePersistedFilter("export:planningYear", "All");
  const [spuFilter, setSpuFilter] = usePersistedFilter("export:spu", "All");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);

  const { data: okrs } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: updates } = useQuery<QuarterlyUpdate[]>({
    queryKey: ["/api/quarterly-updates"],
  });

  const { data: session } = useQuery<{ authenticated: boolean; selectedStaff?: StaffWithDetails }>({
    queryKey: ["/api/auth/session"],
  });
  const isSuperAdmin = session?.selectedStaff?.role === "super_admin";

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;

  const availableYears = okrs
    ? Array.from(new Set(okrs.map(o => o.year))).sort((a, b) => b - a)
    : [];
  const YEARS = ["All", ...availableYears.map(String)];

  useEffect(() => {
    if (yearFilter === "All" && availableYears.length > 0) {
      setYearFilter(String(availableYears[0]));
    }
  }, [availableYears.length]);

  const activeFilterCount = [
    quarterFilter !== "All",
    yearFilter !== "All" && yearFilter !== (availableYears.length > 0 ? String(availableYears[0]) : "All"),
    planningYearFilter !== "All",
    spuFilter !== "All",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setQuarterFilter("All");
    setYearFilter(availableYears.length > 0 ? String(availableYears[0]) : "All");
    setPlanningYearFilter("All");
    setSpuFilter("All");
  };

  const filteredOkrs = okrs?.filter((okr) => {
    const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
    const yearMatch = yearFilter === "All" || String(okr.year) === yearFilter;
    const planningYearMatch = planningYearFilter === "All" || getPlanningYear(okr.quarter, okr.year, planStartYear) === parseInt(planningYearFilter);
    const spuMatch = spuFilter === "All" || okr.spuId === spuFilter;
    return quarterMatch && yearMatch && planningYearMatch && spuMatch;
  }) || [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (quarterFilter !== "All") params.append("quarter", quarterFilter);
      if (yearFilter !== "All") params.append("year", yearFilter);
      if (planningYearFilter !== "All") params.append("planningYear", planningYearFilter);
      if (spuFilter !== "All") params.append("spuId", spuFilter);

      const response = await fetch(`/api/export/csv?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `okrs_export_${quarterFilter}_${yearFilter}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your OKR data has been downloaded as a CSV file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const buildOkrRow = (okr: OkrWithDetails) => {
    const okrUpdates = (updates || []).filter((u) => u.okrId === okr.id);
    const primary = okrUpdates.filter((u) => u.isPrimaryScore !== false);
    const latest = (primary.length > 0 ? primary : okrUpdates).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    )[0];

    let krScoresReadable = "";
    if (latest?.keyResultScores) {
      try {
        const scores = Array.isArray(latest.keyResultScores)
          ? latest.keyResultScores
          : JSON.parse(latest.keyResultScores as unknown as string);
        krScoresReadable = scores
          .map((kr: any) => `KR${kr.keyResultNumber}: ${kr.score}%`)
          .join("; ");
      } catch {
        krScoresReadable = String(latest.keyResultScores);
      }
    }

    return {
      "Staff Name": okr.staff?.name || "",
      "Email": okr.staff?.email || "",
      "Staff Primary SPU": okr.staff?.spu?.name || "",
      "Staff Sub-Unit": okr.staff?.subUnit?.name || "",
      "OKR Submitted for SPU": okr.spu?.name || "",
      "OKR Submitted for Sub-Unit": okr.subUnit?.name || "",
      "Collaboration SPU":
        okr.collaborationSpus && okr.collaborationSpus.length > 0
          ? okr.collaborationSpus.map((s: Spu) => s.name).join(", ")
          : (okr.collaborationSpu?.name || ""),
      "Collaboration Sub-Unit":
        okr.collaborationSubUnits && okr.collaborationSubUnits.length > 0
          ? okr.collaborationSubUnits.map((su) => su.spuName ? `${su.spuName} — ${su.name}` : su.name).join(", ")
          : "",
      "Collaboration Orphan IDs":
        okr.orphanCollaboratorIds && okr.orphanCollaboratorIds.length > 0
          ? okr.orphanCollaboratorIds.join(", ")
          : "",
      "Quarter": okr.quarter,
      "Year": okr.year,
      "OKR Number": okr.okrNumber,
      "University Objective": parseMultiSelectField(okr.universityObjective).join("; "),
      "University Key Result": parseMultiSelectField(okr.universityKeyResult).join("; "),
      "Objective Statement": okr.objectiveStatement,
      "Key Results": typeof okr.keyResults === "string"
        ? okr.keyResults
        : JSON.stringify(okr.keyResults),
      "Current %": okr.currentValue,
      "Status": okr.status,
      "Created Date": okr.createdAt ? new Date(okr.createdAt).toISOString().split("T")[0] : "",
      "Latest Update Quarter": latest?.quarter || "",
      "Latest Update Year": latest ? String(latest.year) : "",
      "Latest Update Avg Score": latest?.averageScore ?? "",
      "Latest Update KR Scores": krScoresReadable,
      "Latest Update Additional Key Results": latest?.additionalKeyResults || "",
      "Latest Update Notes": latest?.notes || "",
      "Latest Update Date": latest ? new Date(latest.submittedAt).toISOString().split("T")[0] : "",
    };
  };

  const handleExportXlsxByKr = async () => {
    setIsExportingXlsx(true);
    try {
      // Group OKRs by university key result. An OKR with multiple KRs appears
      // on every matching tab.
      const groups = new Map<string, OkrWithDetails[]>();
      for (const okr of filteredOkrs) {
        const krs = parseMultiSelectField(okr.universityKeyResult);
        const labels = krs.length > 0 ? krs : [NO_KR_LABEL];
        for (const label of labels) {
          const key = (label || NO_KR_LABEL).trim() || NO_KR_LABEL;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(okr);
        }
      }

      if (groups.size === 0) {
        toast({
          title: "Nothing to export",
          description: "No OKRs match the current filters.",
          variant: "destructive",
        });
        setIsExportingXlsx(false);
        return;
      }

      const wb = XLSX.utils.book_new();
      const usedNames = new Set<string>();

      // Summary tab listing the KRs and OKR counts per tab.
      const summaryRows = Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kr, list]) => ({
          "University Key Result": kr,
          "OKR Count": list.length,
        }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet["!cols"] = [{ wch: 80 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, sanitizeSheetName("Summary", usedNames));

      const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
      for (const [krLabel, krOkrs] of sortedEntries) {
        const rows = krOkrs.map(buildOkrRow);
        const sheet = XLSX.utils.json_to_sheet(rows);
        // Auto-width estimate
        if (rows.length > 0) {
          const cols = Object.keys(rows[0]).map((header) => {
            const maxLen = Math.max(
              header.length,
              ...rows.map((r) => {
                const v = (r as any)[header];
                return v == null ? 0 : String(v).length;
              }),
            );
            return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
          });
          sheet["!cols"] = cols;
        }
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(krLabel, usedNames));
      }

      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `okrs_by_key_result_${quarterFilter}_${yearFilter}_${date}.xlsx`);

      toast({
        title: "Export Successful",
        description: `Workbook created with ${groups.size} key-result tab${groups.size === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      console.error("[export] xlsx by KR failed:", error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the workbook. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingXlsx(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-semibold">Export OKR Data</CardTitle>
              <CardDescription className="mt-1">
                Download OKR data as CSV for further analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-md space-y-4">
            <h3 className="font-semibold text-base">Export Options</h3>
            
            <div className="flex items-end gap-3 flex-wrap">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters" className="mb-0.5">
                  <X className="h-4 w-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="export-quarter">Quarter</Label>
                <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                  <SelectTrigger id="export-quarter" data-testid="select-export-quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All" data-testid="option-export-quarter-All">
                      {ALL_QUARTERS_LABEL}
                    </SelectItem>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q.value} value={q.value} data-testid={`option-export-quarter-${q.value}`}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-year">Year</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger id="export-year" data-testid="select-export-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y} data-testid={`option-export-year-${y}`}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-planning-year">Plan Year</Label>
                <Select value={planningYearFilter} onValueChange={setPlanningYearFilter}>
                  <SelectTrigger id="export-planning-year" data-testid="select-export-planning-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Plan Years</SelectItem>
                    {PLANNING_YEARS.map((py) => (
                      <SelectItem key={py} value={String(py)} data-testid={`option-export-planning-year-${py}`}>
                        {formatPlanYearLabel(py, planStartYear)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-spu">SPU</Label>
                <Select value={spuFilter} onValueChange={setSpuFilter}>
                  <SelectTrigger id="export-spu" data-testid="select-export-spu">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All" data-testid="option-export-spu-all">All SPUs</SelectItem>
                    {spus?.map((spu) => (
                      <SelectItem key={spu.id} value={spu.id} data-testid={`option-export-spu-${spu.id}`}>
                        {spu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Card className="bg-card border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold mb-1">Export Preview</h4>
                  <p className="text-sm text-muted-foreground">
                    {filteredOkrs.length} OKR{filteredOkrs.length !== 1 ? "s" : ""} will be exported
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Format</p>
                  <p className="font-medium">CSV</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Export will include:</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-5">
              <li className="list-disc">Staff name, email, and primary SPU</li>
              <li className="list-disc">OKR submitted for SPU and sub-unit</li>
              <li className="list-disc">OKR number, university objectives, key results, and timeline (quarter/year)</li>
              <li className="list-disc">Objective statement and progress</li>
              <li className="list-disc">Status and submission dates</li>
              <li className="list-disc">Collaboration SPU information (if applicable)</li>
              <li className="list-disc">All quarterly update notes and timestamps</li>
            </ul>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={handleExport}
              disabled={isExporting || filteredOkrs.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Download CSV"}
            </Button>
          </div>

          {isSuperAdmin && (
            <Card className="bg-card border" data-testid="card-export-xlsx-by-kr">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">Excel Workbook by Key Result</h4>
                  <p className="text-sm text-muted-foreground">
                    Generates an .xlsx file with one tab per university key result. OKRs that
                    list multiple key results will appear on each matching tab. A Summary tab
                    lists every key result and its OKR count. Available to super admins only.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleExportXlsxByKr}
                    disabled={isExportingXlsx || filteredOkrs.length === 0 || !updates}
                    data-testid="button-export-xlsx-by-kr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExportingXlsx ? "Building workbook..." : "Download Excel (by KR)"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
