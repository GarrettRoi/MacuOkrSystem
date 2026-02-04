import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Sparkles, Star, PartyPopper } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffWithDetails, OkrWithDetails, Year } from "@shared/schema";
import { insertQuarterlyUpdateSchema, QUARTERS, getQuarterLabel } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Schema for individual key result score (for internal form use)
const keyResultScoreSchema = z.object({
  keyResultNumber: z.number(),
  description: z.string(),
  score: z.coerce.number().min(0, "Score must be at least 0").max(100, "Score cannot exceed 100"),
});

// Form schema matches what we need for the UI
const formSchema = z.object({
  okrId: z.string().min(1, "Please select an OKR"),
  staffId: z.string(),
  quarter: z.string().min(1, "Please select a quarter"),
  year: z.coerce.number(),
  progress: z.coerce.number().min(0).max(100),
  keyResultScores: z.array(keyResultScoreSchema).min(1, "At least one key result score is required"),
  averageScore: z.coerce.number().min(0).max(100),
  additionalKeyResults: z.string().optional(),
  notes: z.string().min(10, "Please summarize outcomes, challenges, or accomplishments (minimum 10 characters)"),
});

type FormValues = z.infer<typeof formSchema>;

interface QuarterlyUpdateProps {
  staff: StaffWithDetails;
}

const currentYear = new Date().getFullYear();

export default function QuarterlyUpdate({ staff }: QuarterlyUpdateProps) {
  const { toast } = useToast();
  const [selectedOkr, setSelectedOkr] = useState<OkrWithDetails | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // SPU-centric model: Fetch OKRs scoped to user's SPU directly from server
  // Server validates session-based staff belongs to requested SPU
  const { data: spuOkrs, isLoading } = useQuery<OkrWithDetails[]>({
    queryKey: ["/api/okrs/by-spu", staff.spuId],
    queryFn: async () => {
      const response = await fetch(`/api/okrs/by-spu/${staff.spuId}`, {
        credentials: "include", // Include session cookies
      });
      if (!response.ok) throw new Error("Failed to fetch SPU OKRs");
      return response.json();
    },
    enabled: !!staff.spuId,
  });

  const { data: years } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });
  
  // Filter OKRs by selected quarter and year
  const filteredOkrs = (spuOkrs || []).filter((okr) => {
    if (!selectedQuarter || !selectedYear) return false;
    return okr.quarter === selectedQuarter && okr.year === selectedYear;
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      okrId: "",
      staffId: staff.id,
      quarter: "",
      year: currentYear,
      progress: 0,
      keyResultScores: [],
      averageScore: 0,
      additionalKeyResults: "",
      notes: "",
    },
  });

  // Watch key result scores to calculate average
  const keyResultScores = useWatch({
    control: form.control,
    name: "keyResultScores",
  });

  // Auto-calculate average score
  useEffect(() => {
    if (keyResultScores && keyResultScores.length > 0) {
      const validScores = keyResultScores.filter(kr => typeof kr.score === 'number' && !isNaN(kr.score));
      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, kr) => acc + Number(kr.score), 0);
        const average = Math.round(sum / validScores.length);
        form.setValue("averageScore", average);
        form.setValue("progress", average);
      }
    }
  }, [keyResultScores, form]);

  // When OKR is selected, populate key result scores
  const handleOkrSelection = (okrId: string) => {
    const okr = filteredOkrs.find((o) => o.id === okrId);
    setSelectedOkr(okr || null);
    
    if (okr) {
      // Parse key results from the OKR
      let keyResults: any[] = [];
      try {
        if (typeof okr.keyResults === 'string') {
          keyResults = JSON.parse(okr.keyResults);
        } else if (Array.isArray(okr.keyResults)) {
          keyResults = okr.keyResults;
        }
      } catch (e) {
        console.error("Failed to parse key results:", e);
      }

      // Initialize form with key result scores
      const initialScores = keyResults.map((kr, index) => ({
        keyResultNumber: index + 1,
        description: kr.description || `Key Result ${index + 1}`,
        score: 0,
      }));

      form.setValue("keyResultScores", initialScores);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        keyResultScores: JSON.stringify(data.keyResultScores),
        additionalKeyResults: data.additionalKeyResults?.trim() || null,
      };
      return await apiRequest("POST", "/api/quarterly-updates", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/okrs/by-spu", staff.spuId] });
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
    setSelectedQuarter("");
    setSelectedYear(currentYear);
    form.reset({
      okrId: "",
      staffId: staff.id,
      quarter: "",
      year: currentYear,
      progress: 0,
      keyResultScores: [],
      averageScore: 0,
      additionalKeyResults: "",
      notes: "",
    });
  };

  if (isSubmitted) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="overflow-hidden">
          <CardContent className="pt-12 pb-12 text-center relative">
            <style>{`
              @keyframes confetti-fall {
                0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
              }
              @keyframes bounce-in {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes float {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-10px) rotate(5deg); }
              }
              @keyframes sparkle {
                0%, 100% { opacity: 0; transform: scale(0.5); }
                50% { opacity: 1; transform: scale(1); }
              }
              @keyframes slide-up {
                0% { transform: translateY(20px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
              }
              .confetti {
                position: absolute;
                width: 10px;
                height: 10px;
                border-radius: 2px;
                animation: confetti-fall 3s ease-out forwards;
              }
              .bounce-in { animation: bounce-in 0.6s ease-out forwards; }
              .float { animation: float 2s ease-in-out infinite; }
              .sparkle { animation: sparkle 1.5s ease-in-out infinite; }
              .slide-up { animation: slide-up 0.5s ease-out forwards; }
              .slide-up-delay-1 { animation: slide-up 0.5s ease-out 0.2s forwards; opacity: 0; }
              .slide-up-delay-2 { animation: slide-up 0.5s ease-out 0.4s forwards; opacity: 0; }
            `}</style>
            
            <div className="confetti bg-yellow-400" style={{ left: '10%', animationDelay: '0s' }} />
            <div className="confetti bg-green-400" style={{ left: '20%', animationDelay: '0.2s' }} />
            <div className="confetti bg-blue-400" style={{ left: '30%', animationDelay: '0.4s' }} />
            <div className="confetti bg-pink-400" style={{ left: '40%', animationDelay: '0.1s' }} />
            <div className="confetti bg-purple-400" style={{ left: '50%', animationDelay: '0.3s' }} />
            <div className="confetti bg-red-400" style={{ left: '60%', animationDelay: '0.5s' }} />
            <div className="confetti bg-orange-400" style={{ left: '70%', animationDelay: '0.15s' }} />
            <div className="confetti bg-teal-400" style={{ left: '80%', animationDelay: '0.35s' }} />
            <div className="confetti bg-indigo-400" style={{ left: '90%', animationDelay: '0.25s' }} />
            
            <div className="relative">
              <Sparkles className="absolute -top-2 -left-8 h-6 w-6 text-yellow-500 sparkle" style={{ animationDelay: '0s' }} />
              <Sparkles className="absolute -top-4 -right-6 h-5 w-5 text-yellow-400 sparkle" style={{ animationDelay: '0.5s' }} />
              <Star className="absolute top-0 right-0 h-4 w-4 text-yellow-500 sparkle" style={{ animationDelay: '0.75s' }} />
              
              <div className="inline-block bounce-in">
                <div className="relative">
                  <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto float" />
                  <PartyPopper className="absolute -right-4 -top-2 h-8 w-8 text-amber-500 float" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>
            
            <h2 className="text-2xl font-semibold mb-2 mt-6 slide-up">
              Update Submitted Successfully!
            </h2>
            <p className="text-muted-foreground mb-6 slide-up-delay-1">
              Your quarterly progress update has been recorded in the system.
            </p>
            <div className="slide-up-delay-2">
              <Button onClick={handleSubmitAnother} data-testid="button-submit-another-update">
                Submit Another Update
              </Button>
            </div>
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
            Score each key result for your SPU's OKRs and provide a summary of outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Staff Information */}
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground">Staff Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-name">{staff.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-email">{staff.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Primary SPU</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-spu">{staff.spu.name}</p>
                    </div>
                    {staff.subUnit && (
                      <div>
                        <p className="text-sm font-medium">Primary Sub-Unit</p>
                        <p className="text-sm text-muted-foreground" data-testid="text-staff-subunit">{staff.subUnit.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quarter and Year Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="quarter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Year and Quarter *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedQuarter(value);
                            setSelectedOkr(null);
                            form.setValue("okrId", "");
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-update-quarter">
                              <SelectValue placeholder="Select quarter" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {QUARTERS.map((q) => (
                              <SelectItem key={q.value} value={q.value} data-testid={`option-update-quarter-${q.value}`}>
                                {q.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the quarter you are scoring
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year *</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            const yearNum = Number(val);
                            field.onChange(yearNum);
                            setSelectedYear(yearNum);
                            setSelectedOkr(null);
                            form.setValue("okrId", "");
                          }} 
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-update-year">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {years && years.length > 0 ? (
                              years.sort((a, b) => b.year - a.year).map((year) => (
                                <SelectItem key={year.id} value={String(year.year)} data-testid={`option-update-year-${year.year}`}>
                                  {year.year}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-years" disabled>No years available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* OKR Selection - only shown after quarter/year selected */}
                {selectedQuarter && selectedYear && (
                  <FormField
                    control={form.control}
                    name="okrId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Which numbered OKR are you scoring? *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleOkrSelection(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-okr">
                              <SelectValue placeholder="Choose an OKR to score" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredOkrs.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">
                                No OKRs found for {selectedQuarter} {selectedYear}
                              </div>
                            ) : (
                              filteredOkrs.map((okr) => (
                                <SelectItem key={okr.id} value={okr.id} data-testid={`option-okr-${okr.id}`}>
                                  <div className="flex flex-col">
                                    <span>{okr.okrNumber} - {okr.objectiveStatement.substring(0, 50)}{okr.objectiveStatement.length > 50 ? '...' : ''}</span>
                                    <span className="text-xs text-muted-foreground">Submitted by: {okr.staff?.name || "Unknown"}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select which OKR from your SPU you want to score for this quarter
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Key Result Scores - shown after OKR selected */}
                {selectedOkr && keyResultScores && keyResultScores.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Score Each Key Result</h3>
                      <Badge variant="secondary" className="text-lg px-4 py-1">
                        Average: {form.watch("averageScore")}%
                      </Badge>
                    </div>

                    <Card className="bg-muted/30">
                      <CardContent className="pt-4 space-y-4">
                        {keyResultScores.map((_, index) => (
                          <FormField
                            key={index}
                            control={form.control}
                            name={`keyResultScores.${index}.score`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Key Result {index + 1}: {keyResultScores[index].description}
                                </FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-4">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      placeholder="Enter score 0-100"
                                      {...field}
                                      onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                      className="max-w-xs"
                                      data-testid={`input-kr-${index + 1}-score`}
                                    />
                                    <span className="text-sm text-muted-foreground">/ 100</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </CardContent>
                    </Card>

                    {/* Summary Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Summary *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please summarize any outcomes, challenges, accomplishments, or achievements for this OKR..."
                              className="min-h-32 resize-none"
                              {...field}
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormDescription>
                            Describe outcomes, challenges, accomplishments, or achievements (minimum 10 characters)
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
                        {mutation.isPending ? "Submitting..." : "Submit Quarterly Update"}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedQuarter && selectedYear && !selectedOkr && filteredOkrs.length === 0 && (
                  <Card className="border-destructive/50">
                    <CardContent className="pt-6 pb-6 text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        You don't have any OKRs for {selectedQuarter} {selectedYear}.
                        Please select a different quarter/year or submit a new OKR first.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
