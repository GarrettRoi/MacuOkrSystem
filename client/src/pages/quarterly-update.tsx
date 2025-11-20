import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffWithDetails, OkrWithDetails } from "@shared/schema";
import { insertQuarterlyUpdateSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

const formSchema = insertQuarterlyUpdateSchema.extend({
  notes: z.string().min(10, "Update notes must be at least 10 characters"),
  progress: z.coerce.number().min(0, "Progress must be at least 0").max(100, "Progress cannot exceed 100"),
});

type FormValues = z.infer<typeof formSchema>;

interface QuarterlyUpdateProps {
  staff: StaffWithDetails;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function QuarterlyUpdate({ staff }: QuarterlyUpdateProps) {
  const { toast } = useToast();
  const [selectedOkr, setSelectedOkr] = useState<OkrWithDetails | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: okrs, isLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs", staff.id],
  });

  const staffOkrs = okrs?.filter((okr) => okr.staffId === staff.id) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      okrId: "",
      staffId: staff.id,
      quarter: "",
      year: currentYear,
      progress: 0,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", "/api/quarterly-updates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quarterly-updates"] });
      setIsSubmitted(true);
      toast({
        title: "Update Submitted Successfully",
        description: "Your quarterly update has been recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    setSelectedOkr(null);
    form.reset({
      okrId: "",
      staffId: staff.id,
      quarter: "",
      year: currentYear,
      progress: 0,
      notes: "",
    });
  };

  if (isSubmitted) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Update Submitted Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your quarterly progress update has been recorded in the system.
            </p>
            <Button onClick={handleSubmitAnother} data-testid="button-submit-another-update">
              Submit Another Update
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Submit Quarterly Update</CardTitle>
          <CardDescription>
            Update progress on your existing OKRs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : staffOkrs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-semibold mb-2">No OKRs Found</h3>
              <p className="text-muted-foreground mb-6">
                You haven't submitted any OKRs yet. Please submit an OKR first before adding updates.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground">Staff Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-name">{staff.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Primary SPU</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-spu">{staff.spu.name}</p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="okrId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select OKR *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const okr = staffOkrs.find((o) => o.id === value);
                          setSelectedOkr(okr || null);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-okr">
                            <SelectValue placeholder="Choose an OKR to update" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staffOkrs.map((okr) => (
                            <SelectItem key={okr.id} value={okr.id} data-testid={`option-okr-${okr.id}`}>
                              {okr.okrNumber} - {okr.objectiveStatement.substring(0, 60)}{okr.objectiveStatement.length > 60 ? '...' : ''} ({okr.quarter} {okr.year})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedOkr && (
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-2">OKR Details</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Objective Statement</p>
                          <p className="text-sm">{selectedOkr.objectiveStatement}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Key Results</p>
                          {(() => {
                            try {
                              const keyResults = JSON.parse(selectedOkr.keyResults);
                              return (
                                <ul className="text-sm space-y-1 mt-1">
                                  {keyResults.map((kr: any, idx: number) => (
                                    <li key={idx}>• {kr.description} ({kr.percentage}%)</li>
                                  ))}
                                </ul>
                              );
                            } catch {
                              return <p className="text-sm">{selectedOkr.keyResults}</p>;
                            }
                          })()}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">Current Progress: {selectedOkr.currentValue}%</span>
                        </div>
                        <div>
                          <Progress value={selectedOkr.currentValue} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="quarter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Update Quarter *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-update-quarter">
                              <SelectValue placeholder="Select quarter" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {QUARTERS.map((q) => (
                              <SelectItem key={q} value={q} data-testid={`option-update-quarter-${q}`}>
                                {q}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Update Year *</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-update-year">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {YEARS.map((year) => (
                              <SelectItem key={year} value={String(year)} data-testid={`option-update-year-${year}`}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Progress % *</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            {...field}
                            className="w-full"
                            data-testid="input-progress-slider"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-semibold" data-testid="text-progress-value">
                              {field.value}%
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              {...field}
                              className="w-20 text-right border rounded px-2 py-1"
                              data-testid="input-progress-number"
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your current progress toward the target
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Update Notes *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your progress, challenges, and next steps..."
                          className="min-h-32 resize-none"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide details about your progress this quarter
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={mutation.isPending}
                    data-testid="button-submit-update"
                  >
                    {mutation.isPending ? "Submitting..." : "Submit Update"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
