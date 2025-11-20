import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { StaffWithDetails, Spu } from "@shared/schema";
import { UNIVERSITY_OBJECTIVES, UNIVERSITY_KEY_RESULTS, OKR_NUMBERS } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

const keyResultSchema = z.object({
  description: z.string().min(10, "Key result description must be at least 10 characters"),
  percentage: z.coerce.number().min(1, "Percentage must be at least 1").max(100, "Percentage cannot exceed 100"),
});

const formSchema = z.object({
  staffId: z.string(),
  okrNumber: z.string().min(1, "Please select an OKR number"),
  quarter: z.string().min(1, "Please select a quarter"),
  year: z.number(),
  collaborationSpuId: z.string().optional(),
  universityObjective: z.string().min(1, "Please select a university objective"),
  universityKeyResult: z.string().min(1, "Please select a university key result"),
  objectiveStatement: z.string().min(20, "Objective statement must be at least 20 characters"),
  keyResults: z.array(keyResultSchema).min(1, "At least one key result is required"),
}).refine((data) => {
  const total = data.keyResults.reduce((sum, kr) => sum + kr.percentage, 0);
  return Math.abs(total - 100) < 0.01;
}, {
  message: "Key result percentages must add up to 100%",
  path: ["keyResults"],
});

type FormValues = z.infer<typeof formSchema>;

interface SubmitOkrProps {
  staff: StaffWithDetails;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function SubmitOkr({ staff }: SubmitOkrProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffId: staff.id,
      okrNumber: "",
      quarter: "",
      year: currentYear,
      collaborationSpuId: undefined,
      universityObjective: "",
      universityKeyResult: "",
      objectiveStatement: "",
      keyResults: [{ description: "", percentage: 100 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "keyResults",
  });

  const watchedKeyResults = form.watch("keyResults");

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const normalizedKeyResults = data.keyResults.map(kr => ({
        description: kr.description,
        percentage: Number(kr.percentage),
      }));
      const payload = {
        ...data,
        keyResults: JSON.stringify(normalizedKeyResults),
      };
      return await apiRequest("POST", "/api/okrs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/okrs"] });
      setIsSubmitted(true);
      toast({
        title: "OKR Submitted Successfully",
        description: "Your OKR has been recorded in the system.",
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your OKR. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  const totalPercentage = watchedKeyResults.reduce((sum, kr) => sum + (Number(kr.percentage) || 0), 0);

  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    form.reset({
      staffId: staff.id,
      okrNumber: "",
      quarter: "",
      year: currentYear,
      collaborationSpuId: undefined,
      universityObjective: "",
      universityKeyResult: "",
      objectiveStatement: "",
      keyResults: [{ description: "", percentage: 100 }],
    });
  };

  if (isSubmitted) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">OKR Submitted Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your OKR has been recorded and is now being tracked in the system.
            </p>
            <Button onClick={handleSubmitAnother} data-testid="button-submit-another">
              Submit Another OKR
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
          <CardTitle className="text-2xl font-semibold">Submit New OKR</CardTitle>
          <CardDescription>
            Create a new Objective and Key Result for tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-staff-email">{staff.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Primary SPU (School, Department, Unit)</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-staff-spu">{staff.spu.name}</p>
                  </div>
                  {staff.subUnit && (
                    <div>
                      <p className="text-sm font-medium">Sub-Unit or Division</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-subunit">{staff.subUnit.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="quarter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quarter *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quarter">
                            <SelectValue placeholder="Select quarter" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {QUARTERS.map((q) => (
                            <SelectItem key={q} value={q} data-testid={`option-quarter-${q}`}>
                              {q}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Select the quarter to which this OKR will apply
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
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-year">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {YEARS.map((year) => (
                            <SelectItem key={year} value={String(year)} data-testid={`option-year-${year}`}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Select the year to which this OKR will apply
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="okrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OKR Number *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-okr-number">
                            <SelectValue placeholder="Select OKR #" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OKR_NUMBERS.map((num) => (
                            <SelectItem key={num} value={num} data-testid={`option-okr-${num}`}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Which numbered OKR are you submitting?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="collaborationSpuId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collaboration SPU (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-collaboration-spu">
                          <SelectValue placeholder="Not Applicable" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {spus?.filter((s) => s.id !== staff.spuId).map((spu) => (
                          <SelectItem key={spu.id} value={spu.id}>
                            {spu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      If you are collaborating with another Primary SPU, please select them here
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="universityObjective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University Level Strategic Objective *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-university-objective">
                          <SelectValue placeholder="Select a strategic objective" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIVERSITY_OBJECTIVES.map((obj) => (
                          <SelectItem key={obj} value={obj}>
                            {obj}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the University Level Strategic Objective for your OKR
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="universityKeyResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University-Level Key Result *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-university-key-result">
                          <SelectValue placeholder="Select a key result" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIVERSITY_KEY_RESULTS.map((kr) => (
                          <SelectItem key={kr} value={kr}>
                            {kr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the appropriate University-Level Key Result for your OKR
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="objectiveStatement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objective Statement *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your objective statement..."
                        className="min-h-24 resize-none"
                        {...field}
                        data-testid="input-objective-statement"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe what you aim to achieve with this OKR
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Key Results *</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Total: <span className={Math.abs(totalPercentage - 100) < 0.01 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                      {totalPercentage}%
                    </span>
                  </div>
                </div>
                <FormDescription className="text-xs">
                  Add your key results with percentage allocation. Total must equal 100%.
                </FormDescription>
                
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-start">
                    <div className="flex-1 space-y-4">
                      <FormField
                        control={form.control}
                        name={`keyResults.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder={`Key Result ${index + 1} description...`}
                                className="min-h-20 resize-none"
                                {...field}
                                data-testid={`input-key-result-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`keyResults.${index}.percentage`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              step="0.1"
                              placeholder="%"
                              {...field}
                              data-testid={`input-percentage-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-key-result-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ description: "", percentage: 0 })}
                  className="w-full"
                  data-testid="button-add-key-result"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Key Result
                </Button>
                
                {form.formState.errors.keyResults?.root && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.keyResults.root.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={mutation.isPending}
                  data-testid="button-submit-okr"
                >
                  {mutation.isPending ? "Submitting..." : "Submit OKR"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
