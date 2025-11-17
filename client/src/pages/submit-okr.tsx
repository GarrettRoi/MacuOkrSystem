import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import type { StaffWithDetails } from "@shared/schema";
import { insertOkrSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

const formSchema = insertOkrSchema.extend({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  targetValue: z.coerce.number().min(1, "Target value must be at least 1").max(100, "Target value cannot exceed 100"),
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffId: staff.id,
      title: "",
      description: "",
      quarter: "",
      year: currentYear,
      targetValue: 100,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", "/api/okrs", data);
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
      title: "",
      description: "",
      quarter: "",
      year: currentYear,
      targetValue: 100,
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
                    <p className="text-sm font-medium">Department</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-staff-dept">{staff.department.name}</p>
                  </div>
                  {staff.subDepartment && (
                    <div>
                      <p className="text-sm font-medium">Sub-Department</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-staff-subdept">{staff.subDepartment.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OKR Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Increase student enrollment by 15%"
                        {...field}
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormDescription>
                      A clear, concise objective statement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the objective, key results, and success metrics in detail..."
                        className="min-h-32 resize-none"
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormDescription>
                      Provide detailed information about what you aim to achieve
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target % *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...field}
                          data-testid="input-target"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        1-100%
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
