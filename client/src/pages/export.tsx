import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet } from "lucide-react";
import type { OkrWithDetails } from "@shared/schema";

const QUARTERS = ["All", "Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();
const YEARS = ["All", String(currentYear - 1), String(currentYear), String(currentYear + 1)];

export default function Export() {
  const { toast } = useToast();
  const [quarterFilter, setQuarterFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [isExporting, setIsExporting] = useState(false);

  const { data: okrs } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs"],
  });

  const filteredOkrs = okrs?.filter((okr) => {
    const quarterMatch = quarterFilter === "All" || okr.quarter === quarterFilter;
    const yearMatch = yearFilter === "All" || String(okr.year) === yearFilter;
    return quarterMatch && yearMatch;
  }) || [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (quarterFilter !== "All") params.append("quarter", quarterFilter);
      if (yearFilter !== "All") params.append("year", yearFilter);

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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="export-quarter">Quarter</Label>
                <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                  <SelectTrigger id="export-quarter" data-testid="select-export-quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q} value={q} data-testid={`option-export-quarter-${q}`}>
                        {q}
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
              <li className="list-disc">Staff name, email, primary SPU, and sub-unit</li>
              <li className="list-disc">OKR title, description, and timeline (quarter/year)</li>
              <li className="list-disc">Target values and current progress</li>
              <li className="list-disc">Status and submission dates</li>
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
        </CardContent>
      </Card>
    </div>
  );
}
