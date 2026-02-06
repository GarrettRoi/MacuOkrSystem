import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Plus, Trash2, Sparkles } from "lucide-react";
import type { StaffWithDetails, Spu, SubUnit, Year, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { QUARTERS } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";

const keyResultSchema = z.object({
  description: z.string().min(10, "Key result description must be at least 10 characters"),
});

const formSchema = z.object({
  staffId: z.string(),
  spuId: z.string().min(1, "Please select a primary SPU"),
  subUnitId: z.string().optional(),
  quarter: z.string().min(1, "Please select a quarter"),
  year: z.number(),
  collaborationSpuId: z.string().optional(),
  universityObjectives: z.array(z.string()).min(1, "Please select at least one university objective"),
  universityKeyResults: z.array(z.string()).min(1, "Please select at least one university key result"),
  objectiveStatement: z.string().min(20, "Objective statement must be at least 20 characters"),
  keyResults: z.array(keyResultSchema).min(1, "At least one key result is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface SubmitOkrProps {
  staff: StaffWithDetails;
}

const currentYear = new Date().getFullYear();

export default function SubmitOkr({ staff }: SubmitOkrProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: subUnits } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: years } = useQuery<Year[]>({
    queryKey: ["/api/years"],
  });

  const { data: universityObjectivesData } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const objectiveOptions = universityObjectivesData?.map(obj => `${obj.label}: ${obj.description}`) || [];

  // Fetch SPU assignments for leaders/super_admins
  const { data: spuAssignments } = useQuery<any[]>({
    queryKey: ["/api/staff", staff.id, "spu-assignments"],
    enabled: staff.role === "leader" || staff.role === "super_admin",
  });

  // Get available SPUs for this user
  const getAvailableSpus = () => {
    if (!spus) return [];
    
    // Super admins can see all SPUs
    if (staff.role === "super_admin") {
      return spus;
    }
    
    // Leaders can see their primary SPU plus assigned SPUs
    if (staff.role === "leader") {
      const assignedSpuIds = (spuAssignments || []).map((a: any) => a.spuId);
      return spus.filter(spu => 
        spu.id === staff.spuId || assignedSpuIds.includes(spu.id)
      );
    }
    
    // Basic users can only see their primary SPU
    return spus.filter(spu => spu.id === staff.spuId);
  };

  const availableSpus = getAvailableSpus();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffId: staff.id,
      spuId: staff.spuId,
      subUnitId: staff.subUnitId || undefined,
      quarter: "",
      year: currentYear,
      collaborationSpuId: undefined,
      universityObjectives: [],
      universityKeyResults: [],
      objectiveStatement: "",
      keyResults: [{ description: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "keyResults",
  });

  const watchedKeyResults = form.watch("keyResults");
  const watchedObjectives = form.watch("universityObjectives");
  const watchedUniversityKeyResults = form.watch("universityKeyResults");

  const keyResultOptions = useMemo(() => {
    if (!universityObjectivesData || watchedObjectives.length === 0) return [];
    const selectedLabels = watchedObjectives.map((opt: string) => opt.split(":")[0].trim());
    return universityObjectivesData
      .filter(obj => selectedLabels.includes(obj.label))
      .flatMap(obj => obj.keyResults.map(kr => `${kr.label} : ${kr.description}`));
  }, [universityObjectivesData, watchedObjectives]);

  useEffect(() => {
    if (watchedUniversityKeyResults.length === 0) return;
    const valid = watchedUniversityKeyResults.filter((kr: string) => keyResultOptions.includes(kr));
    if (valid.length !== watchedUniversityKeyResults.length) {
      form.setValue("universityKeyResults", valid);
    }
  }, [keyResultOptions]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const normalizedKeyResults = data.keyResults.map(kr => ({
        description: kr.description,
        percentage: 25,
      }));
      const payload = {
        ...data,
        universityObjective: JSON.stringify(data.universityObjectives),
        universityKeyResult: JSON.stringify(data.universityKeyResults),
        keyResults: JSON.stringify(normalizedKeyResults),
      };
      delete (payload as any).universityObjectives;
      delete (payload as any).universityKeyResults;
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


  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    form.reset({
      staffId: staff.id,
      spuId: staff.spuId,
      subUnitId: staff.subUnitId || undefined,
      quarter: "",
      year: currentYear,
      collaborationSpuId: undefined,
      universityObjectives: [],
      universityKeyResults: [],
      objectiveStatement: "",
      keyResults: [{ description: "" }],
    });
  };

  if (isSubmitted) {
    const confettiParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
    }));

    return (
      <div className="max-w-3xl mx-auto p-6">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="relative overflow-hidden">
              <CardContent className="pt-12 pb-12 text-center relative">
                {confettiParticles.map((particle) => (
                  <motion.div
                    key={particle.id}
                    className="absolute top-0 w-2 h-2 rounded-full"
                    style={{
                      left: `${particle.x}%`,
                      background: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    }}
                    initial={{ y: -20, opacity: 1, scale: 1 }}
                    animate={{
                      y: 400,
                      opacity: 0,
                      scale: 0,
                      rotate: 360,
                    }}
                    transition={{
                      duration: particle.duration,
                      delay: particle.delay,
                      ease: "easeIn",
                    }}
                  />
                ))}

                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2,
                  }}
                >
                  <div className="relative inline-block">
                    <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <motion.div
                      className="absolute -top-1 -right-1"
                      animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 10, -10, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Sparkles className="h-6 w-6 text-yellow-500" />
                    </motion.div>
                  </div>
                </motion.div>

                <motion.h2
                  className="text-2xl font-semibold mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  OKR Submitted Successfully!
                </motion.h2>

                <motion.p
                  className="text-muted-foreground mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  Your OKR has been recorded and is now being tracked in the system.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <Button 
                    onClick={handleSubmitAnother} 
                    data-testid="button-submit-another"
                    className="relative"
                  >
                    Submit Another OKR
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        key="form"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Submit New OKR</CardTitle>
            <CardDescription>
              Create a new Objective and Key Result for your SPU
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

              <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground border">
                Each Strategic Planning Unit (SPU) may submit multiple OKRs. OKR numbers are automatically assigned sequentially as they are submitted for your SPU.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <SelectItem key={q.value} value={q.value} data-testid={`option-quarter-${q.value}`}>
                              {q.label}
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
                          {years && years.length > 0 ? (
                            years.sort((a, b) => b.year - a.year).map((year) => (
                              <SelectItem key={year.id} value={String(year.year)} data-testid={`option-year-${year.year}`}>
                                {year.year}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-years" disabled>No years available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Select the year to which this OKR will apply
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="font-semibold text-base">OKR Submission Department</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select which SPU and sub-unit this OKR is being submitted for. This may differ from your primary department if you work across multiple areas.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="spuId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Submit OKR for SPU *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("subUnitId", undefined);
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-spu">
                              <SelectValue placeholder="Select SPU" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableSpus.map((spu) => (
                              <SelectItem key={spu.id} value={spu.id}>
                                {spu.name}
                                {spu.id === staff.spuId && " (Primary)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          {staff.role === "leader" || staff.role === "super_admin" 
                            ? "Choose the department this OKR targets. You can submit for your assigned SPUs."
                            : "Choose the department this OKR targets"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subUnitId"
                  render={({ field }) => {
                    const selectedSpuId = form.watch("spuId");
                    const filteredSubUnits = subUnits?.filter(su => su.spuId === selectedSpuId) || [];
                    
                    return (
                      <FormItem>
                        <FormLabel>Sub-Unit or Division (Optional)</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedSpuId || filteredSubUnits.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sub-unit">
                              <SelectValue placeholder={filteredSubUnits.length === 0 ? "No sub-units available" : "Select sub-unit"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredSubUnits.map((subUnit) => (
                              <SelectItem key={subUnit.id} value={subUnit.id}>
                                {subUnit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select a specific sub-unit if applicable
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                </div>
              </div>

              <FormField
                control={form.control}
                name="collaborationSpuId"
                render={({ field }) => {
                  const selectedSpuId = form.watch("spuId");
                  return (
                    <FormItem>
                      <FormLabel>Collaboration SPU (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-collaboration-spu">
                            <SelectValue placeholder="Not Applicable" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {spus?.filter((s) => s.id !== selectedSpuId).map((spu) => (
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
                  );
                }}
              />

              <FormField
                control={form.control}
                name="universityObjectives"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University Level Strategic Objective(s) *</FormLabel>
                    <FormControl>
                      <MultiSelectCheckboxes
                        options={objectiveOptions}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder="Select strategic objective(s)..."
                        testIdPrefix="select-university-objective"
                      />
                    </FormControl>
                    <FormDescription>
                      Select one or more University Level Strategic Objectives for your OKR
                    </FormDescription>
                    {field.value.length > 0 && (
                      <div className="rounded-md border border-input bg-muted/30 p-3 space-y-2" data-testid="selected-objectives-display">
                        <p className="text-xs font-medium text-muted-foreground">Selected Objective(s):</p>
                        {field.value.map((item: string, idx: number) => (
                          <p key={idx} className="text-sm leading-relaxed" data-testid={`selected-objective-text-${idx}`}>{item}</p>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="universityKeyResults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>University-Level Key Result(s) *</FormLabel>
                    <FormControl>
                      <MultiSelectCheckboxes
                        options={keyResultOptions}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder="Select key result(s)..."
                        testIdPrefix="select-university-key-result"
                      />
                    </FormControl>
                    <FormDescription>
                      Select one or more University-Level Key Results for your OKR
                    </FormDescription>
                    {field.value.length > 0 && (
                      <div className="rounded-md border border-input bg-muted/30 p-3 space-y-2" data-testid="selected-key-results-display">
                        <p className="text-xs font-medium text-muted-foreground">Selected Key Result(s):</p>
                        {field.value.map((item: string, idx: number) => (
                          <p key={idx} className="text-sm leading-relaxed" data-testid={`selected-key-result-text-${idx}`}>{item}</p>
                        ))}
                      </div>
                    )}
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
                <FormLabel>Key Results *</FormLabel>
                <FormDescription className="text-xs">
                  Add your key results (measurable outcomes that indicate success).
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
                  onClick={() => append({ description: "" })}
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
      </motion.div>
    </div>
  );
}
