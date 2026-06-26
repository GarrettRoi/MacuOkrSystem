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
import { CheckCircle2, Plus, Trash2, Sparkles, Smile, Frown } from "lucide-react";
import type { StaffWithDetails, Spu, SubUnit, UniversityObjectiveWithKeyResults } from "@shared/schema";
import { QUARTERS, PLANNING_YEARS, isLeaderRole, getCalendarYearForQuarter, getCalendarYearsForPlanningYear, formatPlanYearLabel, formatQuarterTagForPlanYear } from "@shared/schema";
import { apiRequest, queryClient, getErrorMessage, logClientError } from "@/lib/queryClient";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { MultiSelectSpus } from "@/components/multi-select-spus";

const keyResultSchema = z.object({
  description: z.string().min(10, "Key result description must be at least 10 characters"),
});

const formSchema = z.object({
  staffId: z.string(),
  spuId: z.string().min(1, "Please select a primary SPU"),
  subUnitId: z.string().optional(),
  planYear: z.number().min(1, "Please select a plan year"),
  quarter: z.string().min(1, "Please select a quarter"),
  year: z.number(),
  collaborationSpuIds: z.array(z.string()).optional(),
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
const WHOLE_SPU_SENTINEL = "__whole_spu__";

export default function SubmitOkr({ staff }: SubmitOkrProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: spus } = useQuery<Spu[]>({
    queryKey: ["/api/spus"],
  });

  const { data: subUnits } = useQuery<SubUnit[]>({
    queryKey: ["/api/sub-units"],
  });

  const { data: universityObjectivesData } = useQuery<UniversityObjectiveWithKeyResults[]>({
    queryKey: ["/api/university-objectives"],
  });

  const { data: planStartYearData } = useQuery<{ startYear: number }>({
    queryKey: ["/api/settings/strategic-plan-start-year"],
  });
  const planStartYear = planStartYearData?.startYear || 2024;
  const defaultPlanYear = Math.min(4, Math.max(1, currentYear - planStartYear + 1));

  

  // Fetch SPU assignments for every role — basic users may also have
  // additional SPU/sub-unit grants via staff_spu_assignments and we need
  // to honor them when populating the pickers.
  const { data: spuAssignments } = useQuery<any[]>({
    queryKey: ["/api/staff", staff.id, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/staff/${staff.id}/assignments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // For basic users, build the explicit list of (spuId, subUnitId|null)
  // pairs they are allowed to submit OKRs for: primary + every entry in
  // staff_spu_assignments. A null subUnitId means "whole SPU" is allowed.
  const basicAllowedPairs = useMemo(() => {
    if (staff.role !== "basic") return [] as { spuId: string; subUnitId: string | null }[];
    const pairs: { spuId: string; subUnitId: string | null }[] = [
      { spuId: staff.spuId, subUnitId: staff.subUnitId ?? null },
    ];
    for (const a of (spuAssignments || []) as any[]) {
      if (!a?.spuId) continue;
      pairs.push({ spuId: a.spuId, subUnitId: a.subUnitId ?? null });
    }
    return pairs;
  }, [staff.role, staff.spuId, staff.subUnitId, spuAssignments]);

  // Get available SPUs for this user
  const getAvailableSpus = () => {
    if (!spus) return [];

    // Super admins can see all SPUs
    if (staff.role === "super_admin") {
      return spus;
    }

    // Leaders can see their primary SPU plus assigned SPUs
    if (isLeaderRole(staff.role)) {
      const assignedSpuIds = (spuAssignments || []).map((a: any) => a.spuId);
      return spus.filter(spu =>
        spu.id === staff.spuId || assignedSpuIds.includes(spu.id)
      );
    }

    // Basic users see every SPU they're tied to via primary or assignments
    const basicSpuIds = new Set(basicAllowedPairs.map(p => p.spuId));
    return spus.filter(spu => basicSpuIds.has(spu.id));
  };

  const availableSpus = getAvailableSpus();

  // For basics: compute what's allowed inside a given SPU.
  // Returns the set of explicit sub-unit ids, plus whether "whole SPU"
  // is granted for that SPU (i.e. a pair with null subUnitId).
  const getBasicAllowedForSpu = (spuId: string) => {
    const subUnitIds = new Set<string>();
    let allowsWholeSpu = false;
    for (const p of basicAllowedPairs) {
      if (p.spuId !== spuId) continue;
      if (p.subUnitId) subUnitIds.add(p.subUnitId);
      else allowsWholeSpu = true;
    }
    return { subUnitIds, allowsWholeSpu };
  };

  // Lock the SPU+sub-unit pickers only when the basic user has no choice
  // at all: a single SPU and a single sub-unit (their original primary).
  const lockedToSubUnit =
    staff.role === "basic" && basicAllowedPairs.length === 1 && !!staff.subUnitId;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffId: staff.id,
      spuId: lockedToSubUnit ? staff.spuId : "",
      subUnitId: lockedToSubUnit ? (staff.subUnitId || undefined) : undefined,
      planYear: defaultPlanYear,
      quarter: "",
      year: currentYear,
      collaborationSpuIds: [],
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
  const watchedPlanYear = form.watch("planYear");
  const watchedQuarter = form.watch("quarter");
  const watchedObjectives = form.watch("universityObjectives");
  const watchedUniversityKeyResults = form.watch("universityKeyResults");

  // Keep the stored calendar year in sync with the (plan year, quarter) pick.
  useEffect(() => {
    if (!watchedPlanYear || !watchedQuarter) return;
    const derived = getCalendarYearForQuarter(watchedPlanYear, watchedQuarter, planStartYear);
    if (form.getValues("year") !== derived) {
      form.setValue("year", derived);
    }
  }, [watchedPlanYear, watchedQuarter, planStartYear]);

  const objectiveOptions = useMemo(() => {
    if (!universityObjectivesData) return [];
    const { q1q2Year, q3q4Year } = getCalendarYearsForPlanningYear(watchedPlanYear, planStartYear);
    return universityObjectivesData
      .filter(obj => obj.isActive !== false)
      .filter(obj => {
        if (!obj.applicableYears || obj.applicableYears.length === 0) return true;
        return obj.applicableYears.includes(q1q2Year) || obj.applicableYears.includes(q3q4Year);
      })
      .map(obj => `${obj.label}: ${obj.description}`);
  }, [universityObjectivesData, watchedPlanYear, planStartYear]);

  const keyResultOptions = useMemo(() => {
    if (!universityObjectivesData || watchedObjectives.length === 0) return [];
    const selectedLabels = watchedObjectives.map((opt: string) => opt.split(":")[0].trim());
    return universityObjectivesData
      .filter(obj => selectedLabels.includes(obj.label))
      .flatMap(obj => obj.keyResults.map(kr => `${kr.label} : ${kr.description}`));
  }, [universityObjectivesData, watchedObjectives]);

  useEffect(() => {
    if (watchedObjectives.length === 0) return;
    const valid = watchedObjectives.filter((obj: string) => objectiveOptions.includes(obj));
    if (valid.length !== watchedObjectives.length) {
      form.setValue("universityObjectives", valid);
    }
  }, [objectiveOptions]);

  useEffect(() => {
    if (watchedUniversityKeyResults.length === 0) return;
    const valid = watchedUniversityKeyResults.filter((kr: string) => keyResultOptions.includes(kr));
    if (valid.length !== watchedUniversityKeyResults.length) {
      form.setValue("universityKeyResults", valid);
    }
  }, [keyResultOptions]);

  const ratingMutation = useMutation({
    mutationFn: async (rating: "good" | "bad") => {
      const pageUrl = (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : ""
      ).slice(0, 500);
      return await apiRequest("POST", "/api/app-ratings", {
        rating,
        pageUrl,
        context: "okr_submitted",
      });
    },
  });
  const [ratingSubmitted, setRatingSubmitted] = useState<"good" | "bad" | null>(null);

  const handleRate = (rating: "good" | "bad") => {
    if (ratingSubmitted || ratingMutation.isPending) return;
    setRatingSubmitted(rating);
    ratingMutation.mutate(rating, {
      onSuccess: () => {
        toast({ title: "Thanks for the feedback!" });
      },
      onError: (error: unknown) => {
        setRatingSubmitted(null);
        logClientError("submit-okr:rating", error);
        toast({ title: "Failed to submit rating", description: getErrorMessage(error), variant: "destructive" });
      },
    });
  };

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
      setRatingSubmitted(null);
      toast({
        title: "OKR Submitted Successfully",
        description: "Your OKR has been recorded in the system.",
      });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      logClientError("submit-okr:create", error);
      toast({
        title: "Submission Failed",
        description: `${message}. Please try again or contact your admin.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    const availableSpuIds = availableSpus.map((s) => s.id);
    const subUnitsForSpu = (subUnits || []).filter(
      (su) => su.spuId === data.spuId && availableSpuIds.includes(su.spuId)
    );
    // For basics, force a sub-unit pick unless the SPU is granted "whole SPU".
    if (staff.role === "basic") {
      const { subUnitIds, allowsWholeSpu } = getBasicAllowedForSpu(data.spuId);
      if (subUnitIds.size > 0 && !allowsWholeSpu) {
        if (!data.subUnitId || data.subUnitId === WHOLE_SPU_SENTINEL) {
          form.setError("subUnitId", {
            type: "manual",
            message: "Please select one of your assigned sub-units.",
          });
          return;
        }
      }
    } else if (subUnitsForSpu.length > 0 && !data.subUnitId) {
      form.setError("subUnitId", {
        type: "manual",
        message: "Please select a sub-unit, or choose \"Apply to whole SPU\"",
      });
      return;
    }
    // Split the prefixed picker values ("spu:UUID" / "sub:UUID") into two arrays
    // so the server can route them to the correct FK column / join-table row type.
    const prefixed = data.collaborationSpuIds || [];
    const collaborationSpuIds = prefixed
      .filter((v) => v.startsWith("spu:"))
      .map((v) => v.slice(4));
    const collaborationSubUnitIds = prefixed
      .filter((v) => v.startsWith("sub:"))
      .map((v) => v.slice(4));
    // Storage keeps (quarter, year=calendarYear); derive the calendar year from
    // the chosen plan year + quarter and drop the presentation-only planYear field.
    const derivedYear = getCalendarYearForQuarter(data.planYear, data.quarter, planStartYear);
    const { planYear: _planYear, ...rest } = data;
    const base =
      rest.subUnitId === WHOLE_SPU_SENTINEL
        ? { ...rest, subUnitId: undefined }
        : rest;
    mutation.mutate({ ...base, year: derivedYear, collaborationSpuIds, collaborationSubUnitIds } as any);
  };


  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    form.reset({
      staffId: staff.id,
      spuId: lockedToSubUnit ? staff.spuId : "",
      subUnitId: lockedToSubUnit ? (staff.subUnitId || undefined) : undefined,
      planYear: defaultPlanYear,
      quarter: "",
      year: currentYear,
      collaborationSpuIds: [],
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
                  className="mb-6 mx-auto max-w-sm rounded-md border bg-muted/40 p-4"
                  data-testid="rating-prompt"
                >
                  {ratingSubmitted ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-rating-thanks">
                      Thanks for letting us know!
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-3">How was your experience?</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => handleRate("good")}
                          disabled={ratingMutation.isPending}
                          data-testid="button-rate-good"
                        >
                          <Smile className="h-5 w-5 mr-2 text-green-600" />
                          Good
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleRate("bad")}
                          disabled={ratingMutation.isPending}
                          data-testid="button-rate-bad"
                        >
                          <Frown className="h-5 w-5 mr-2 text-red-600" />
                          Bad
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
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
                  {(() => {
                    const spuNameById = new Map((spus || []).map((s) => [s.id, s.name]));
                    const subUnitById = new Map((subUnits || []).map((su) => [su.id, su]));
                    const entries: { key: string; label: string }[] = [];
                    const seen = new Set<string>();
                    const pushEntry = (key: string, label: string) => {
                      if (seen.has(key)) return;
                      seen.add(key);
                      entries.push({ key, label });
                    };
                    if (staff.subUnit) {
                      pushEntry(`primary:${staff.subUnit.id}`, staff.subUnit.name);
                    }
                    for (const a of (spuAssignments || []) as any[]) {
                      if (!a?.spuId) continue;
                      if (a.subUnitId) {
                        const su = subUnitById.get(a.subUnitId);
                        if (!su) continue;
                        const spuName = spuNameById.get(su.spuId);
                        const label = spuName && su.spuId !== staff.spuId
                          ? `${spuName} \u2014 ${su.name}`
                          : su.name;
                        pushEntry(`sub:${a.subUnitId}`, label);
                      } else if (a.spuId !== staff.spuId) {
                        const spuName = spuNameById.get(a.spuId);
                        if (!spuName) continue;
                        pushEntry(`spu:${a.spuId}`, `${spuName} (entire SPU)`);
                      }
                    }
                    if (entries.length === 0) return null;
                    return (
                      <div>
                        <p className="text-sm font-medium">
                          {entries.length > 1 ? "Sub-Units or Divisions" : "Sub-Unit or Division"}
                        </p>
                        {entries.length === 1 ? (
                          <p
                            className="text-sm text-muted-foreground"
                            data-testid="text-staff-subunit"
                          >
                            {entries[0].label}
                          </p>
                        ) : (
                          <ul
                            className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5"
                            data-testid="list-staff-subunits"
                          >
                            {entries.map((e) => (
                              <li key={e.key} data-testid={`text-staff-subunit-${e.key}`}>
                                {e.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground border">
                Each Strategic Planning Unit (SPU) may submit multiple OKRs. OKR numbers are automatically assigned sequentially as they are submitted for your SPU.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="planYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Year *</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan-year">
                            <SelectValue placeholder="Select plan year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PLANNING_YEARS.map((py) => (
                            <SelectItem key={py} value={String(py)} data-testid={`option-plan-year-${py}`}>
                              {formatPlanYearLabel(py, planStartYear)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Select the strategic plan year this OKR applies to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quarter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Quarter *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quarter">
                            <SelectValue placeholder="Select quarter" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {QUARTERS.map((q) => (
                            <SelectItem key={q.value} value={q.value} data-testid={`option-quarter-${q.value}`}>
                              {watchedPlanYear ? `${formatQuarterTagForPlanYear(q.value, watchedPlanYear, planStartYear)} — ${q.label.split(": ")[1]}` : q.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        {watchedPlanYear && watchedQuarter
                          ? `This OKR will be tagged ${formatPlanYearLabel(watchedPlanYear, planStartYear)} · ${formatQuarterTagForPlanYear(watchedQuarter, watchedPlanYear, planStartYear)}`
                          : "Select the fiscal quarter this OKR applies to"}
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
                            if (!lockedToSubUnit) {
                              form.setValue("subUnitId", undefined);
                              form.clearErrors("subUnitId");
                            }
                          }} 
                          value={field.value || ""}
                          disabled={lockedToSubUnit}
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
                          {lockedToSubUnit
                            ? "You can only submit OKRs for your assigned SPU and sub-unit."
                            : isLeaderRole(staff.role) || staff.role === "super_admin" 
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
                    const availableSpuIds = availableSpus.map(s => s.id);
                    const allSubUnitsForSpu = subUnits?.filter(
                      su => su.spuId === selectedSpuId && availableSpuIds.includes(su.spuId)
                    ) || [];

                    // For basics, narrow the list of sub-units to those they
                    // have an explicit grant for. Also decide if "whole SPU"
                    // is allowed for the chosen SPU.
                    const basicAllowed = staff.role === "basic"
                      ? getBasicAllowedForSpu(selectedSpuId)
                      : null;
                    const filteredSubUnits = basicAllowed
                      ? allSubUnitsForSpu.filter(su => basicAllowed.subUnitIds.has(su.id))
                      : allSubUnitsForSpu;
                    const showWholeSpuOption = basicAllowed
                      ? basicAllowed.allowsWholeSpu
                      : true;
                    const hasSubUnits = filteredSubUnits.length > 0;
                    const isRequired = hasSubUnits && !lockedToSubUnit;

                    return (
                      <FormItem>
                        <FormLabel>
                          Sub-Unit or Division {isRequired ? "*" : "(Optional)"}
                        </FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value)}
                          value={field.value || ""}
                          disabled={lockedToSubUnit || !selectedSpuId || (!hasSubUnits && !showWholeSpuOption)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sub-unit">
                              <SelectValue placeholder={
                                !selectedSpuId
                                  ? "Select an SPU first"
                                  : !hasSubUnits && !showWholeSpuOption
                                    ? "No sub-units available"
                                    : !hasSubUnits
                                      ? "Apply to whole SPU"
                                      : "Select sub-unit"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {showWholeSpuOption && (
                              <SelectItem value={WHOLE_SPU_SENTINEL} data-testid="select-sub-unit-none">
                                Apply to whole SPU
                              </SelectItem>
                            )}
                            {filteredSubUnits.map((subUnit) => (
                              <SelectItem key={subUnit.id} value={subUnit.id}>
                                {subUnit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {lockedToSubUnit
                            ? "Locked to your assigned sub-unit."
                            : !selectedSpuId
                              ? "Select an SPU above to choose a sub-unit."
                              : basicAllowed && !showWholeSpuOption && hasSubUnits
                                ? "Pick one of your assigned sub-units."
                                : !hasSubUnits && !showWholeSpuOption
                                  ? "This SPU has no sub-units available to you."
                                  : "Pick a specific sub-unit, or choose \"Apply to whole SPU\""}
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
                name="collaborationSpuIds"
                render={({ field }) => {
                  const selectedSpuId = form.watch("spuId");
                  const selectedSubUnitId = form.watch("subUnitId");
                  const allSpus = spus || [];
                  const allSubUnits = subUnits || [];
                  const spuNameById = new Map(allSpus.map((s) => [s.id, s.name]));
                  // Encode each option as "spu:UUID" or "sub:UUID" so the submit
                  // handler can split them into the right server-side arrays.
                  // (Mixing them was the cause of the FK violation crash.)
                  const spuOptions = allSpus
                    .filter((s) => s.id !== selectedSpuId)
                    .map((s) => ({ id: `spu:${s.id}`, name: s.name }));
                  const subUnitOptions = allSubUnits
                    .filter((su) => su.id !== selectedSubUnitId)
                    .map((su) => ({
                      id: `sub:${su.id}`,
                      name: `${spuNameById.get(su.spuId) ?? "SPU"} — ${su.name}`,
                    }));
                  const collaborationOptions = [...spuOptions, ...subUnitOptions].sort((a, b) =>
                    a.name.localeCompare(b.name)
                  );
                  return (
                    <FormItem>
                      <FormLabel>Collaboration SPU(s) or Sub-Unit(s) (Optional)</FormLabel>
                      <FormControl>
                        <MultiSelectSpus
                          options={collaborationOptions}
                          selectedIds={field.value || []}
                          onChange={field.onChange}
                          placeholder="Not Applicable"
                          testIdPrefix="select-collaboration-spu"
                        />
                      </FormControl>
                      <FormDescription>
                        If you are collaborating with one or more other SPUs or sub-units, select them here
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
